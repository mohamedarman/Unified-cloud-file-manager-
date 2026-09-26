package com.unifiedcloud.filemanager.domain.error

import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.ProviderId

/**
 * The single error currency of the domain layer.
 *
 * Providers map their own failures into this taxonomy at the boundary
 * (Architecture.md §21.1). Nothing above `:cloud` - no ViewModel, no screen, no
 * worker - is permitted to interpret an HTTP status code, a `GoogleJsonResponseException`,
 * or any other provider-specific type. That containment is the point: a second
 * provider later must not require touching the UI.
 *
 * Every case carries enough structure for the UI to choose an action without
 * inspecting the cause. In particular, [Unauthorized] carries a [PermissionReason]
 * so the UI can distinguish "this file is not shared with this account" from
 * "this app's scope is too narrow", which are different problems with different
 * fixes (PC-3, PC-4).
 */
sealed interface AppError {

    /**
     * The credential is absent, expired, revoked, or lacks a required scope.
     *
     * [reason] exists to separate a per-file sharing problem from a whole-app
     * scope problem. Collapsing them produces a screen that offers "reconnect
     * your account" for a file the user simply has not been given access to,
     * which is both wrong and alarming.
     */
    data class Unauthorized(
        val reason: PermissionReason,
    ) : AppError

    /**
     * A refresh attempt failed.
     *
     * [retryable] is computed at the boundary, not guessed by the UI. The
     * distinction drives whether the app silently retries on a background worker
     * or surfaces an action to the user.
     */
    data class TokenRefreshFailed(
        val providerId: ProviderId,
        val errorCode: String?,
        val httpStatus: Int?,
        val retryable: Boolean,
        val recovery: Recovery,
    ) : AppError

    /**
     * Transport-level failure. No HTTP response was obtained.
     */
    data class Network(
        val cause: TransportCause,
        val retryable: Boolean,
    ) : AppError

    /**
     * The provider applied client-side throttling.
     *
     * [retryAfterMillis] is the provider's own instruction. The app honours it
     * rather than inventing a backoff, so the two do not fight.
     */
    data class RateLimited(
        val retryAfterMillis: Long,
    ) : AppError

    /**
     * The account's own provider quota is exhausted.
     *
     * Note what this is: the quota belongs to the user's Google account. This app
     * adds nothing to it and can extend nothing (Rules.md §1, PS-1). The message
     * shown to the user must attribute the limit to Google Drive, never to this
     * app and never as an upgrade upsell.
     */
    data class QuotaExceeded(
        val providerId: ProviderId,
        val scope: QuotaScope,
        val limitBytes: Long?,
        val usedBytes: Long?,
    ) : AppError

    /**
     * The file is gone, or was never visible to this account.
     *
     * These are deliberately indistinguishable: Drive reports them the same way,
     * and telling the user "it does not exist" when it exists but is not shared
     * with them is a privacy leak and a support burden.
     */
    data class FileNotFound(
        val ref: FileRef,
    ) : AppError

    /**
     * The provider is temporarily unusable - outage, or the app is being
     * throttled at the service level.
     */
    data class ProviderUnavailable(
        val providerId: ProviderId,
    ) : AppError

    /**
     * Cancelled by the user or by a superseding operation. Not an error state to
     * display; the UI returns to its prior state.
     */
    data object Cancelled : AppError

    /**
     * A failure we could not classify.
     *
     * [message] must already be safe to show and free of tokens, ids, and file
     * names. Sanitisation happens at the boundary that produced the error, not
     * at the point of display (LG-3).
     */
    data class Unknown(
        val message: String?,
        val cause: Throwable?,
    ) : AppError
}

/** Why a credential is not usable. Drives the correct remediation (PC-3, PC-4). */
enum class PermissionReason {
    /** No credential exists for this account. The user must connect it. */
    MISSING,

    /** The credential expired and refresh failed in a way retrying cannot fix. */
    EXPIRED,

    /** The user or provider revoked access. */
    REVOKED,

    /** The credential is valid but its scope is too narrow for this operation. */
    SCOPE_INSUFFICIENT,

    /**
     * The file is not shared with this account. Retrying will never help; the
     * user must be granted access or use a different account.
     */
    FILE_NOT_SHARED,
}

/** What the app can do about an authentication failure. */
enum class Recovery {
    /** Silent refresh and retry. The user should see nothing. */
    RETRY_TRANSPARENTLY,

    /** Prompt the user to re-authorise the account. */
    REAUTHORISE,

    /** Prompt the user to reconnect the account from scratch. */
    RECONNECT,

    /** The failure is terminal for this operation; the user must act elsewhere. */
    NONE,
}

/** Classifies a transport failure without leaking provider specifics upward. */
enum class TransportCause {
    TIMEOUT,
    DNS_FAILURE,
    CONNECTION_REFUSED,
    CONNECTION_RESET,
    TLS_FAILURE,
    NO_NETWORK,
    SOCKET_EXCEPTION,
    UNKNOWN,
}

/**
 * Which provider limit was hit. Kept separate from the app so the UI can never
 * imply the app imposes a limit.
 */
enum class QuotaScope {
    /** The account's total Drive storage. Belongs to Google, not to us. */
    STORAGE,

    /** An API request-rate limit. */
    REQUEST_RATE,

    /** An upload or download daily cap. */
    TRANSFER,
}
