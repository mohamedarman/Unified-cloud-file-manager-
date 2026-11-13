package com.unifiedcloud.filemanager.domain.model

/**
 * A cloud file as the domain represents it.
 *
 * Deliberately not a protocol buffer of the provider's own file resource. This
 * is the vocabulary the app reasons in, so a future provider maps onto it rather
 * than forcing its own shape onto the UI (Architecture.md §6.1, FP-1).
 */
data class CloudFile(
    val ref: FileRef,
    val name: String,
    val mimeType: String,
    val sizeBytes: Long?,
    val modifiedTimeMillis: Long?,
    val isFolder: Boolean,
    val parentFolderId: ProviderFileId?,
    val isShared: Boolean,
    val isOwnedByUser: Boolean,
    val isStarred: Boolean = false,
    val isOfflineAvailable: Boolean = false,
    /**
     * Whether the file is in the account's trash.
     *
     * Present because it changes the available actions, not merely for display:
     * a trashed file can be restored or deleted permanently, and offers neither
     * rename nor download. Without this flag the action matrix cannot be decided
     * for a trashed file at all.
     */
    val isTrashed: Boolean = false,
    val webViewLink: String? = null,
    val thumbnailLink: String? = null,
) {
    init {
        require(name.isNotEmpty()) { "CloudFile.name must not be empty" }
        require(sizeBytes == null || sizeBytes >= 0) { "CloudFile.sizeBytes must not be negative" }
    }

    /**
     * A folder has no meaningful content length. Callers that need to decide
     * whether to offer "show size" should ask this rather than testing for null,
     * which would conflate "a folder" with "size unknown".
     */
    val hasContentLength: Boolean
        get() = !isFolder && sizeBytes != null

    /** MIME types Drive reports for Google-native documents. */
    val isGoogleNative: Boolean
        get() = mimeType.startsWith("application/vnd.google-apps.")

    /**
     * Whether this file can be opened as bytes.
     *
     * Google-native documents cannot: they are edited in Google's own editors and
     * have no meaningful binary form (Architecture.md §6.1). Attempting a
     * download anyway produces a confusing error far from the cause, so the
     * capability is stated on the file.
     */
    val isDownloadableAsBytes: Boolean
        get() = !isGoogleNative && !isFolder
}

/**
 * Validates folder hierarchy operations to prevent moving a folder into itself
 * or any of its descendants.
 */
object FolderHierarchyValidator {
    private const val MAX_ANCESTOR_DEPTH = 256

    /**
     * Returns true if moving [folderId] into [targetParentId] would create a cycle
     * (either moving into itself or into a descendant of [folderId]).
     */
    fun wouldCreateCycle(
        folderId: ProviderFileId,
        targetParentId: ProviderFileId?,
        parentLookup: (ProviderFileId) -> ProviderFileId?,
    ): Boolean {
        if (targetParentId == null) return false
        if (folderId == targetParentId) return true
        val visited = mutableSetOf<ProviderFileId>()
        var cursor: ProviderFileId? = targetParentId
        var depth = 0
        while (cursor != null && depth < MAX_ANCESTOR_DEPTH) {
            if (cursor == folderId) return true
            if (!visited.add(cursor)) break
            cursor = parentLookup(cursor)
            depth++
        }
        return false
    }
}

/**
 * Where the domain expects freshness from. Compared against
 * `CloudFile.modifiedTimeMillis` by the caching layer to decide whether a cached
 * listing is still usable.
 */
enum class Freshness {
    /** Nothing cached, or the cache is older than any tolerance we would accept. */
    NONE,

    /** Cached and within tolerance. */
    FRESH,

    /** Cached but older than tolerance. Usable as a placeholder, must revalidate. */
    STALE,
}
