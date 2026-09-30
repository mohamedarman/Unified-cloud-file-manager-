package com.unifiedcloud.filemanager.data.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.unifiedcloud.filemanager.data.db.entity.AccountStateEntity
import com.unifiedcloud.filemanager.data.db.entity.ConnectedAccountEntity
import com.unifiedcloud.filemanager.data.db.entity.TokenSetEntity
import kotlinx.coroutines.flow.Flow

/**
 * Account persistence.
 *
 * Every query that touches account-scoped data takes an `accountId` parameter.
 * There is no query here that returns rows for more than one account, because
 * there is no legitimate caller for one (I-1). Making that structural is the
 * point: the isolation rule is enforced by the shape of the DAO rather than by
 * remembering to add a `WHERE` clause.
 */
@Dao
interface AccountDao {
    // -----------------------------------------------------------------------
    // ConnectedAccount
    // -----------------------------------------------------------------------

    @Query("SELECT * FROM connected_account ORDER BY connected_at ASC")
    fun observeAll(): Flow<List<ConnectedAccountEntity>>

    @Query("SELECT * FROM connected_account WHERE local_id = :accountId")
    suspend fun findById(accountId: Long): ConnectedAccountEntity?

    @Query("SELECT * FROM connected_account WHERE is_active = 1 ORDER BY connected_at ASC")
    fun observeActive(): Flow<List<ConnectedAccountEntity>>

    /**
     * Resolves Google's account id to our local id.
     *
     * This is the idempotency check behind reconnection: reconnecting an account
     * already connected must return the existing local id rather than insert a
     * second row, or the user's files split across two half-populated accounts.
     */
    @Query(
        "SELECT * FROM connected_account " +
            "WHERE provider = :provider AND provider_account_id = :providerAccountId LIMIT 1",
    )
    suspend fun findByProviderIdentity(
        provider: String,
        providerAccountId: String,
    ): ConnectedAccountEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(account: ConnectedAccountEntity): Long

    @Upsert
    suspend fun upsert(account: ConnectedAccountEntity)

    @Query("UPDATE connected_account SET is_active = :isActive WHERE local_id = :accountId")
    suspend fun setActive(
        accountId: Long,
        isActive: Boolean,
    )

    /**
     * Removes the account row.
     *
     * Cascades to every child table, which is what makes disconnect complete -
     * see `disconnect` in the repository for the token-deletion step that a
     * foreign key cannot perform.
     */
    @Query("DELETE FROM connected_account WHERE local_id = :accountId")
    suspend fun deleteById(accountId: Long)

    @Query("SELECT COUNT(*) FROM connected_account")
    suspend fun count(): Int

    // -----------------------------------------------------------------------
    // AccountState
    // -----------------------------------------------------------------------

    @Query("SELECT * FROM account_state WHERE account_id = :accountId")
    fun observeState(accountId: Long): Flow<AccountStateEntity?>

    @Upsert
    suspend fun upsertState(state: AccountStateEntity)

    // -----------------------------------------------------------------------
    // TokenSet
    // -----------------------------------------------------------------------

    /**
     * The current credential for an account, or null.
     *
     * Returns the most recent row rather than all of them: rotation leaves
     * history behind, and only the newest is usable. Ordering by `id DESC` is
     * safe here precisely because ids are local and monotonic - unlike provider
     * ids, which carry no ordering (FI-05).
     */
    @Query("SELECT * FROM token_set WHERE account_id = :accountId ORDER BY id DESC LIMIT 1")
    suspend fun findCurrentToken(accountId: Long): TokenSetEntity?

    @Insert
    suspend fun insertToken(token: TokenSetEntity): Long

    /**
     * Retires superseded credentials, keeping [keepId].
     *
     * Called inside the same transaction as the new token insert, so a crash
     * cannot leave an account with no usable credential.
     */
    @Query("DELETE FROM token_set WHERE account_id = :accountId AND id != :keepId")
    suspend fun deleteSupersededTokens(
        accountId: Long,
        keepId: Long,
    )

    @Query("DELETE FROM token_set WHERE account_id = :accountId")
    suspend fun deleteAllTokens(accountId: Long)

    /**
     * Rotates a credential atomically.
     *
     * The transaction is the requirement, not the convenience: inserting the new
     * token and deleting the old one as two statements leaves a window where the
     * account has either no token or two, and the first produces a spurious
     * re-authorisation prompt on a credential that is perfectly valid.
     */
    @Transaction
    suspend fun rotateToken(token: TokenSetEntity) {
        val newId = insertToken(token)
        deleteSupersededTokens(token.accountId, newId)
    }

    /**
     * Replaces the credential set for an account in one step, used when a refresh
     * yields a new token and the old one is known to be dead rather than merely
     * superseded.
     */
    @Transaction
    suspend fun replaceTokens(token: TokenSetEntity) {
        deleteAllTokens(token.accountId)
        insertToken(token)
    }

    @Delete
    suspend fun deleteToken(token: TokenSetEntity)
}
