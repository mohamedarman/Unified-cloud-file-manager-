package com.unifiedcloud.filemanager.data.db.mapper

import com.unifiedcloud.filemanager.data.db.entity.ConnectedAccountEntity
import com.unifiedcloud.filemanager.data.db.entity.FileMetadataEntity
import com.unifiedcloud.filemanager.domain.model.AccountRef
import com.unifiedcloud.filemanager.domain.model.CloudFile
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.Freshness
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId

/**
 * Entity ↔ domain mapping.
 *
 * These are the only place the persistence representation and the domain
 * representation meet, which is what keeps the schema free of domain types (see
 * the note in `AccountEntities.kt`) and keeps Room, DAO, and provider types out of
 * the domain layer (Rules.md L-3).
 *
 * Every function that can fail returns [Result] rather than throwing, because a
 * malformed cache row is an expected condition - a downgrade, a partial write, a
 * provider returning a field this version does not understand - and a cache read
 * is not the place for an exception to escape into a coroutine.
 */

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
        fun fromStorage(raw: String?): FileSyncState = entries.firstOrNull { it.name == raw } ?: PENDING
    }
}

/** The UI-facing freshness implied by a row's sync state. */
fun FileSyncState.toFreshness(): Freshness =
    when (this) {
        FileSyncState.SYNCED -> Freshness.FRESH
        FileSyncState.SYNCING -> Freshness.STALE
        FileSyncState.FAILED -> Freshness.STALE
        FileSyncState.PENDING -> Freshness.NONE
        FileSyncState.DELETED -> Freshness.NONE
    }

// -----------------------------------------------------------------------------
// ConnectedAccount
// -----------------------------------------------------------------------------

/**
 * @param providerId the provider this row belongs to, already resolved by the
 *   caller from the stored string. Passed in rather than parsed here so that an
 *   unknown provider is handled once, at the call site that can decide what it
 *   means, rather than in a mapper.
 */
fun ConnectedAccountEntity.toDomain(providerId: ProviderId): Result<AccountRef> =
    runCatching {
        AccountRef(
            localId = LocalAccountId(localId),
            provider = providerId,
            providerAccountId = providerAccountId,
            displayEmail = displayEmail,
        )
    }

// -----------------------------------------------------------------------------
// FileMetadata
// -----------------------------------------------------------------------------

/**
 * Reconstructs the domain file, re-attaching the provider from the account.
 *
 * [providerId] is required because `file_metadata` has no provider column: an
 * account row determines the provider, and duplicating it per file would be
 * denormalised for no query benefit. That also means a file row is meaningless
 * without its account, which the `account_id` foreign key already guarantees.
 */
fun FileMetadataEntity.toDomain(providerId: ProviderId): CloudFile =
    CloudFile(
        ref =
            FileRef(
                provider = providerId,
                accountId = LocalAccountId(accountId),
                fileId = ProviderFileId(fileId),
            ),
        name = name,
        mimeType = mimeType,
        sizeBytes = sizeBytes,
        modifiedTimeMillis = modifiedAt,
        isFolder = isFolder,
        parentFolderId = parentFileId?.let(::ProviderFileId),
        isShared = isShared,
        isOwnedByUser = isOwnedByUser,
        isStarred = isStarred,
        isOfflineAvailable = isOfflineAvailable,
        isTrashed = trashed,
    )

/**
 * The entity form of a domain file.
 *
 * [syncState] is supplied by the caller because it is cache bookkeeping, not a
 * property of the file. A provider-authoritative write passes
 * [FileSyncState.SYNCED]; a locally-predicted one must not claim to be synced.
 */
fun CloudFile.toEntity(
    accountId: LocalAccountId,
    syncState: FileSyncState,
): FileMetadataEntity =
    FileMetadataEntity(
        // localId is deliberately 0: this is an insert-or-update by natural key.
        // Carrying the old surrogate across would be wrong, since upsert resolves on
        // (accountId, fileId).
        localId = 0,
        accountId = accountId.value,
        fileId = ref.fileId.value,
        name = name,
        mimeType = mimeType,
        sizeBytes = sizeBytes,
        modifiedAt = modifiedTimeMillis,
        isFolder = isFolder,
        parentFileId = parentFolderId?.value,
        isShared = isShared,
        isOwnedByUser = isOwnedByUser,
        isStarred = isStarred,
        trashed = isTrashed,
        isOfflineAvailable = isOfflineAvailable,
        syncState = syncState.name,
    )
