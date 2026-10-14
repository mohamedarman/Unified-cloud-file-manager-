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
    // Named rather than written inline in the `when` below, because a bare `403`
    // in a mapper is exactly the thing ER-5 warns about: a status code that looks
    // self-explanatory and is not.
    private const val HTTP_UNAUTHORIZED = 401
    private const val HTTP_FORBIDDEN = 403
    private const val HTTP_NOT_FOUND = 404
    private const val HTTP_TOO_MANY_REQUESTS = 429
    private const val HTTP_SERVER_ERROR_FLOOR = 500
    private const val HTTP_SERVER_ERROR_CEILING = 599

    /** `403 userRateLimitExceeded` - see `Architecture.md` §11.1.3. */
    const val REASON_USER_RATE_LIMIT_EXCEEDED = "userRateLimitExceeded"

    /** `403 insufficientStorage` - see `Architecture.md` §12.4. */
    const val REASON_INSUFFICIENT_STORAGE = "insufficientStorage"

    /** `403 insufficientPermissions` - see `Architecture.md` §11.1.3. */
    const val REASON_INSUFFICIENT_PERMISSIONS = "insufficientPermissions"

    /**
     * Fallback backoff when `429` / `userRateLimitExceeded` supplies no
     * `Retry-After` header. Small and courtesy-grade (`Rules.md` RT-4).
     */
    const val DEFAULT_RETRY_AFTER_MILLIS = 2_000L

    /**
     * Maximum backoff allowed from a provider header. Caps absurd values so a
     * single bad response cannot park a worker for days.
     */
    const val MAX_RETRY_AFTER_MILLIS = 300_000L // 5 minutes

    /**
     * Context passed into [map] to supply the domain fields the failure itself
     * does not carry.
     */
    data class DriveOperationContext(
        val accountId: LocalAccountId,
        val fileId: ProviderFileId?,
        val grantedScopesSuffice: Boolean,
    )

    /**
     * The raw HTTP details captured at the OkHttp interceptor boundary.
     */
    data class DriveHttpFailure(
        val httpStatus: Int,
        val reason: String?,
        val retryAfterMillis: Long?,
    )

    /**
     * Maps an HTTP failure to a domain [AppError].
     *
     * Never returns null, never throws, and never returns a success type.
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
            else -> AppError.Unknown("Unclassified HTTP status ${failure.httpStatus}", null)
        }

    /**
     * `401`. Google access tokens expire after one hour; a 401 means the token
     * is dead and must be refreshed (`Architecture.md` §7.3).
     */
    private fun unauthorized(failure: DriveHttpFailure): AppError =
        AppError.TokenRefreshFailed(
            providerId = ProviderId.GOOGLE_DRIVE,
            errorCode = failure.reason,
            httpStatus = failure.httpStatus,
            retryable = true,
            recovery = Recovery.RETRY_TRANSPARENTLY,
        )

    /**
     * `403`, which is three different problems wearing one status code.
     *
     * `Architecture.md` §11.1.3 is explicit that this must be disambiguated by
     * reason. Getting it wrong is the difference between "wait" and "this file
     * isn't yours" and "reconnect your account".
     */
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

    /**
     * The `insufficientPermissions` split. See [map] for why it needs
     * [DriveOperationContext.grantedScopesSuffice].
     */
    private fun insufficientPermissions(context: DriveOperationContext): AppError =
        AppError.Unauthorized(
            if (context.grantedScopesSuffice) {
                PermissionReason.FILE_NOT_SHARED
            } else {
                PermissionReason.SCOPE_INSUFFICIENT
            },
        )

    /**
     * The account's own Drive storage is full (`Architecture.md` §12.4).
     *
     * The byte figures are null because Drive does not put them in the error
     * body - they come from the `about` endpoint, which is a separate request
     * this mapper must not make. Reporting Google's limit as one of our own is
     * exactly the `Rules.md` §1 framing this product may never use, so the
     * figures are omitted rather than guessed.
     */
    private fun storageExhausted(): AppError =
        AppError.QuotaExceeded(
            providerId = ProviderId.GOOGLE_DRIVE,
            scope = QuotaScope.STORAGE,
            limitBytes = null,
            usedBytes = null,
        )

    /**
     * `404`. Drive reports "does not exist" and "exists but is not shared with
     * you" identically, and [AppError.FileNotFound] deliberately does not
     * distinguish them either: telling a user a file does not exist when it does
     * is both a privacy leak and a support burden.
     *
     * `Rules.md` FI-04 then requires the caller to mark the row
     * `syncState = REMOVED` and surface it, rather than silently dropping the
     * user's local record.
     *
     * A `404` with no file id cannot be expressed as a [FileRef] and is not
     * worth inventing one for.
     */
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

    /**
     * A rate limit, from either `429` or the `403 userRateLimitExceeded` disguise.
     *
     * The provider's own guidance is obeyed rather than replaced
     * (`Rules.md` RT-4): if Drive says when it will accept us, substituting our
     * own backoff means the next call fails for a reason we caused.
     */
    private fun rateLimited(failure: DriveHttpFailure): AppError =
        AppError.RateLimited(
            retryAfterMillis =
                (failure.retryAfterMillis ?: DEFAULT_RETRY_AFTER_MILLIS)
                    .coerceIn(0L, MAX_RETRY_AFTER_MILLIS),
        )

    /**
     * Wraps a transport failure.
     *
     * [cause] is supplied already classified by the HTTP layer, which is the only
     * code that knows OkHttp's exception types. Classifying here by class name
     * or message would be guesswork, and `Rules.md` ER-5's principle applies to
     * transport failures too: read the real signal, do not pattern-match a
     * string. **Not yet wired** - `DriveApi` is blocked behind Q-01.
     */
    fun network(
        cause: TransportCause,
        retryable: Boolean,
    ): AppError = AppError.Network(cause = cause, retryable = retryable)

    /**
     * Extracts the `reason` from a Google JSON error body, tolerantly.
     *
     * Returns null for a null or empty body, a body with no `reason`, a
     * truncated body, or a body that is not JSON at all. Null is the honest
     * answer and the caller maps it conservatively.
     */
    fun reasonOf(body: String?): String? =
        body
            ?.let(::stringValueAfterReasonKey)
            ?.takeIf { value -> value.isNotEmpty() && value.all(::isReasonChar) }

    private fun isReasonChar(c: Char): Boolean =
        c.isLetterOrDigit() || c == '_' || c == '-'

    private fun skipWhitespace(text: String, from: Int): Int {
        var i = from
        while (i < text.length && text[i].isWhitespace()) i++
        return i
    }

    private fun stringValueAfterReasonKey(body: String): String? {
        val keyAt = body.indexOf(REASON_KEY)
        if (keyAt < 0) return null
        val colon = skipWhitespace(body, keyAt + REASON_KEY.length)
        if (colon >= body.length || body[colon] != ':') return null
        val quote = skipWhitespace(body, colon + 1)
        if (quote >= body.length || body[quote] != '"') return null
        val endQuote = body.indexOf('"', quote + 1)
        if (endQuote < 0) return null
        return body.substring(quote + 1, endQuote)
    }

    /**
     * Parses a `Retry-After` header in its delay-seconds form.
     *
     * The HTTP-date form is **not** parsed. It requires a date parser, it is not
     * what Drive sends for these limits, and a wrong answer from a lenient date
     * parse is worse than no answer - so the date form yields null and the
     * caller falls back to [DEFAULT_RETRY_AFTER_MILLIS].
     *
     * A malformed or negative value yields null rather than a guess.
     *
     * The result is bounded here rather than only in the caller, because
     * `seconds * 1000` **overflows** for a large-but-parseable value: a header of
     * `"9223372036854775"` parses fine and would wrap to a negative millisecond
     * delay, which is the opposite of what a caller reading it would do. Clamping
     * to [MAX_RETRY_AFTER_MILLIS] first keeps the arithmetic total, and produces
     * the same answer the caller would have produced anyway.
     */
    fun retryAfterMillisOf(headerValue: String?): Long? {
        val text = headerValue?.trim().orEmpty()
        if (text.isEmpty()) return null
        val seconds = text.toLongOrNull() ?: return null
        if (seconds < 0) return null
        return seconds.coerceAtMost(MAX_RETRY_AFTER_SECONDS) * MILLIS_PER_SECOND
    }

    private const val REASON_KEY = "\"reason\""
    private const val MILLIS_PER_SECOND = 1_000L
    private const val MAX_RETRY_AFTER_SECONDS = MAX_RETRY_AFTER_MILLIS / MILLIS_PER_SECOND
}
