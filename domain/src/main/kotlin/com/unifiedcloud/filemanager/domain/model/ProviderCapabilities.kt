package com.unifiedcloud.filemanager.domain.model

/**
 * Per-account feature support, queried at runtime.
 *
 * The point of this type is that no screen ever guesses. Every feature that
 * depends on the credential's scope asks [ProviderCapabilities] first, so a
 * scope downgrade - a revoked grant, a narrower re-consent, a partially
 * configured account - degrades a feature instead of producing a confusing
 * failure at the moment of use (PC-1, PC-4, PC-7).
 *
 * [UNKNOWN] is the honest default. Assuming a capability is present because it
 * usually is, is how an app ends up showing a "Download" button that then fails;
 * assuming it is absent just means an extra query at startup.
 */
data class ProviderCapabilities(
    val canReadFiles: Boolean?,
    val canWriteFiles: Boolean?,
    val canCreateFolders: Boolean?,
    val canRename: Boolean?,
    val canTrash: Boolean?,
    val canSearch: Boolean?,
    val canReadRevisions: Boolean?,
    val canStar: Boolean?,
    val canDownloadBytes: Boolean?,
    val grantsOfflineAccess: Boolean?,
    val canExport: Boolean?,
) {
    /**
     * Whether the credential covers the write path at all. The single gate the
     * app's edit affordances consult before showing anything actionable.
     */
    val canWrite: Boolean
        get() = canWriteFiles == true

    /**
     * True when a capability is unverified. Callers that need a definite answer
     * should have fetched capabilities first rather than treating unknown as yes.
     */
    val isUnverified: Boolean
        get() = canReadFiles == null

    /**
     * The features that are definitely unavailable, for a single explanatory
     * message rather than a scatter of dead buttons (PC-4).
     */
    fun unavailableFeatures(): Set<Feature> =
        buildSet {
            if (canSearch != true) add(Feature.SEARCH)
            if (canWrite != true) add(Feature.WRITE)
            if (canReadRevisions != true) add(Feature.REVISIONS)
            if (canDownloadBytes != true) add(Feature.DOWNLOAD)
            if (canStar != true) add(Feature.STAR)
            if (canExport != true) add(Feature.EXPORT)
            if (grantsOfflineAccess != true) add(Feature.OFFLINE)
        }

    companion object {
        /**
         * Nothing is known. The correct starting state before
         * `CloudProvider.getCapabilities` has answered.
         */
        val UNKNOWN =
            ProviderCapabilities(
                canReadFiles = null,
                canWriteFiles = null,
                canCreateFolders = null,
                canRename = null,
                canTrash = null,
                canSearch = null,
                canReadRevisions = null,
                canStar = null,
                canDownloadBytes = null,
                grantsOfflineAccess = null,
                canExport = null,
            )

        /**
         * A read-only credential: everything that mutates is off, everything that
         * observes is on. This is the shape a `drive.readonly` grant produces
         * (V-05, DEC-04).
         */
        val READ_ONLY =
            ProviderCapabilities(
                canReadFiles = true,
                canWriteFiles = false,
                canCreateFolders = false,
                canRename = false,
                canTrash = false,
                canSearch = true,
                canReadRevisions = true,
                canStar = true,
                canDownloadBytes = true,
                grantsOfflineAccess = true,
                canExport = true,
            )
    }
}

enum class Feature {
    /** Reading metadata and file content. The baseline every account needs. */
    READ,
    SEARCH,
    WRITE,
    REVISIONS,
    DOWNLOAD,
    STAR,
    EXPORT,
    OFFLINE,
}
