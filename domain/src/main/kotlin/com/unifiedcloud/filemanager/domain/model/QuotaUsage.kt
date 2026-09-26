package com.unifiedcloud.filemanager.domain.model

/**
 * The account's provider storage usage.
 *
 * Read this type as a statement about Google Drive, not about this app. The
 * numbers describe the quota Google assigns to the user's own account. This app
 * contributes nothing to it, extends nothing, and has no tier to upgrade to
 * (Rules.md §1, PS-1, PS-2).
 *
 * That framing is why there is no `isOverQuota`-with-an-upsell shape here and no
 * field a marketing surface could latch onto. If a future screen wants to
 * suggest freeing space, it may only point at the user's own Drive usage and
 * must link out to Google's own storage management.
 */
data class QuotaUsage(
    val providerId: ProviderId,
    val usedBytes: Long,
    val limitBytes: Long?,
    /** Where the user manages this quota. Always the provider's own surface. */
    val manageUrl: String?,
) {
    init {
        require(usedBytes >= 0) { "usedBytes must not be negative" }
        require(limitBytes == null || limitBytes >= 0) { "limitBytes must not be negative" }
    }

    val isKnown: Boolean get() = limitBytes != null

    val usedFraction: Float?
        get() = limitBytes?.takeIf { it > 0 }?.let { usedBytes.toFloat() / it }

    val isOverLimit: Boolean
        get() = limitBytes != null && usedBytes >= limitBytes

    /**
     * A short neutral description, e.g. "12.4 GB of 15 GB used in Google Drive".
     * The provider is named in the string so the sentence cannot be read as a
     * claim about this app.
     */
    fun describe(): String {
        val providerName = if (providerId == ProviderId.GOOGLE_DRIVE) "Google Drive" else providerId.value
        val limit = limitBytes ?: return "$providerName: ${usedBytes.humanReadableBytes()} used"
        return "$providerName: ${usedBytes.humanReadableBytes()} of ${limit.humanReadableBytes()} used"
    }
}

/** Binary units, because providers report and users think in them. */
fun Long.humanReadableBytes(): String {
    if (this < 0) return "unknown"
    val units = listOf("B", "KB", "MB", "GB", "TB", "PB")
    var value = toDouble()
    var unitIndex = 0
    while (value >= 1024 && unitIndex < units.lastIndex) {
        value /= 1024
        unitIndex++
    }
    return if (unitIndex == 0) {
        "$this ${units[unitIndex]}"
    } else {
        String.format("%.1f %s", value, units[unitIndex])
    }
}
