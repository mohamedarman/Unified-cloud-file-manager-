package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.drive.DriveFields
import com.unifiedcloud.filemanager.domain.model.FileQuery
import com.unifiedcloud.filemanager.domain.model.ProgressSink
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import com.unifiedcloud.filemanager.domain.model.SearchQuery
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import java.io.InputStream

/**
 * Builds provider-specific HTTP requests for Google Drive v3, Microsoft Graph OneDrive v1.0,
 * Dropbox API v2, and Box API v2.0.
 */
internal object MultiCloudRequestBuilder {
    private const val STREAM_BUFFER_BYTES = 8192
    private const val FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
    const val SINGLE_FILE_FIELDS =
        "id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,parents,trashed,starred,ownedByMe"
    val JSON_MEDIA_TYPE: MediaType = "application/json; charset=utf-8".toMediaType()
    val OCTET_MEDIA_TYPE: MediaType = "application/octet-stream".toMediaType()

    fun quota(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
    ): Request =
        when (providerId) {
            ProviderId.DROPBOX -> postJson("$apiBaseUrl/users/get_space_usage", token, "null")
            ProviderId.ONE_DRIVE -> getRequest(apiBaseUrl, token)
            ProviderId.BOX -> getRequest("$apiBaseUrl/users/me", token)
            else -> {
                val url =
                    "$apiBaseUrl/about".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", DriveFields.ABOUT)
                        .build()
                getRequest(url.toString(), token)
            }
        }

    fun listFiles(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> buildOneDriveList(apiBaseUrl, token, query)
            ProviderId.DROPBOX -> buildDropboxList(apiBaseUrl, token, query)
            ProviderId.BOX -> buildBoxList(apiBaseUrl, token, query)
            else -> buildDriveList(apiBaseUrl, token, query)
        }

    fun fileMetadata(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> getRequest("$apiBaseUrl/items/${fileId.value}", token)
            ProviderId.DROPBOX ->
                postJson(
                    "$apiBaseUrl/files/get_metadata",
                    token,
                    buildJsonObject { put("path", fileId.value) }.toString(),
                )
            ProviderId.BOX -> getRequest("$apiBaseUrl/files/${fileId.value}", token)
            else -> {
                val url =
                    "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                        .build()
                getRequest(url.toString(), token)
            }
        }

    fun search(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        query: SearchQuery,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> buildOneDriveSearch(apiBaseUrl, token, query)
            ProviderId.DROPBOX -> buildDropboxSearch(apiBaseUrl, token, query)
            ProviderId.BOX -> {
                val url =
                    "$apiBaseUrl/search".toHttpUrl().newBuilder()
                        .addQueryParameter("query", query.text)
                        .addQueryParameter("limit", query.pageSize.toString())
                        .build()
                getRequest(url.toString(), token)
            }
            else -> buildDriveSearch(apiBaseUrl, token, query)
        }

    fun createFolder(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        parentFolderId: ProviderFileId?,
        name: String,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> {
                val target =
                    if (parentFolderId == null || parentFolderId.value == "root") {
                        "$apiBaseUrl/root/children"
                    } else {
                        "$apiBaseUrl/items/${parentFolderId.value}/children"
                    }
                val payload =
                    buildJsonObject {
                        put("name", name)
                        put("folder", buildJsonObject {})
                        put("@microsoft.graph.conflictBehavior", "rename")
                    }
                postJson(target, token, payload.toString())
            }
            ProviderId.DROPBOX -> {
                val fullPath = "${dropboxParentPrefix(parentFolderId)}/$name"
                val payload =
                    buildJsonObject {
                        put("path", fullPath)
                        put("autorename", true)
                    }
                postJson("$apiBaseUrl/files/create_folder_v2", token, payload.toString())
            }
            ProviderId.BOX -> {
                val payload =
                    buildJsonObject {
                        put("name", name)
                        put("parent", buildJsonObject { put("id", parentFolderId?.value ?: "0") })
                    }
                postJson("$apiBaseUrl/folders", token, payload.toString())
            }
            else -> buildDriveCreateFolder(apiBaseUrl, token, parentFolderId, name)
        }

    fun rename(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
        newName: String,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE ->
                patchJson(
                    "$apiBaseUrl/items/${fileId.value}",
                    token,
                    buildJsonObject { put("name", newName) }.toString(),
                )
            ProviderId.DROPBOX -> {
                val parentPrefix = fileId.value.substringBeforeLast('/', "")
                val payload =
                    buildJsonObject {
                        put("from_path", fileId.value)
                        put("to_path", "$parentPrefix/$newName")
                        put("autorename", true)
                    }
                postJson("$apiBaseUrl/files/move_v2", token, payload.toString())
            }
            ProviderId.BOX ->
                putJson(
                    "$apiBaseUrl/files/${fileId.value}",
                    token,
                    buildJsonObject { put("name", newName) }.toString(),
                )
            else -> {
                val url =
                    "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                        .build()
                patchJson(
                    url.toString(),
                    token,
                    buildJsonObject { put("name", newName) }.toString(),
                )
            }
        }

    fun move(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> {
                val payload =
                    buildJsonObject {
                        put(
                            "parentReference",
                            buildJsonObject { put("id", newParentFolderId?.value ?: "root") },
                        )
                    }
                patchJson("$apiBaseUrl/items/${fileId.value}", token, payload.toString())
            }
            ProviderId.DROPBOX -> {
                val fileName = fileId.value.substringAfterLast('/')
                val payload =
                    buildJsonObject {
                        put("from_path", fileId.value)
                        put("to_path", "${dropboxParentPrefix(newParentFolderId)}/$fileName")
                        put("autorename", true)
                    }
                postJson("$apiBaseUrl/files/move_v2", token, payload.toString())
            }
            ProviderId.BOX -> {
                val payload =
                    buildJsonObject {
                        put("parent", buildJsonObject { put("id", newParentFolderId?.value ?: "0") })
                    }
                putJson("$apiBaseUrl/files/${fileId.value}", token, payload.toString())
            }
            else -> {
                val urlBuilder =
                    "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                if (newParentFolderId != null) {
                    urlBuilder.addQueryParameter("addParents", newParentFolderId.value)
                }
                patchJson(urlBuilder.build().toString(), token, "{}")
            }
        }

    fun copy(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> {
                val payload =
                    buildJsonObject {
                        put(
                            "parentReference",
                            buildJsonObject { put("id", newParentFolderId?.value ?: "root") },
                        )
                    }
                postJson("$apiBaseUrl/items/${fileId.value}/copy", token, payload.toString())
            }
            ProviderId.DROPBOX -> {
                val fileName = fileId.value.substringAfterLast('/')
                val payload =
                    buildJsonObject {
                        put("from_path", fileId.value)
                        put("to_path", "${dropboxParentPrefix(newParentFolderId)}/$fileName")
                        put("autorename", true)
                    }
                postJson("$apiBaseUrl/files/copy_v2", token, payload.toString())
            }
            ProviderId.BOX -> {
                val payload =
                    buildJsonObject {
                        put("parent", buildJsonObject { put("id", newParentFolderId?.value ?: "0") })
                    }
                postJson("$apiBaseUrl/files/${fileId.value}/copy", token, payload.toString())
            }
            else -> buildDriveCopy(apiBaseUrl, token, fileId, newParentFolderId)
        }

    fun deletePermanently(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> deleteRequest("$apiBaseUrl/items/${fileId.value}", token)
            ProviderId.DROPBOX ->
                postJson(
                    "$apiBaseUrl/files/delete_v2",
                    token,
                    buildJsonObject { put("path", fileId.value) }.toString(),
                )
            ProviderId.BOX -> deleteRequest("$apiBaseUrl/files/${fileId.value}/trash", token)
            else -> deleteRequest("$apiBaseUrl/files/${fileId.value}", token)
        }

    fun download(
        providerId: ProviderId,
        apiBaseUrl: String,
        contentBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
        rangeHeader: String?,
    ): Request {
        val baseRequest =
            when (providerId) {
                ProviderId.ONE_DRIVE -> getRequest("$apiBaseUrl/items/${fileId.value}/content", token)
                ProviderId.DROPBOX -> {
                    val arg = buildJsonObject { put("path", fileId.value) }.toString()
                    Request.Builder()
                        .url("$contentBaseUrl/files/download")
                        .header("Authorization", "Bearer $token")
                        .header("Dropbox-API-Arg", arg)
                        .post("".toRequestBody(null))
                        .build()
                }
                ProviderId.BOX -> getRequest("$apiBaseUrl/files/${fileId.value}/content", token)
                else -> {
                    val url =
                        "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                            .addQueryParameter("alt", "media")
                            .build()
                    getRequest(url.toString(), token)
                }
            }
        return if (rangeHeader != null) {
            baseRequest.newBuilder().header("Range", rangeHeader).build()
        } else {
            baseRequest
        }
    }

    fun upload(
        providerId: ProviderId,
        apiBaseUrl: String,
        contentBaseUrl: String,
        uploadBaseUrl: String,
        token: String,
        parentFolderId: ProviderFileId?,
        name: String,
        mimeType: String,
        source: InputStream,
        sizeBytes: Long?,
        onProgress: ProgressSink?,
    ): Request {
        val mediaType = runCatching { mimeType.toMediaType() }.getOrElse { OCTET_MEDIA_TYPE }
        val streamingBody = createStreamingRequestBody(source, sizeBytes, mediaType, onProgress)
        return when (providerId) {
            ProviderId.ONE_DRIVE ->
                buildOneDriveUpload(apiBaseUrl, token, parentFolderId, name, streamingBody)
            ProviderId.DROPBOX ->
                buildDropboxUpload(contentBaseUrl, token, parentFolderId, name, streamingBody)
            ProviderId.BOX ->
                buildBoxUpload(uploadBaseUrl, token, parentFolderId, name, streamingBody)
            else -> {
                val url =
                    "$apiBaseUrl/files".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                        .build()
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .post(streamingBody)
                    .build()
            }
        }
    }

    fun revisions(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
        pageToken: String?,
        pageSize: Int,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> getRequest("$apiBaseUrl/items/${fileId.value}/versions", token)
            ProviderId.DROPBOX -> {
                val payload =
                    buildJsonObject {
                        put("path", fileId.value)
                        put("limit", pageSize)
                    }
                postJson("$apiBaseUrl/files/list_revisions", token, payload.toString())
            }
            ProviderId.BOX -> getRequest("$apiBaseUrl/files/${fileId.value}/versions", token)
            else -> {
                val urlBuilder =
                    "$apiBaseUrl/files/${fileId.value}/revisions".toHttpUrl().newBuilder()
                        .addQueryParameter("pageSize", pageSize.toString())
                if (pageToken != null) {
                    urlBuilder.addQueryParameter("pageToken", pageToken)
                }
                getRequest(urlBuilder.build().toString(), token)
            }
        }

    private fun buildOneDriveUpload(
        apiBaseUrl: String,
        token: String,
        parentFolderId: ProviderFileId?,
        name: String,
        streamingBody: RequestBody,
    ): Request {
        val targetUrl =
            if (parentFolderId == null || parentFolderId.value == "root") {
                "$apiBaseUrl/root:/$name:/content"
            } else {
                "$apiBaseUrl/items/${parentFolderId.value}:/$name:/content"
            }
        return Request.Builder()
            .url(targetUrl)
            .header("Authorization", "Bearer $token")
            .put(streamingBody)
            .build()
    }

    private fun buildDropboxUpload(
        contentBaseUrl: String,
        token: String,
        parentFolderId: ProviderFileId?,
        name: String,
        streamingBody: RequestBody,
    ): Request {
        val arg =
            buildJsonObject {
                put("path", "${dropboxParentPrefix(parentFolderId)}/$name")
                put("mode", "add")
                put("autorename", true)
            }.toString()
        return Request.Builder()
            .url("$contentBaseUrl/files/upload")
            .header("Authorization", "Bearer $token")
            .header("Dropbox-API-Arg", arg)
            .header("Content-Type", "application/octet-stream")
            .post(streamingBody)
            .build()
    }

    private fun buildBoxUpload(
        uploadBaseUrl: String,
        token: String,
        parentFolderId: ProviderFileId?,
        name: String,
        streamingBody: RequestBody,
    ): Request {
        val attrs =
            buildJsonObject {
                put("name", name)
                put("parent", buildJsonObject { put("id", parentFolderId?.value ?: "0") })
            }.toString()
        val multipart =
            MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("attributes", attrs)
                .addFormDataPart("file", name, streamingBody)
                .build()
        return Request.Builder()
            .url("$uploadBaseUrl/files/content")
            .header("Authorization", "Bearer $token")
            .post(multipart)
            .build()
    }

    private fun buildDriveCreateFolder(
        apiBaseUrl: String,
        token: String,
        parentFolderId: ProviderFileId?,
        name: String,
    ): Request {
        val payload =
            buildJsonObject {
                put("name", name)
                put("mimeType", FOLDER_MIME_TYPE)
                if (parentFolderId != null) {
                    put("parents", buildJsonArray { add(JsonPrimitive(parentFolderId.value)) })
                }
            }
        val url =
            "$apiBaseUrl/files".toHttpUrl().newBuilder()
                .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                .build()
        return postJson(url.toString(), token, payload.toString())
    }

    private fun buildDriveCopy(
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
        newParentFolderId: ProviderFileId?,
    ): Request {
        val payload =
            buildJsonObject {
                if (newParentFolderId != null) {
                    put("parents", buildJsonArray { add(JsonPrimitive(newParentFolderId.value)) })
                }
            }
        val url =
            "$apiBaseUrl/files/${fileId.value}/copy".toHttpUrl().newBuilder()
                .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                .build()
        return postJson(url.toString(), token, payload.toString())
    }

    private fun buildDriveList(
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request {
        val parentClause =
            if (query.parentFolderId != null) {
                "'${query.parentFolderId?.value}' in parents"
            } else {
                "'root' in parents"
            }
        val urlBuilder =
            "$apiBaseUrl/files".toHttpUrl().newBuilder()
                .addQueryParameter("q", "$parentClause and trashed = false")
                .addQueryParameter("corpora", DriveFields.CORPORA_USER)
                .addQueryParameter("spaces", DriveFields.SPACES_DRIVE)
                .addQueryParameter("pageSize", query.pageSize.toString())
                .addQueryParameter("fields", DriveFields.FILE_LIST)
        query.pageToken?.let { urlBuilder.addQueryParameter("pageToken", it) }
        return getRequest(urlBuilder.build().toString(), token)
    }

    private fun buildOneDriveList(
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request {
        val url =
            query.pageToken ?: if (query.parentFolderId == null || query.parentFolderId?.value == "root") {
                "$apiBaseUrl/root/children?\$top=${query.pageSize}"
            } else {
                "$apiBaseUrl/items/${query.parentFolderId?.value}/children?\$top=${query.pageSize}"
            }
        return getRequest(url, token)
    }

    private fun buildDropboxList(
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request {
        val isContinue = query.pageToken != null
        val payload =
            if (isContinue) {
                buildJsonObject { put("cursor", query.pageToken) }
            } else {
                val path = query.parentFolderId?.value?.takeIf { it != "root" }.orEmpty()
                buildJsonObject {
                    put("path", path)
                    put("limit", query.pageSize)
                }
            }
        val suffix = if (isContinue) "list_folder/continue" else "list_folder"
        return postJson("$apiBaseUrl/files/$suffix", token, payload.toString())
    }

    private fun buildBoxList(
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request {
        val folderId = query.parentFolderId?.value ?: "0"
        val urlBuilder =
            "$apiBaseUrl/folders/$folderId/items".toHttpUrl().newBuilder()
                .addQueryParameter("limit", query.pageSize.toString())
                .addQueryParameter("fields", "id,name,size,modified_at,type,parent,item_status")
        query.pageToken?.let { urlBuilder.addQueryParameter("offset", it) }
        return getRequest(urlBuilder.build().toString(), token)
    }

    private fun buildOneDriveSearch(
        apiBaseUrl: String,
        token: String,
        query: SearchQuery,
    ): Request {
        val escaped = query.text.replace("'", "''")
        val targetUrl = query.pageToken ?: "$apiBaseUrl/root/search(q='$escaped')?\$top=${query.pageSize}"
        return getRequest(targetUrl, token)
    }

    private fun buildDropboxSearch(
        apiBaseUrl: String,
        token: String,
        query: SearchQuery,
    ): Request {
        val payload =
            if (query.pageToken != null) {
                buildJsonObject { put("cursor", query.pageToken) }
            } else {
                buildJsonObject {
                    put("query", query.text)
                    put("options", buildJsonObject { put("max_results", query.pageSize) })
                }
            }
        val path = if (query.pageToken != null) "continue_v2" else "search_v2"
        return postJson("$apiBaseUrl/files/$path", token, payload.toString())
    }

    private fun buildDriveSearch(
        apiBaseUrl: String,
        token: String,
        query: SearchQuery,
    ): Request {
        val escapedName = query.text.replace("'", "\\'")
        val urlBuilder =
            "$apiBaseUrl/files".toHttpUrl().newBuilder()
                .addQueryParameter("q", "name contains '$escapedName' and trashed = false")
                .addQueryParameter("corpora", DriveFields.CORPORA_USER)
                .addQueryParameter("spaces", DriveFields.SPACES_DRIVE)
                .addQueryParameter("pageSize", query.pageSize.toString())
                .addQueryParameter("fields", DriveFields.FILE_LIST)
        query.pageToken?.let { urlBuilder.addQueryParameter("pageToken", it) }
        return getRequest(urlBuilder.build().toString(), token)
    }

    private fun dropboxParentPrefix(parentFolderId: ProviderFileId?): String =
        parentFolderId?.value?.trimEnd('/')?.takeIf { it.isNotEmpty() && it != "root" }.orEmpty()

    private fun getRequest(
        url: String,
        token: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .get()
            .build()

    private fun deleteRequest(
        url: String,
        token: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .delete()
            .build()

    private fun postJson(
        url: String,
        token: String,
        jsonBody: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .post(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
            .build()

    private fun patchJson(
        url: String,
        token: String,
        jsonBody: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .patch(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
            .build()

    private fun putJson(
        url: String,
        token: String,
        jsonBody: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .put(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
            .build()

    private fun createStreamingRequestBody(
        source: InputStream,
        sizeBytes: Long?,
        mediaType: MediaType,
        onProgress: ProgressSink?,
    ): RequestBody =
        object : RequestBody() {
            override fun contentType(): MediaType = mediaType

            override fun contentLength(): Long = sizeBytes ?: -1L

            override fun isOneShot(): Boolean = true

            override fun writeTo(sink: BufferedSink) {
                onProgress?.onProgress(0L, sizeBytes)
                val buffer = ByteArray(STREAM_BUFFER_BYTES)
                var transferred = 0L
                source.use { input ->
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        sink.write(buffer, 0, read)
                        transferred += read.toLong()
                        onProgress?.onProgress(transferred, sizeBytes ?: transferred)
                    }
                }
                if (transferred == 0L) {
                    onProgress?.onProgress(0L, 0L)
                }
            }
        }
}
