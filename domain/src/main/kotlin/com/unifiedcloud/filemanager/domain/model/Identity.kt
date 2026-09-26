package com.unifiedcloud.filemanager.domain.model

/**
 * Identity types.
 *
 * These are distinct value classes rather than bare `String` or `Long` so that
 * the compiler rejects the mistakes this product cannot afford:
 *
 *  - passing a provider file id where a local account id is expected
 *  - passing an account id where a provider id is expected
 *  - comparing two provider file ids for equality as though they were
 *    meaningful across accounts (FI-07)
 *
 * The isolation invariants (I-1…I-8) are enforced primarily by the *shape* of
 * this API rather than by discipline. Making the types distinct is the cheapest
 * and most durable part of that enforcement.
 */

/**
 * Identifies a cloud provider implementation.
 *
 * Structural: the value is chosen by us, not by the provider.
 */
@JvmInline
value class ProviderId(val value: String) {
    init {
        require(value.isNotBlank()) { "ProviderId must not be blank" }
    }

    companion object {
        val GOOGLE_DRIVE = ProviderId("GOOGLE_DRIVE")
    }

    override fun toString(): String = value
}

/**
 * Identifies a connected account *on this device*.
 *
 * This is our identifier, assigned when the user connects an account. It is NOT
 * a Google account id, an email address, or anything the provider issued. It is
 * the only account identifier permitted to cross into a provider call (I-1).
 */
@JvmInline
value class LocalAccountId(val value: Long) {
    init {
        require(value > 0) { "LocalAccountId must be positive" }
    }

    override fun toString(): String = "acct#$value"
}

/**
 * A file id as issued by the provider.
 *
 * OPAQUE. Never parse it, never infer structure from it, never generate it, and
 * never assume it is small, sequential, or meaningful (FI-05). It is not unique
 * across accounts: the same file shared with two accounts produces two distinct
 * [FileRef]s and they must never be merged (FI-07).
 */
@JvmInline
value class ProviderFileId(val value: String) {
    init {
        require(value.isNotBlank()) { "ProviderFileId must not be blank" }
    }

    /** Redacted: a file id is not a secret, but it is not for logs either. */
    override fun toString(): String = "file(${value.take(6)}…)"
}

/**
 * A connected account as presented to the domain.
 *
 * [providerAccountId] is the provider's own identifier for the account. It is
 * never used to address a provider call - only [localId] is (I-1).
 */
data class AccountRef(
    val localId: LocalAccountId,
    val provider: ProviderId,
    val providerAccountId: String,
    val displayEmail: String?,
)

/**
 * The canonical identity of a file. The only accepted currency for provider
 * operations, deep links, and cache keys.
 *
 * Two files are the same file if and only if all three components match. This is
 * what makes FI-07 structural rather than a rule to remember: the same provider
 * file in two accounts is two `FileRef`s because the account component differs.
 */
data class FileRef(
    val provider: ProviderId,
    val accountId: LocalAccountId,
    val fileId: ProviderFileId,
) {
    init {
        require(accountId.value > 0) { "FileRef requires a valid accountId (I-1)" }
    }

    /**
     * Cache key component. Account-scoped by construction, so FI-06 cannot be
     * violated by constructing a key that omits the account.
     */
    fun cacheKey(): String = "${provider.value}:${accountId.value}:${fileId.value}"

    override fun toString(): String = "FileRef(${provider.value}, acct#${accountId.value}, ${fileId})"
}

/**
 * Convenience for referring to a file whose provider is already implied by the
 * account. Prevents mixing a file id from one provider with an account from
 * another.
 */
fun accountFileRef(account: AccountRef, fileId: ProviderFileId): FileRef =
    FileRef(provider = account.provider, accountId = account.localId, fileId = fileId)
