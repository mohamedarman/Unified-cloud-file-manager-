package com.unifiedcloud.filemanager.data.db.mapper

/**
 * Sync state of a cached row.
 *
 * Distinct from the domain's [Freshness]: this is the row's own bookkeeping, and
 * it records states a reader never sees ([SYNCING], [FAILED]) as well as the two
 * the UI cares about. Collapsing them would mean a failed row looked merely
 * stale, and would be re-fetched forever without anything surfacing the failure.
 */
enum class FileSyncState {
    /** Never fetched. */
    PENDING,

    /** Row reflects the provider as of `modified_at`. */
    SYNCED,

    /** A fetch is in flight. */
    SYNCING,

    /** The last fetch failed. Distinct from stale: retrying may not help. */
    FAILED,

    /** The provider no longer has this file. */
    DELETED,
    ;

    companion object {
        /**
         * Parses a persisted value, falling back to [PENDING].
         *
         * A row written by a future version with a state this version does not
         * know must not crash the read path. Treating an unrecognised state as
         * `PENDING` is the safe direction: it causes a re-fetch, which is
         * wasteful but correct, rather than trusting a state whose meaning is
         * unknown.
         */
        fun fromPersisted(value: String?): FileSyncState =
            values().find { it.name == value } ?: PENDING
    }
}
