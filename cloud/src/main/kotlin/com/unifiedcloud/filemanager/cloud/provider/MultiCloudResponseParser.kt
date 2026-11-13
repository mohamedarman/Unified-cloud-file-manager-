package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.Page
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import com.unifiedcloud.filemanager.domain.model.QuotaUsage
import com.unifiedcloud.filemanager.domain.model.Revision
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.time.Instant

/**
 * Parses provider JSON payloads into domain models across Google Drive v3,
 * Microsoft Graph OneDrive v1.0, Dropbox API v2, and Box API v2.0.
 */
internal object MultiCloudResponseParser {
    private const val FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
    private const val DEFAULT_MIME_TYPE = "application/octet-stream"

    fun parseQuota(
        providerId: ProviderId,
        root: JsonObject,
    ): QuotaUsage {
        val allocation = root["allocation"]?.jsonObject
        val storageQuota = root["storageQuota"]?.jsonObject ?: root["quota"]?.jsonObject
        val used =
            storageQuota?.get("usage")?.jsonPrimitive?.longOrNull
                ?: storageQuota?.get("used")?.jsonPrimitive?.longOrNull
                ?: root["used"]?.jsonPrimitive?.longOrNull
                ?: root["space_used"]?.jsonPrimitive?.longOrNull
                ?: 0L
        val limit =
            storageQuota?.get("limit")?.jsonPrimitive?.longOrNull
                ?: storageQuota?.get("total")?.jsonPrimitive?.longOrNull
                ?: allocation?.get("allocated")?.jsonPrimitive?.longOrNull
                ?: root["space_amount"]?.jsonPrimitive?.longOrNull
        return QuotaUsage(
            providerId = providerId,
            usedBytes = used.coerceAtLeast(0L),
            limitBytes = limit?.takeIf { it > 0L },
            manageUrl = null,
        )
    }

    fun parseFilePage(
        providerId: ProviderId,
        accountId: LocalAccountId,
        root: JsonObject,
    ): Page<CloudFile> {
        val rawItems = extractFileArray(root)
        val items =
            rawItems.map { elem ->
                val obj = elem.jsonObject
                val target = obj["metadata"]?.jsonObject?.get("metadata")?.jsonObject ?: obj
                parseCloudFile(providerId, accountId, target)
            }
        val nextToken = extractNextPageToken(providerId, root, items.size)
        return Page(items = items, nextPageToken = nextToken)
    }

    fun parseCloudFile(
        providerId: ProviderId,
        accountId: LocalAccountId,
        obj: JsonObject,
    ): CloudFile {
        val unwrapped = obj["metadata"]?.jsonObject ?: obj
        val id = extractFileId(providerId, unwrapped)
        val name = unwrapped["name"]?.jsonPrimitive?.content?.takeIf { it.isNotEmpty() } ?: "Untitled"
        val isFolder = isFolderEntry(unwrapped)
        val mimeType = extractMimeType(unwrapped, isFolder)
        val sizeBytes = if (isFolder) null else unwrapped["size"]?.jsonPrimitive?.longOrNull
        val modifiedMillis = extractModifiedMillis(unwrapped)
        val parentId = extractParentId(unwrapped)
        return CloudFile(
            ref =
                FileRef(
                    provider = providerId,
                    accountId = accountId,
                    fileId = ProviderFileId(id),
                ),
            name = name,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
            modifiedTimeMillis = modifiedMillis,
            isFolder = isFolder,
            parentFolderId = parentId,
            isShared = unwrapped["shared"]?.jsonPrimitive?.booleanOrNull ?: false,
            isOwnedByUser = unwrapped["ownedByMe"]?.jsonPrimitive?.booleanOrNull ?: true,
            isStarred = unwrapped["starred"]?.jsonPrimitive?.booleanOrNull ?: false,
            isTrashed =
                unwrapped["trashed"]?.jsonPrimitive?.booleanOrNull
                    ?: (unwrapped["item_status"]?.jsonPrimitive?.content == "trashed"),
            webViewLink =
                unwrapped["webViewLink"]?.jsonPrimitive?.content
                    ?: unwrapped["webUrl"]?.jsonPrimitive?.content,
            thumbnailLink = unwrapped["thumbnailLink"]?.jsonPrimitive?.content,
        )
    }

    fun parseRevisions(
        providerId: ProviderId,
        fileId: ProviderFileId,
        root: JsonObject,
    ): Page<Revision> {
        val items =
            root["revisions"]?.jsonArray
                ?: root["value"]?.jsonArray
                ?: root["entries"]?.jsonArray
                ?: JsonArray(emptyList())
        val parsed =
            items.mapIndexedNotNull { idx, elem ->
                val item = elem.jsonObject
                val revId =
                    item["id"]?.jsonPrimitive?.content
                        ?: item["rev"]?.jsonPrimitive?.content
                        ?: return@mapIndexedNotNull null
                val modifiedMillis = extractModifiedMillis(item) ?: 0L
                val isCurrent =
                    when (providerId) {
                        ProviderId.GOOGLE_DRIVE -> idx == items.lastIndex
                        else -> idx == 0
                    }
                Revision(
                    fileId = fileId,
                    revisionId = revId,
                    modifiedTimeMillis = modifiedMillis,
                    sizeBytes = item["size"]?.jsonPrimitive?.longOrNull,
                    mimeType = item["mimeType"]?.jsonPrimitive?.content,
                    isCurrent = isCurrent,
                )
            }
        val nextToken = root["nextPageToken"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
        return Page(items = parsed, nextPageToken = nextToken)
    }

    private fun extractFileArray(root: JsonObject): JsonArray =
        root["files"]?.jsonArray
            ?: root["value"]?.jsonArray
            ?: root["entries"]?.jsonArray
            ?: root["matches"]?.jsonArray
            ?: JsonArray(emptyList())

    private fun extractNextPageToken(
        providerId: ProviderId,
        root: JsonObject,
        itemCount: Int,
    ): String? =
        when (providerId) {
            ProviderId.ONE_DRIVE ->
                root["@odata.nextLink"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
            ProviderId.DROPBOX ->
                if (root["has_more"]?.jsonPrimitive?.booleanOrNull == true) {
                    root["cursor"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
                } else {
                    null
                }
            ProviderId.BOX -> {
                val total = root["total_count"]?.jsonPrimitive?.longOrNull ?: 0L
                val offset = root["offset"]?.jsonPrimitive?.longOrNull ?: 0L
                val nextOffset = offset + itemCount
                if (nextOffset < total) nextOffset.toString() else null
            }
            else -> root["nextPageToken"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
        }

    private fun extractFileId(
        providerId: ProviderId,
        obj: JsonObject,
    ): String =
        if (providerId == ProviderId.DROPBOX) {
            obj["path_lower"]?.jsonPrimitive?.content
                ?: obj["path_display"]?.jsonPrimitive?.content
                ?: obj["id"]?.jsonPrimitive?.content
                ?: "unknown"
        } else {
            obj["id"]?.jsonPrimitive?.content ?: "unknown"
        }

    private fun isFolderEntry(obj: JsonObject): Boolean =
        obj["mimeType"]?.jsonPrimitive?.content == FOLDER_MIME_TYPE ||
            obj["folder"] != null ||
            obj[".tag"]?.jsonPrimitive?.content == "folder" ||
            obj["type"]?.jsonPrimitive?.content == "folder"

    private fun extractMimeType(
        obj: JsonObject,
        isFolder: Boolean,
    ): String {
        if (isFolder) return FOLDER_MIME_TYPE
        return obj["mimeType"]?.jsonPrimitive?.content
            ?: obj["file"]?.jsonObject?.get("mimeType")?.jsonPrimitive?.content
            ?: DEFAULT_MIME_TYPE
    }

    private fun extractModifiedMillis(obj: JsonObject): Long? {
        val modifiedStr =
            obj["modifiedTime"]?.jsonPrimitive?.content
                ?: obj["lastModifiedDateTime"]?.jsonPrimitive?.content
                ?: obj["server_modified"]?.jsonPrimitive?.content
                ?: obj["modified_at"]?.jsonPrimitive?.content
        return modifiedStr?.let {
            runCatching { Instant.parse(it).toEpochMilli() }.getOrNull()
        }
    }

    private fun extractParentId(obj: JsonObject): ProviderFileId? {
        val fromArray =
            obj["parents"]?.jsonArray?.firstOrNull()?.jsonPrimitive?.content
        val fromRef =
            obj["parentReference"]?.jsonObject?.get("id")?.jsonPrimitive?.content
                ?: obj["parent"]?.jsonObject?.get("id")?.jsonPrimitive?.content
        val raw = fromArray ?: fromRef
        return raw?.takeIf { it.isNotBlank() }?.let(::ProviderFileId)
    }
}
