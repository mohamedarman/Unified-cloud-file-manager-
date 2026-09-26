package com.unifiedcloud.filemanager.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Cached file metadata, sync state, and the two small join tables.
 *
 * A folder is a [FileMetadataEntity] with `isFolder = true` (`Architecture.md`
 * §9.3). A separate folder table would duplicate every column, add a join to
 * every listing, and create a synchronisation problem for no benefit.
 */

/**
 * Cached metadata for one file in one account.
 *
 * The `UNIQUE(accountId, fileId)` constraint is the single most important
 * declaration in this schema. It is what makes FI-07 structural: the same
 * provider file present in two accounts is two rows that cannot collide, so no
 * merge, upsert, or cache write can ever conflate one account's view of a file
 * with another's.
 *
 * Note that the primary key is a local surrogate rather than the natural
 * `(accountId, fileId)`. That is deliberate: `SyncState` and the two join tables
 * reference files by the natural key, and a surrogate keeps a future re-keying
 * (say, adding `provider` to the natural key) from rewriting every child table.
 * The uniqueness guarantee lives in the UNIQUE index, not in the primary key.
 */
@Entity(
    tableName = "file_metadata",
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        // FI-07. See above.
        Index(
            value = ["account_id", "file_id"],
            unique = true,
            name = "idx_file_metadata_account_file",
        ),
        // Backs the primary listing query: one folder in one account, folders
        // first, most recently modified first. Column order matches the query's
        // ORDER BY so SQLite can walk the index instead of sorting.
        Index(
            value = ["account_id", "parent_file_id", "is_folder", "modified_at"],
            name = "idx_file_metadata_listing",
        ),
        // Backs "images in this account, newest first" for the gallery.
        Index(
            value = ["account_id", "mime_type", "modified_at"],
            name = "idx_file_metadata_mime",
        ),
        Index(value = ["account_id", "trashed"], name = "idx_file_metadata_trashed"),
        Index(value = ["account_id", "name"], name = "idx_file_metadata_name"),
        Index(value = ["account_id", "sync_state"], name = "idx_file_metadata_sync_state"),
    ],
)
data class FileMetadataEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "local_id")
    val localId: Long = 0,

    @ColumnInfo(name = "account_id")
    val accountId: Long,

    /** Provider-issued and opaque. Never parsed, never generated (FI-05). */
    @ColumnInfo(name = "file_id")
    val fileId: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "mime_type")
    val mimeType: String,

    @ColumnInfo(name = "size_bytes")
    val sizeBytes: Long?,

    @ColumnInfo(name = "modified_at")
    val modifiedAt: Long?,

    @ColumnInfo(name = "is_folder")
    val isFolder: Boolean,

    @ColumnInfo(name = "parent_file_id")
    val parentFileId: String?,

    @ColumnInfo(name = "is_shared")
    val isShared: Boolean,

    @ColumnInfo(name = "is_owned_by_user")
    val isOwnedByUser: Boolean,

    @ColumnInfo(name = "is_starred")
    val isStarred: Boolean,

    @ColumnInfo(name = "trashed")
    val trashed: Boolean,

    @ColumnInfo(name = "is_offline_available")
    val isOfflineAvailable: Boolean = false,

    /**
     * How this row's freshness relates to the provider.
     *
     * Stored rather than derived from a timestamp comparison at read time so that
     * "this row is known-stale" is a fact the cache can assert, rather than
     * something each caller re-derives and may get differently.
     */
    @ColumnInfo(name = "sync_state")
    val syncState: String,
)

/**
 * A cached listing cursor for one account and one scope.
 *
 * [scopeKey] is an opaque discriminator chosen by the caller - a folder id, or a
 * sentinel for "recent" / "shared with me". Keeping it opaque here means a new
 * listing type needs no schema change.
 *
 * The page token is treated as **advisory and volatile**. It is a cache
 * optimisation, never a correctness input: a token the provider no longer honours
 * must be detected and the listing restarted, not fed back blindly. See
 * `SyncStateDao` for where that detection happens.
 */
@Entity(
    tableName = "sync_state",
    primaryKeys = ["account_id", "scope_key"],
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["account_id", "last_synced_at"], name = "idx_sync_state_account_synced"),
    ],
)
data class SyncStateEntity(
    @ColumnInfo(name = "account_id")
    val accountId: Long,

    @ColumnInfo(name = "scope_key")
    val scopeKey: String,

    @ColumnInfo(name = "next_page_token")
    val nextPageToken: String?,

    @ColumnInfo(name = "last_synced_at")
    val lastSyncedAt: Long?,
)

/**
 * Recently accessed files, bounded.
 *
 * Pruned oldest-first by [lastAccessedAt] to a bound held in
 * `com.unifiedcloud.filemanager.data.db.dao.FileDao.MAX_RECENT`. Bounded because
 * an unbounded recents list is a slow query and a growing privacy surface.
 */
@Entity(
    tableName = "recent_file",
    primaryKeys = ["account_id", "file_id"],
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["account_id", "last_accessed_at"], name = "idx_recent_file_accessed"),
    ],
)
data class RecentFileEntity(
    @ColumnInfo(name = "account_id")
    val accountId: Long,

    @ColumnInfo(name = "file_id")
    val fileId: String,

    @ColumnInfo(name = "last_accessed_at")
    val lastAccessedAt: Long,
)

/** Starred files. Marked P1 in `Architecture.md` §9.2, which is why it is present but not yet surfaced in the UI. */
@Entity(
    tableName = "favorite_file",
    primaryKeys = ["account_id", "file_id"],
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["account_id", "starred_at"], name = "idx_favorite_file_starred"),
    ],
)
data class FavoriteFileEntity(
    @ColumnInfo(name = "account_id")
    val accountId: Long,

    @ColumnInfo(name = "file_id")
    val fileId: String,

    @ColumnInfo(name = "starred_at")
    val starredAt: Long,
)
