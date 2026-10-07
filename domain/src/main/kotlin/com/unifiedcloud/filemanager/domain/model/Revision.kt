package com.unifiedcloud.filemanager.domain.model

import java.time.Instant
import java.time.ZoneId

/**
 * A stored revision of a file.
 *
 * [revisionId] is provider-issued and opaque, on the same terms as
 * [ProviderFileId]: never parse it, never assume ordering by value (FI-05). Use
 * [modifiedTimeMillis] for ordering.
 *
 * Revisions are a capability-gated feature. When the credential cannot read
 * revisions the UI hides the affordance rather than offering one that fails
 * (PC-4, Feature.REVISIONS).
 */
data class Revision(
    val fileId: ProviderFileId,
    val revisionId: String,
    val modifiedTimeMillis: Long,
    val sizeBytes: Long?,
    val mimeType: String?,
    val isCurrent: Boolean,
    val lastModifyingUserEmail: String? = null,
) {
    init {
        require(revisionId.isNotBlank()) { "Revision.revisionId must not be blank" }
    }
}

/**
 * Formats a revision timestamp for display.
 *
 * Absolute local time, not a relative "3 days ago": a revision list is used to
 * decide which version to restore, and a relative label makes two revisions
 * indistinguishable at exactly the moment the distinction matters.
 */
fun Revision.describeTimestamp(): String =
    Instant.ofEpochMilli(modifiedTimeMillis)
        .atZone(ZoneId.systemDefault())
        .toLocalDateTime()
        .toString()
        .replace('T', ' ')
