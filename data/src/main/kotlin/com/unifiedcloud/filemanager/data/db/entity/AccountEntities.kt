package com.unifiedcloud.filemanager.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Account-scoped persistence entities (Phase 6).
 *
 * ## Why columns are primitives, not domain value classes
 *
 * `accountId` is a `Long` here, not a `LocalAccountId`, and `provider` is a
 * `String`, not a `ProviderId`. The domain types are reconstructed by mappers at
 * the boundary.
 *
 * That is deliberate. A value class in an `@Entity` couples the on-disk schema to
 * a Kotlin type that exists to make *call sites* safe; the database has no call
 * sites and no compiler to catch a mistake. It also means renaming or
 * re-representing a domain id cannot silently rewrite a column type. The safety
 * the value classes buy is kept where it pays - in the code that calls the
 * provider - and not spent on the schema.
 *
 * Entity and index layout follows `Architecture.md` §9.2. §9.3 (folders are
 * `FileMetadata` rows with `isFolder = true`, not a separate table) is a decision
 * recorded to prevent it being re-litigated.
 */

/**
 * A cloud account the user has connected on this device.
 *
 * [localId] is ours and is the only account identifier ever passed to a provider
 * (I-1). [providerAccountId] is Google's identifier for the same account; it is
 * stored to detect a duplicate connection and is never used to address a call.
 */
@Entity(
    tableName = "connected_account",
    indices = [
        // Uniqueness here is what stops a user connecting the same Google account
        // twice and seeing their files split across two half-populated entries.
        Index(
            value = ["provider", "provider_account_id"],
            unique = true,
            name = "idx_connected_account_provider_identity",
        ),
        Index(value = ["is_active"], name = "idx_connected_account_is_active"),
    ],
)
data class ConnectedAccountEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "local_id")
    val localId: Long = 0,

    @ColumnInfo(name = "provider")
    val provider: String,

    @ColumnInfo(name = "provider_account_id")
    val providerAccountId: String,

    /** Null rather than an empty string: "no address on file" is a real state. */
    @ColumnInfo(name = "display_email")
    val displayEmail: String?,

    @ColumnInfo(name = "is_active")
    val isActive: Boolean,

    @ColumnInfo(name = "connected_at")
    val connectedAt: Long,
)

/**
 * Per-account runtime state, one row per account.
 *
 * Kept separate from [ConnectedAccountEntity] because the two have different
 * lifetimes and different write rates: the account row is written on connect and
 * disconnect, this one on every scope refresh and capability change. Merging them
 * would mean a routine state update rewrites the identity row.
 */
@Entity(
    tableName = "account_state",
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            // Disconnecting must remove the state, or a stale row could outlive
            // the account it describes and resurface on reconnect.
            onDelete = ForeignKey.CASCADE,
        ),
    ],
)
data class AccountStateEntity(
    @PrimaryKey
    @ColumnInfo(name = "account_id")
    val accountId: Long,

    @ColumnInfo(name = "last_capabilities_at")
    val lastCapabilitiesAt: Long?,

    @ColumnInfo(name = "granted_scope")
    val grantedScope: String?,

    @ColumnInfo(name = "quota_used_bytes")
    val quotaUsedBytes: Long?,

    @ColumnInfo(name = "quota_limit_bytes")
    val quotaLimitBytes: Long?,
)

/**
 * An encrypted credential set.
 *
 * Modelled 1:* with [ConnectedAccountEntity] to allow rotation history: a token
 * refresh can write a new row while the old one is still being retired, and a
 * single-row model cannot represent that without a window where the account has
 * no usable credential.
 *
 * [ciphertext] holds only ciphertext. No column here holds an access token,
 * refresh token, or expiry in plaintext (SEC-02, TK-2). Whether the encryption
 * is adequate is Phase 8 / AR-15's subject - raw `EncryptedSharedPreferences`
 * deletion does not remove key material, which would break the disconnect
 * guarantee, and that is a known open item rather than a settled design.
 */
@Entity(
    tableName = "token_set",
    foreignKeys = [
        ForeignKey(
            entity = ConnectedAccountEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["account_id"], name = "idx_token_set_account_id"),
    ],
)
data class TokenSetEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0,

    @ColumnInfo(name = "account_id")
    val accountId: Long,

    /** Opaque encrypted blob. Never logged, never in a crash report, never in an error message. */
    @ColumnInfo(name = "ciphertext")
    val ciphertext: ByteArray,

    @ColumnInfo(name = "iv")
    val iv: ByteArray,

    /** Expiry of the wrapped credential, in epoch millis. Nullable: no known expiry is a real state. */
    @ColumnInfo(name = "expires_at")
    val expiresAt: Long?,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,
) {
    // ByteArray in a data class breaks generated equals/hashCode, which would make
    // Room and Kotlin silently disagree about whether two rows are the same.
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is TokenSetEntity) return false
        return id == other.id &&
            accountId == other.accountId &&
            ciphertext.contentEquals(other.ciphertext) &&
            iv.contentEquals(other.iv) &&
            expiresAt == other.expiresAt &&
            createdAt == other.createdAt
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + accountId.hashCode()
        result = 31 * result + ciphertext.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + (expiresAt?.hashCode() ?: 0)
        result = 31 * result + createdAt.hashCode()
        return result
    }
}
