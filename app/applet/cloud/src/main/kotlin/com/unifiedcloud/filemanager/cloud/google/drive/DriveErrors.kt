package com.unifiedcloud.filemanager.cloud.google.drive

import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.error.PermissionReason
import com.unifiedcloud.filemanager.domain.error.QuotaScope
import com.unifiedcloud.filemanager.domain.error.Recovery
import com.unifiedcloud.filemanager.domain.error.TransportCause
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId

/**
 * Maps a Drive HTTP failure onto exactly one [AppError].
 *
 * This is the whole point of the file. `Architecture.md` §11.1.3 and `Rules.md`
 * ER-5 both say the same thing: **a `403` is ambiguous with rate limiting, and
 * the reason must be read rather than the status code assumed.** Guessing here
 * produces the two failures this product can least afford - telling a user to
 * reconnect an account that is fine, and telling them to wait when the request
 * will never succeed.
 *
 * Everything above `:cloud` is forbidden from interpreting an HTTP status
 * (`Rules.md` PC-5). So the containment is total: after this function runs, no
 * `403`, no JSON body, and no Drive reason string exists above this line.
 *
 * **Deliberately not a JSON parser.** [reasonOf] scans for the one field that
 * matters and returns null when it is absent, malformed, or truncated. A general
 * parser would throw on a body this function is required to survive - an HTML
 * error page from an intercepting proxy, an empty body, a truncated response -
 * and a mapper that throws on garbage is a mapper that loses the original
 * failure. Null is a valid, meaningful answer here, not an error.
 *
 * The reason strings handled below are the ones named in `Architecture.md`
 * §11.1.3 and §12.4: `insufficientPermissions`, `userRateLimitExceeded`, and
 * `insufficientStorage`. **Any other reason is not guessed at** - see
 * [map] and [AppError.Unknown].
 */
object DriveErrors {
    private const val HTTP_UNAUTHORIZED = 401
    private const val HTTP_FORBIDDEN = 403
    private const val HTTP_NOT_FOUND = 404
    private const val HTTP_TOO_MANY_REQUESTS = 429
    private const val HTTP_SERVER_ERROR_FLOOR = 500
    private const val HTTP_SERVER_ERROR_CEILING = 599

    /**
     * `403`, reason `insufficientPermissions`. Drive returns this for two
     * genuinely different problems (see [map] and [DriveOperationContext]).
     */
    const val REASON_INSUFFICIENT_PERMISSIONS = "insufficientPermissions"

    /** `403`, reason `userRateLimitExceeded`. A rate limit wearing a `403`. */
    const val REASON_USER_RATE_LIMIT_EXCEEDED = "userRateLimitExceeded"

    /** `403`, reason `insufficientStorage`. The account's own Drive is full. */
    const val REASON_INSUFFICIENT_STORAGE = "insufficientStorage"

    /** Default fallback delay when `429` carries no `Retry-After` header. */
    const val DEFAULT_RETRY_AFTER_MILLIS = 1_000L

    /** Maximum allowed backoff delay (1 hour) to keep workers responsive. */
    const val MAX_RETRY_AFTER_MILLIS = 3_600_000L

    /** Input wrapper for HTTP failure parameters. */
    data class DriveHttpFailure(
        val httpStatus: Int,
        val reason: String?,
        val retryAfterMillis: Long?,
    )

    /** Operational context required to map 403/404 errors accurately. */
    data class DriveOperationContext(
        val accountId: LocalAccountId,
        val fileId: ProviderFileId?,
        val grantedScopesSuffice: Boolean,
    )

    /**
     * Maps an HTTP failure and context into an [AppError].
     */
    fun map(
        failure: DriveHttpFailure,
        context: DriveOperationContext,
    ): AppError =
        when (failure.httpStatus) {
            HTTP_UNAUTHORIZED -> unauthorized(failure)
            HTTP_FORBIDDEN -> forbidden(failure, context)
            HTTP_NOT_FOUND -> notFound(context)
            HTTP_TOO_MANY_REQUESTS -> rateLimited(failure)
            in HTTP_SERVER_ERROR_FLOOR..HTTP_SERVER_ERROR_CEILING ->
                AppError.ProviderUnavailable(ProviderId.GOOGLE_DRIVE)
            else -> AppError.Unknown("Unclassified Drive HTTP ${failure.httpStatus}", null)
        }

    private fun unauthorized(failure: DriveHttpFailure): AppError =
        AppError.TokenRefreshFailed(
            providerId = ProviderId.GOOGLE_DRIVE,
            errorCode = failure.reason,
            httpStatus = failure.httpStatus,
            retryable = true,
            recovery = Recovery.RETRY_TRANSPARENTLY,
        )

    private fun forbidden(
        failure: DriveHttpFailure,
        context: DriveOperationContext,
    ): AppError =
        when (failure.reason) {
            REASON_USER_RATE_LIMIT_EXCEEDED -> rateLimited(failure)
            REASON_INSUFFICIENT_STORAGE -> storageExhausted()
            REASON_INSUFFICIENT_PERMISSIONS -> insufficientPermissions(context)
            else -> AppError.Unknown("Drive returned an unrecognised 403 reason", null)
        }

    private fun insufficientPermissions(context: DriveOperationContext): AppError =
        AppError.Unauthorized(
            if (context.grantedScopesSuffice) {
                PermissionReason.FILE_NOT_SHARED
            } else {
                PermissionReason.SCOPE_INSUFFICIENT
            },
        )

    private fun storageExhausted(): AppError =
        AppError.QuotaExceeded(
            providerId = ProviderId.GOOGLE_DRIVE,
            scope = QuotaScope.STORAGE,
            limitBytes = null,
            usedBytes = null,
        )

    private fun notFound(context: DriveOperationContext): AppError {
        val fileId =
            context.fileId
                ?: return AppError.Unknown("Drive returned 404 for an operation with no file id", null)
        return AppError.FileNotFound(
            FileRef(
                provider = ProviderId.GOOGLE_DRIVE,
                accountId = context.accountId,
                fileId = fileId,
            ),
        )
    }

    private fun rateLimited(failure: DriveHttpFailure): AppError =
        AppError.RateLimited(
            retryAfterMillis =
                (failure.retryAfterMillis ?: DEFAULT_RETRY_AFTER_MILLIS)
                    .coerceIn(0L, MAX_RETRY_AFTER_MILLIS),
        )

    /** Wraps a transport failure. */
    fun network(
        cause: TransportCause,
        retryable: Boolean,
    ): AppError = AppError.Network(cause = cause, retryable = retryable)

    /**
     * Extracts the `reason` from a Google JSON error body tolerantly.
     */
    fun reasonOf(body: String?): String? =
        body
            ?.takeIf { it.isNotBlank() }
            ?.let(::stringValueAfterReasonKey)
            ?.takeIf { it.isNotEmpty() }

    private fun stringValueAfterReasonKey(body: String): String? {
        val keyIndex = body.indexOf("\"reason\"")
        val afterKey = if (keyIndex != -1) body.substring(keyIndex + 8) else ""
        val colonIndex = afterKey.indexOf(':')
        val between = if (colonIndex != -1) afterKey.substring(0, colonIndex) else "invalid"
        val trimmed = if (colonIndex != -1 && between.all { it.isWhitespace() }) {
            afterKey.substring(colonIndex + 1).trimStart()
        } else {
            ""
        }
        if (!trimmed.startsWith('"')) return null

        var endQuote = 1
        while (endQuote < trimmed.length) {
            val ch = trimmed[endQuote]
            if (ch == '\\') {
                endQuote += 2
            } else if (ch == '"') {
                return trimmed.substring(1, endQuote)
            } else {
                endQuote++
            }
        }
        return null
    }

    /**
     * Parses a `Retry-After` header in delay-seconds form.
     */
    fun retryAfterMillisOf(headerValue: String?): Long? {
        val text = headerValue?.trim().orEmpty()
        if (text.isEmpty()) return null
        val seconds = text.toLongOrNull() ?: return null
        if (seconds < 0) return null
        return seconds.coerceAtMost(MAX_RETRY_AFTER_SECONDS) * MILLIS_PER_SECOND
    }

    private const val MILLIS_PER_SECOND = 1_000L
    private const val MAX_RETRY_AFTER_SECONDS = MAX_RETRY_AFTER_MILLIS / MILLIS_PER_SECOND
}
