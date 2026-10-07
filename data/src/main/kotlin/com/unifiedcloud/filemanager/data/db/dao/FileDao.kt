package com.unifiedcloud.filemanager.data.db.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.unifiedcloud.filemanager.data.db.entity.FavoriteFileEntity
import com.unifiedcloud.filemanager.data.db.entity.FileMetadataEntity
import com.unifiedcloud.filemanager.data.db.entity.RecentFileEntity
import com.unifiedcloud.filemanager.data.db.entity.SyncStateEntity
import kotlinx.coroutines.flow.Flow

/**
 * Cached file metadata.
 *
 * ## The rule every query here follows
 *
 * **Every query takes `accountId` and every query filters on it.** There is no
 * query in this DAO that can return another account's rows, so no caller can
 * forget the filter. This is the persistence half of I-1; the other half is that
 * `CloudProvider` requires an account id, so there is no path by which a
 * cross-account read could be requested in the first place.
 *
 * The queries are also shaped to be index-backed rather than merely correct, per
 * `Architecture.md` §9.2: the `ORDER BY` columns match the trailing columns of the
 * matching composite index, so SQLite walks the index instead of sorting the
 * result.
 */
@Dao
interface FileDao {
    // -----------------------------------------------------------------------
    // Listing
    // -----------------------------------------------------------------------

    /**
     * One folder in one account, non-trashed, folders first, newest first.
     *
     * Backed by `idx_file_metadata_listing (account_id, parent_file_id, is_folder,
     * modified_at)`. The `trashed = 0` predicate is applied after the index seek
     * because trashed-ness is not in that index; at the row counts this cache
     * holds that is a cheap filter, and adding it to the index would widen the
     * key for every listing to serve a rarer query.
     */
    @Query(
        "SELECT * FROM file_metadata " +
            "WHERE account_id = :accountId " +
            "AND parent_file_id = :parentFileId " +
            "AND trashed = 0 " +
            "ORDER BY is_folder DESC, modified_at DESC, name COLLATE NOCASE ASC",
    )
    fun observeChildren(
        accountId: Long,
        parentFileId: String?,
    ): Flow<List<FileMetadataEntity>>

    @Query(
        "SELECT * FROM file_metadata " +
            "WHERE account_id = :accountId AND file_id = :fileId LIMIT 1",
    )
    suspend fun findByFileId(
        accountId: Long,
        fileId: String,
    ): FileMetadataEntity?

    @Query(
        "SELECT * FROM file_metadata " +
            "WHERE account_id = :accountId AND local_id = :localId LIMIT 1",
    )
    suspend fun findByLocalId(
        accountId: Long,
        localId: Long,
    ): FileMetadataEntity?

    /**
     * A page of one account's recent files, across all folders.
     *
     * `LIMIT`/`OFFSET` rather than keyset pagination: the recents list is
     * user-scrolled and short-lived, and re-querying after a mutation invalidates
     * an offset in a way that is easy to reason about here. Folder listings, which
     * are long-lived and frequently mutated, use provider page tokens instead.
     */
    @Query(
        "SELECT f.* FROM file_metadata f " +
            "INNER JOIN recent_file r " +
            "ON r.account_id = f.account_id AND r.file_id = f.file_id " +
            "WHERE f.account_id = :accountId AND f.trashed = 0 " +
            "ORDER BY r.last_accessed_at DESC LIMIT :limit OFFSET :offset",
    )
    fun observeRecent(
        accountId: Long,
        limit: Int,
        offset: Int,
    ): Flow<List<FileMetadataEntity>>

    /**
     * Image and video rows in one account, newest first.
     *
     * Backs the gallery. The `mime_type LIKE 'image/%' OR ...` form is used
     * because the gallery is MIME-class based, and the composite index
     * `(account_id, mime_type, modified_at)` still serves the account and ordering
     * parts. A prefix `LIKE` would use the index for the range; a leading
     * wildcard could not, which is the reason for the two-branch form.
     */
    @Query(
        "SELECT * FROM file_metadata " +
            "WHERE account_id = :accountId " +
            "AND trashed = 0 " +
            "AND (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%') " +
            "ORDER BY modified_at DESC LIMIT :limit",
    )
    fun observeMedia(
        accountId: Long,
        limit: Int,
    ): Flow<List<FileMetadataEntity>>

    @Query(
        "SELECT * FROM file_metadata " +
            "WHERE account_id = :accountId AND trashed = 1 " +
            "ORDER BY name COLLATE NOCASE ASC",
    )
    fun observeTrashed(accountId: Long): Flow<List<FileMetadataEntity>>

    @Query(
        "SELECT f.* FROM file_metadata f " +
            "INNER JOIN favorite_file fav " +
            "ON fav.account_id = f.account_id AND fav.file_id = f.file_id " +
            "WHERE f.account_id = :accountId AND f.trashed = 0 " +
            "ORDER BY fav.starred_at DESC",
    )
    fun observeFavorites(accountId: Long): Flow<List<FileMetadataEntity>>

    /**
     * Name search within one account.
     *
     * This is a cache-side convenience filter over rows already held locally. It
     * is **not** the product's search feature: authoritative search is a
     * cross-account provider fan-out with a mandatory `Completeness` disclosure
     * (Phase 10, AR-06). This query exists so an offline or not-yet-synced
     * account can still offer something, and it must never be presented as an
     * exhaustive answer.
     */
    @Query(
        "SELECT * FROM file_metadata " +
            "WHERE account_id = :accountId " +
            "AND trashed = 0 " +
            "AND name LIKE '%' || :query || '%' COLLATE NOCASE " +
            "ORDER BY modified_at DESC LIMIT :limit",
    )
    suspend fun searchByNameLocally(
        accountId: Long,
        query: String,
        limit: Int,
    ): List<FileMetadataEntity>

    // -----------------------------------------------------------------------
    // Writes
    // -----------------------------------------------------------------------

    /**
     * Upserts a page of metadata.
     *
     * `ON CONFLICT DO UPDATE` keyed on the `(account_id, file_id)` unique index,
     * which is what makes a re-synced page idempotent. A `REPLACE` strategy would
     * delete and reinsert, changing `local_id` and breaking the recents and
     * favorites references - so `REPLACE` is wrong here in a way that is not
     * obvious from the signature.
     */
    @Upsert
    suspend fun upsertAll(files: List<FileMetadataEntity>)

    @Upsert
    suspend fun upsert(file: FileMetadataEntity)

    /**
     * Removes one file's cached row.
     *
     * Single query, no ambiguity: the `(account_id, file_id)` unique index makes
     * the target unambiguous and the account predicate makes it unreachable from
     * another account.
     */
    @Query("DELETE FROM file_metadata WHERE account_id = :accountId AND file_id = :fileId")
    suspend fun deleteByFileId(
        accountId: Long,
        fileId: String,
    )

    // -----------------------------------------------------------------------
    // Recents, bounded
    // -----------------------------------------------------------------------

    @Upsert
    suspend fun upsertRecent(recent: RecentFileEntity)

    /**
     * Trims recents to [max] rows for one account, oldest first.
     *
     * The `rowid` form is used rather than a hand-built composite key. An earlier
     * version concatenated `account_id || file_id` to make a single value, which
     * is collision-prone: a file id containing the separator would alias another
     * row and delete the wrong entry. `rowid` is exact.
     *
     * `rowid` is available because the table is not declared `WITHOUT ROWID`.
     *
     * Account-scoped in both the outer and the inner query, so one account's
     * recents can never evict another's. Doing the trim in SQL rather than
     * read-modify-write in Kotlin avoids racing a concurrent access update.
     */
    @Query(
        "DELETE FROM recent_file WHERE account_id = :accountId AND rowid NOT IN (" +
            "SELECT rowid FROM recent_file WHERE account_id = :accountId " +
            "ORDER BY last_accessed_at DESC LIMIT :max)",
    )
    suspend fun pruneRecent(
        accountId: Long,
        max: Int,
    )

    @Transaction
    suspend fun recordAccess(
        accountId: Long,
        fileId: String,
        at: Long,
        max: Int = MAX_RECENT,
    ) {
        upsertRecent(RecentFileEntity(accountId, fileId, at))
        pruneRecent(accountId, max)
    }

    // -----------------------------------------------------------------------
    // Favorites
    // -----------------------------------------------------------------------

    @Upsert
    suspend fun upsertFavorite(favorite: FavoriteFileEntity)

    @Query("DELETE FROM favorite_file WHERE account_id = :accountId AND file_id = :fileId")
    suspend fun deleteFavorite(
        accountId: Long,
        fileId: String,
    )

    // -----------------------------------------------------------------------
    // Sync state
    // -----------------------------------------------------------------------

    @Query("SELECT * FROM sync_state WHERE account_id = :accountId AND scope_key = :scopeKey")
    suspend fun findSyncState(
        accountId: Long,
        scopeKey: String,
    ): SyncStateEntity?

    @Upsert
    suspend fun upsertSyncState(state: SyncStateEntity)

    @Query("DELETE FROM sync_state WHERE account_id = :accountId")
    suspend fun clearSyncState(accountId: Long)

    /**
     * Drops page tokens for one account.
     *
     * Called when a token is rejected. `Architecture.md` §9.2 is explicit that
     * page tokens are advisory and volatile: a stale token must cause the listing
     * to restart, never to be trusted. This is the query that makes that
     * recoverable.
     */
    @Query("DELETE FROM sync_state WHERE account_id = :accountId")
    suspend fun invalidatePageTokens(accountId: Long)

    /** Clears an account's cached files, e.g. on disconnect. Tokens and the account row are untouched. */
    @Query("DELETE FROM file_metadata WHERE account_id = :accountId")
    suspend fun clearCachedFiles(accountId: Long)

    companion object {
        /**
         * Recents bound per account. Bounded because recents are a convenience,
         * not a feature with a retention promise, and an unbounded table is both a
         * slow query and a growing privacy surface.
         */
        const val MAX_RECENT = 200
    }
}
