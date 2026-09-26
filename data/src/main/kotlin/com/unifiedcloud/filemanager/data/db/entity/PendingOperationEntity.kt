package com.unifiedcloud.filemanager.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * A write operation the user requested that has not yet been confirmed by the
 * provider.
 *
 * This table exists because a rename, move, or upload can be requested and then
 * lose the race with process death, app backgrounding, or a dropped connection.
 * Without a durable record of the intent, the app would either lose the operation
 * silently or - worse, and much more commonly - repeat it on reconnect and
 * produce a second folder or a second upload.
 *
 * That is why [payload] holds the intended parameters rather than just a type
 * tag. On restart the operation is reconstructed from this row and reconciled
 * against the provider's actual state rather than blindly re-issued. The
 * reconciliation rule is the one that matters: **an operation of uncertain
 * outcome must be checked, not retried** (X-1, and the duplicate-upload hazard
 * called out in `Architecture.md` §12).
 *
 * Rows are pruned once confirmed. An unbounded table is a slow query and an
 * unbounded source of "why is the app doing that" bugs.
 */
@Entity(
    tableName = "pending_operation",
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        // The resume query: "what is outstanding for this account, oldest first".
        Index(
            value = ["account_id", "state", "created_at"],
            name = "idx_pending_operation_resume",
        ),
        // The retry sweep: "what is in a failed state, regardless of account".
        Index(value = ["state"], name = "idx_pending_operation_state"),
    ],
)
data class PendingOperationEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0,

    @ColumnInfo(name = "account_id")
    val accountId: Long,

    /**
     * Operation discriminator: `RENAME`, `MOVE`, `COPY`, `TRASH`, `RESTORE`,
     * `CREATE_FOLDER`, `UPLOAD`, `DELETE_PERMANENTLY`.
     *
     * Stored as a string rather than an enum ordinal on purpose. Ordinals break
     * silently when a value is inserted mid-list: old rows decode to the wrong
     * operation, and a queued `DELETE_PERMANENTLY` decoding as `TRASH` is not a
     * recoverable bug.
     */
    @ColumnInfo(name = "operation")
    val operation: String,

    /** The file this concerns. Nullable only for `CREATE_FOLDER`, which has no parent file yet. */
    @ColumnInfo(name = "file_id")
    val fileId: String?,

    /** Intended parameters, opaque to the database. Never contains a token. */
    @ColumnInfo(name = "payload")
    val payload: String?,

    @ColumnInfo(name = "state")
    val state: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "last_attempt_at")
    val lastAttemptAt: Long?,

    @ColumnInfo(name = "attempt_count")
    val attemptCount: Int = 0,

    /**
     * True when the request may have reached the provider but the outcome is
     * unknown.
     *
     * This flag is the whole reason the table exists. An operation with an
     * uncertain outcome must be **reconciled** - ask the provider what happened -
     * whereas a failure known to have happened before the request was sent may be
     * retried directly. Conflating the two is how a retried upload becomes two
     * uploads.
     */
    @ColumnInfo(name = "outcome_uncertain")
    val outcomeUncertain: Boolean = false,
)
