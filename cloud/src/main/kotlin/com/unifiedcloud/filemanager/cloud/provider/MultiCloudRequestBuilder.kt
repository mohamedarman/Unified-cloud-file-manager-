package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.drive.DriveFields
import com.unifiedcloud.filemanager.domain.model.FileQuery
import com.unifiedcloud.filemanager.domain.model.ProgressSink
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import com.unifiedcloud.filemanager.domain.model.SearchQuery
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
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
    const val SINGLE_FILE_FIELDS = MultiCloudProviderRequests.SINGLE_FILE_FIELDS
    val JSON_MEDIA_TYPE: MediaType = MultiCloudProviderRequests.JSON_MEDIA_TYPE
    private val OCTET_MEDIA_TYPE: MediaType = "application/octet-stream".toMediaType()

    fun quota(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
    ): Request =
        when (providerId) {
            ProviderId.DROPBOX ->
                MultiCloudProviderRequests.postJson("$apiBaseUrl/users/get_space_usage", token, "null")
            ProviderId.ONE_DRIVE -> MultiCloudProviderRequests.getRequest(apiBaseUrl, token)
            ProviderId.BOX -> MultiCloudProviderRequests.getRequest("$apiBaseUrl/users/me", token)
            else -> {
                val url =
                    "$apiBaseUrl/about".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", DriveFields.ABOUT)
                        .build()
                MultiCloudProviderRequests.getRequest(url.toString(), token)
            }
        }

    fun listFiles(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> MultiCloudProviderRequests.buildOneDriveList(apiBaseUrl, token, query)
            ProviderId.DROPBOX -> MultiCloudProviderRequests.buildDropboxList(apiBaseUrl, token, query)
            ProviderId.BOX -> MultiCloudProviderRequests.buildBoxList(apiBaseUrl, token, query)
            else -> MultiCloudProviderRequests.buildDriveList(apiBaseUrl, token, query)
        }

    fun fileMetadata(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE ->
                MultiCloudProviderRequests.getRequest("$apiBaseUrl/items/${fileId.value}", token)
            ProviderId.DROPBOX ->
                MultiCloudProviderRequests.postJson(
                    "$apiBaseUrl/files/get_metadata",
                    token,
                    buildJsonObject { put("path", fileId.value) }.toString(),
                )
            ProviderId.BOX ->
                MultiCloudProviderRequests.getRequest("$apiBaseUrl/files/${fileId.value}", token)
            else -> {
                val url =
                    "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                        .build()
                MultiCloudProviderRequests.getRequest(url.toString(), token)
            }
        }

    fun search(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        query: SearchQuery,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE -> MultiCloudProviderRequests.buildOneDriveSearch(apiBaseUrl, token, query)
            ProviderId.DROPBOX -> MultiCloudProviderRequests.buildDropboxSearch(apiBaseUrl, token, query)
            ProviderId.BOX -> {
                val url =
                    "$apiBaseUrl/search".toHttpUrl().newBuilder()
                        .addQueryParameter("query", query.text)
                        .addQueryParameter("limit", query.pageSize.toString())
                        .build()
                MultiCloudProviderRequests.getRequest(url.toString(), token)
            }
            else -> MultiCloudProviderRequests.buildDriveSearch(apiBaseUrl, token, query)
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
                MultiCloudProviderRequests.postJson(target, token, payload.toString())
            }
            ProviderId.DROPBOX -> {
                val fullPath = "${MultiCloudProviderRequests.dropboxParentPrefix(parentFolderId)}/$name"
                val payload =
                    buildJsonObject {
                        put("path", fullPath)
                        put("autorename", true)
                    }
                MultiCloudProviderRequests.postJson(
                    "$apiBaseUrl/files/create_folder_v2",
                    token,
                    payload.toString(),
                )
            }
            ProviderId.BOX -> {
                val payload =
                    buildJsonObject {
                        put("name", name)
                        put("parent", buildJsonObject { put("id", parentFolderId?.value ?: "0") })
                    }
                MultiCloudProviderRequests.postJson("$apiBaseUrl/folders", token, payload.toString())
            }
            else -> MultiCloudProviderRequests.buildDriveCreateFolder(apiBaseUrl, token, parentFolderId, name)
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
                MultiCloudProviderRequests.patchJson(
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
                MultiCloudProviderRequests.postJson("$apiBaseUrl/files/move_v2", token, payload.toString())
            }
            ProviderId.BOX ->
                MultiCloudProviderRequests.putJson(
                    "$apiBaseUrl/files/${fileId.value}",
                    token,
                    buildJsonObject { put("name", newName) }.toString(),
                )
            else -> {
                val url =
                    "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                        .build()
                MultiCloudProviderRequests.patchJson(
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
                MultiCloudProviderRequests.patchJson(
                    "$apiBaseUrl/items/${fileId.value}",
                    token,
                    payload.toString(),
                )
            }
            ProviderId.DROPBOX -> {
                val fileName = fileId.value.substringAfterLast('/')
                val prefix = MultiCloudProviderRequests.dropboxParentPrefix(newParentFolderId)
                val payload =
                    buildJsonObject {
                        put("from_path", fileId.value)
                        put("to_path", "$prefix/$fileName")
                        put("autorename", true)
                    }
                MultiCloudProviderRequests.postJson("$apiBaseUrl/files/move_v2", token, payload.toString())
            }
            ProviderId.BOX -> {
                val payload =
                    buildJsonObject {
                        put("parent", buildJsonObject { put("id", newParentFolderId?.value ?: "0") })
                    }
                MultiCloudProviderRequests.putJson("$apiBaseUrl/files/${fileId.value}", token, payload.toString())
            }
            else -> {
                val urlBuilder =
                    "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                if (newParentFolderId != null) {
                    urlBuilder.addQueryParameter("addParents", newParentFolderId.value)
                }
                MultiCloudProviderRequests.patchJson(urlBuilder.build().toString(), token, "{}")
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
                MultiCloudProviderRequests.postJson(
                    "$apiBaseUrl/items/${fileId.value}/copy",
                    token,
                    payload.toString(),
                )
            }
            ProviderId.DROPBOX -> {
                val fileName = fileId.value.substringAfterLast('/')
                val prefix = MultiCloudProviderRequests.dropboxParentPrefix(newParentFolderId)
                val payload =
                    buildJsonObject {
                        put("from_path", fileId.value)
                        put("to_path", "$prefix/$fileName")
                        put("autorename", true)
                    }
                MultiCloudProviderRequests.postJson("$apiBaseUrl/files/copy_v2", token, payload.toString())
            }
            ProviderId.BOX -> {
                val payload =
                    buildJsonObject {
                        put("parent", buildJsonObject { put("id", newParentFolderId?.value ?: "0") })
                    }
                MultiCloudProviderRequests.postJson(
                    "$apiBaseUrl/files/${fileId.value}/copy",
                    token,
                    payload.toString(),
                )
            }
            else -> MultiCloudProviderRequests.buildDriveCopy(apiBaseUrl, token, fileId, newParentFolderId)
        }

    fun deletePermanently(
        providerId: ProviderId,
        apiBaseUrl: String,
        token: String,
        fileId: ProviderFileId,
    ): Request =
        when (providerId) {
            ProviderId.ONE_DRIVE ->
                MultiCloudProviderRequests.deleteRequest("$apiBaseUrl/items/${fileId.value}", token)
            ProviderId.DROPBOX ->
                MultiCloudProviderRequests.postJson(
                    "$apiBaseUrl/files/delete_v2",
                    token,
                    buildJsonObject { put("path", fileId.value) }.toString(),
                )
            ProviderId.BOX ->
                MultiCloudProviderRequests.deleteRequest("$apiBaseUrl/files/${fileId.value}/trash", token)
            else -> MultiCloudProviderRequests.deleteRequest("$apiBaseUrl/files/${fileId.value}", token)
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
                ProviderId.ONE_DRIVE ->
                    MultiCloudProviderRequests.getRequest("$apiBaseUrl/items/${fileId.value}/content", token)
                ProviderId.DROPBOX -> {
                    val arg = buildJsonObject { put("path", fileId.value) }.toString()
                    Request.Builder()
                        .url("$contentBaseUrl/files/download")
                        .header("Authorization", "Bearer $token")
                        .header("Dropbox-API-Arg", arg)
                        .post("".toRequestBody(null))
                        .build()
                }
                ProviderId.BOX ->
                    MultiCloudProviderRequests.getRequest("$apiBaseUrl/files/${fileId.value}/content", token)
                else -> {
                    val url =
                        "$apiBaseUrl/files/${fileId.value}".toHttpUrl().newBuilder()
                            .addQueryParameter("alt", "media")
                            .build()
                    MultiCloudProviderRequests.getRequest(url.toString(), token)
                }
            }
        return if (rangeHeader != null) {
            baseRequest.newBuilder().header("Range", rangeHeader).build()
        } else {
            baseRequest
        }
    }

    fun upload(spec: UploadRequestSpec): Request {
        val mediaType = runCatching { spec.mimeType.toMediaType() }.getOrElse { OCTET_MEDIA_TYPE }
        val streamingBody =
            createStreamingRequestBody(
                source = spec.source,
                sizeBytes = spec.sizeBytes,
                mediaType = mediaType,
                onProgress = spec.onProgress,
            )
        val endpoints = spec.endpoints
        return when (endpoints.providerId) {
            ProviderId.ONE_DRIVE ->
                MultiCloudProviderRequests.buildOneDriveUpload(
                    endpoints.apiBaseUrl,
                    spec.token,
                    spec.parentFolderId,
                    spec.name,
                    streamingBody,
                )
            ProviderId.DROPBOX ->
                MultiCloudProviderRequests.buildDropboxUpload(
                    endpoints.contentBaseUrl,
                    spec.token,
                    spec.parentFolderId,
                    spec.name,
                    streamingBody,
                )
            ProviderId.BOX ->
                MultiCloudProviderRequests.buildBoxUpload(
                    endpoints.uploadBaseUrl,
                    spec.token,
                    spec.parentFolderId,
                    spec.name,
                    streamingBody,
                )
            else -> {
                val url =
                    "${endpoints.apiBaseUrl}/files".toHttpUrl().newBuilder()
                        .addQueryParameter("fields", SINGLE_FILE_FIELDS)
                        .build()
                Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer ${spec.token}")
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
            ProviderId.ONE_DRIVE ->
                MultiCloudProviderRequests.getRequest("$apiBaseUrl/items/${fileId.value}/versions", token)
            ProviderId.DROPBOX -> {
                val payload =
                    buildJsonObject {
                        put("path", fileId.value)
                        put("limit", pageSize)
                    }
                MultiCloudProviderRequests.postJson(
                    "$apiBaseUrl/files/list_revisions",
                    token,
                    payload.toString(),
                )
            }
            ProviderId.BOX ->
                MultiCloudProviderRequests.getRequest("$apiBaseUrl/files/${fileId.value}/versions", token)
            else -> {
                val urlBuilder =
                    "$apiBaseUrl/files/${fileId.value}/revisions".toHttpUrl().newBuilder()
                        .addQueryParameter("pageSize", pageSize.toString())
                if (pageToken != null) {
                    urlBuilder.addQueryParameter("pageToken", pageToken)
                }
                MultiCloudProviderRequests.getRequest(urlBuilder.build().toString(), token)
            }
        }

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
