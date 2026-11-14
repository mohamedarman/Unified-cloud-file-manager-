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

internal data class ProviderEndpoints(
    val providerId: ProviderId,
    val apiBaseUrl: String,
    val contentBaseUrl: String,
    val uploadBaseUrl: String,
)

internal data class UploadRequestSpec(
    val endpoints: ProviderEndpoints,
    val token: String,
    val parentFolderId: ProviderFileId?,
    val name: String,
    val mimeType: String,
    val source: java.io.InputStream,
    val sizeBytes: Long?,
    val onProgress: ProgressSink?,
)

/**
 * Provider-specific endpoint builders split from [MultiCloudRequestBuilder] so each
 * file stays compact and respects Detekt's function-count limits.
 */
internal object MultiCloudProviderRequests {
    private const val FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
    const val SINGLE_FILE_FIELDS =
        "id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,parents,trashed,starred,ownedByMe"
    val JSON_MEDIA_TYPE: MediaType = "application/json; charset=utf-8".toMediaType()

    fun buildOneDriveUpload(
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

    fun buildDropboxUpload(
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

    fun buildBoxUpload(
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

    fun buildDriveCreateFolder(
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

    fun buildDriveCopy(
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

    fun buildDriveList(
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request {
        val parentId = query.parentFolderId
        val parentClause =
            if (parentId != null) {
                "'${parentId.value}' in parents"
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

    fun buildOneDriveList(
        apiBaseUrl: String,
        token: String,
        query: FileQuery,
    ): Request {
        val parentId = query.parentFolderId
        val url =
            query.pageToken
                ?: if (parentId == null || parentId.value == "root") {
                    "$apiBaseUrl/root/children?\$top=${query.pageSize}"
                } else {
                    "$apiBaseUrl/items/${parentId.value}/children?\$top=${query.pageSize}"
                }
        return getRequest(url, token)
    }

    fun buildDropboxList(
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

    fun buildBoxList(
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

    fun buildOneDriveSearch(
        apiBaseUrl: String,
        token: String,
        query: SearchQuery,
    ): Request {
        val escaped = query.text.replace("'", "''")
        val targetUrl = query.pageToken ?: "$apiBaseUrl/root/search(q='$escaped')?\$top=${query.pageSize}"
        return getRequest(targetUrl, token)
    }

    fun buildDropboxSearch(
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

    fun buildDriveSearch(
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

    fun dropboxParentPrefix(parentFolderId: ProviderFileId?): String =
        parentFolderId?.value?.trimEnd('/')?.takeIf { it.isNotEmpty() && it != "root" }.orEmpty()

    fun getRequest(
        url: String,
        token: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .get()
            .build()

    fun deleteRequest(
        url: String,
        token: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .delete()
            .build()

    fun postJson(
        url: String,
        token: String,
        jsonBody: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .post(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
            .build()

    fun patchJson(
        url: String,
        token: String,
        jsonBody: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .patch(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
            .build()

    fun putJson(
        url: String,
        token: String,
        jsonBody: String,
    ): Request =
        Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .put(jsonBody.toRequestBody(JSON_MEDIA_TYPE))
            .build()
}
