package com.unifiedcloud.filemanager.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.unifiedcloud.filemanager.data.db.entity.PendingOperationEntity
import kotlinx.coroutines.flow.Flow

/**
 * Durable record of write operations awaiting provider confirmation.
 *
 * The `outcome_uncertain` flag is what this table exists for. An operation that
 * provably never left the device may be retried; one whose outcome is unknown
 * must be **reconciled** against the provider before anything else happens.
 * Treating both as "retry" is how a resumed upload becomes two uploads, and a
 * retried folder creation becomes a duplicate folder the user has to clean up.
 */
@Dao
interface PendingOperationDao {
    /**
     * Outstanding work for one account, oldest first.
     *
     * Ordered oldest-first deliberately: operations are replayed in the order the
     * user issued them, so a rename issued after a move is not applied first.
     */
    @Query(
        "SELECT * FROM pending_operation " +
            "WHERE account_id = :accountId AND state != :terminalState " +
            "ORDER BY created_at ASC",
    )
    fun observeOutstanding(
        accountId: Long,
        terminalState: String = STATE_COMPLETED,
    ): Flow<List<PendingOperationEntity>>

    @Query(
        "SELECT * FROM pending_operation " +
            "WHERE account_id = :accountId AND file_id = :fileId AND state != :terminalState " +
            "ORDER BY created_at ASC",
    )
    suspend fun findOutstandingForFile(
        accountId: Long,
        fileId: String,
        terminalState: String = STATE_COMPLETED,
    ): List<PendingOperationEntity>

    /**
     * Operations whose outcome is unknown, needing reconciliation.
     *
     * Any caller resuming after process death should drain this before issuing
     * retries, because every row here represents a request that may already have
     * taken effect.
     */
    @Query(
        "SELECT * FROM pending_operation " +
            "WHERE account_id = :accountId AND outcome_uncertain = 1 " +
            "ORDER BY created_at ASC",
    )
    suspend fun findUncertain(accountId: Long): List<PendingOperationEntity>

    @Query("SELECT * FROM pending_operation WHERE state = :state ORDER BY created_at ASC")
    suspend fun findByState(state: String): List<PendingOperationEntity>

    @Query("SELECT * FROM pending_operation WHERE id = :id")
    suspend fun findById(id: Long): PendingOperationEntity?

    /**
     * `ABORT`, not `REPLACE`.
     *
     * Two outstanding operations on the same file is a real state that the
     * reconciliation logic needs to see. A replacing insert would silently
     * collapse them and lose whichever was written first, turning a detectable
     * duplicate into an invisible one.
     */
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(operation: PendingOperationEntity): Long

    @Update
    suspend fun update(operation: PendingOperationEntity)

    @Query("UPDATE pending_operation SET state = :state WHERE id = :id")
    suspend fun setState(
        id: Long,
        state: String,
    )

    @Query(
        "UPDATE pending_operation SET state = :state, outcome_uncertain = 0, " +
            "last_attempt_at = :at, attempt_count = attempt_count + 1 WHERE id = :id",
    )
    suspend fun recordAttempt(
        id: Long,
        state: String,
        at: Long,
    )

    @Query("DELETE FROM pending_operation WHERE id = :id")
    suspend fun deleteById(id: Long)

    /**
     * Prunes completed rows.
     *
     * Terminal states only. Pruning a row that is still outstanding would discard
     * an operation the user asked for, and a retried write that never happened is
     * worse than a slow table.
     */
    @Query(
        "DELETE FROM pending_operation WHERE state IN (:terminalStates) " +
            "AND last_attempt_at < :olderThan",
    )
    suspend fun pruneTerminal(
        terminalStates: List<String>,
        olderThan: Long,
    )

    @Query("SELECT COUNT(*) FROM pending_operation WHERE account_id = :accountId AND state != :terminalState")
    suspend fun countOutstanding(
        accountId: Long,
        terminalState: String = STATE_COMPLETED,
    ): Int

    companion object {
        // Operation kinds, as strings rather than ordinals: an ordinal shift
        // would silently re-decode persisted rows as a different operation.
        const val OP_RENAME = "RENAME"
        const val OP_MOVE = "MOVE"
        const val OP_COPY = "COPY"
        const val OP_TRASH = "TRASH"
        const val OP_RESTORE = "RESTORE"
        const val OP_CREATE_FOLDER = "CREATE_FOLDER"
        const val OP_UPLOAD = "UPLOAD"
        const val OP_DELETE_PERMANENTLY = "DELETE_PERMANENTLY"

        const val STATE_PENDING = "PENDING"
        const val STATE_IN_FLIGHT = "IN_FLIGHT"
        const val STATE_COMPLETED = "COMPLETED"
        const val STATE_FAILED = "FAILED"
        const val STATE_RECONCILED = "RECONCILED"

        /**
         * States safe to prune. `FAILED` is deliberately absent: a failed
         * operation the user may still retry is not garbage.
         */
        val PRUNABLE_STATES = listOf(STATE_COMPLETED, STATE_RECONCILED)
    }
}
