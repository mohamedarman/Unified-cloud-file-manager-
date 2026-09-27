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

    /**
     * `403`, reason `insufficientPermissions`. Drive returns this for two
     * genuinely different problems (see [map] and [DriveOperationContext]).
     */
    const val REASON_INSUFFICIENT_PERMISSIONS = "insufficientPermissions"

    /** `403`, reason `userRateLimitExceeded`. A rate limit wearing a `403`. */
    const val REASON_USER_RATE_LIMIT_EXCEEDED = "userRateLimitExceeded"

    /** `403`, reason `insufficientStorage`. The account's own Drive is full. */
    const val REASON_INSUFFICIENT_STORAGE = "insufficientStorage"

    /**
     * Fallback delay when a rate limit arrives with no usable `Retry-After`.
     *
     * [AppError.RateLimited] carries a non-null delay, so *some* value is needed
     * when the header is missing. This one is **ours**, not Google's: it is a
     * courtesy pause before re-asking, and it is deliberately small so that a
     * missing header costs latency rather than a user staring at a spinner. It
     * is not a quota figure and must never be presented as one - the real quota
     * is unmeasured (V-06, Q-05) and `Rules.md` QD-1 forbids inventing it.
     */
    const val DEFAULT_RETRY_AFTER_MILLIS = 1_000L

    /** Longest `Retry-After` we will believe, so a hostile value cannot hang a worker. */
    const val MAX_RETRY_AFTER_MILLIS = 60_000L

    /**
     * What the caller knows about the operation that failed.
     *
     * [grantedScopesSuffice] is the crux of the `403` ambiguity, and it is an
     * **input rather than something this file can derive**. Drive reports
     * "insufficient permissions" identically whether the file is unshared with
     * the account or the app's grant is too narrow to attempt the operation at
     * all. Only the auth client knows which, because only it has read the real
     * scope grant.
     *
     * The scope *strings* are deliberately absent. `Memory.md` D-1.5 records the
     * exact scope string as UNKNOWN and defers it to Phase 0; hard-coding a
     * remembered scope string here is precisely the failure TK-5 and
     * `Architecture.md` §33.5.6 exist to prevent. The auth layer compares the
     * real grant against the operation's requirement and passes a verdict.
     */
    data class DriveOperationContext(
        val accountId: LocalAccountId,
        val fileId: ProviderFileId?,
        val grantedScopesSuffice: Boolean,
    )

    /**
     * A Drive failure, reduced to the parts that decide the outcome.
     *
     * Assembling this is the HTTP layer's job, which is why [reasonOf] and
     * [retryAfterMillisOf] are separated from [map]: the transport knows how to
     * read a body, and this file knows what a reason means.
     */
    data class DriveHttpFailure(
        val httpStatus: Int,
        val reason: String?,
        val retryAfterMillis: Long?,
    )

    /**
     * Maps a Drive HTTP failure onto exactly one [AppError].
     *
     * The `403` branch is the one that matters. `insufficientPermissions` on its
     * own does not say *whose* permission is missing, so:
     *
     *  - the grant does **not** cover this operation -> [PermissionReason.SCOPE_INSUFFICIENT].
     *    Re-authorising may help, but only by requesting more scope, and that is
     *    a deliberate product decision (D-1.6), not something the UI may assume.
     *  - the grant **does** cover it -> [PermissionReason.FILE_NOT_SHARED]. The
     *    account is authorised; this one file simply is not shared with it.
     *    Retrying cannot help and re-authorising definitely will not.
     *
     * `Rules.md` RT-6 makes both terminal, so the distinction is about telling
     * the user something true, not about what happens next.
     *
     * **An unrecognised reason is never guessed at.** A bare `403` with no
     * parseable body maps to [AppError.Unknown] rather than to a permission or a
     * rate limit. The cost is that a genuine permission denial occasionally
     * renders as a generic error with a reference code. That is the cheaper
     * mistake: the documented failure mode of guessing wrong is
     * "destroy user trust" by telling someone to wait for a request that will
     * never succeed, and [AppError.Unknown] is never retried
     * (`Architecture.md` §21.3), so it cannot become a retry storm either.
     */
    fun map(failure: DriveHttpFailure, context: DriveOperationContext): AppError = when (failure.httpStatus) {
        HTTP_UNAUTHORIZED -> authenticationFailed(failure)
        HTTP_FORBIDDEN -> forbidden(failure, context)
        HTTP_NOT_FOUND -> notFound(context)
        HTTP_TOO_MANY_REQUESTS -> rateLimited(failure)
        in HTTP_SERVER_ERROR_FLOOR..HTTP_SERVER_ERROR_CEILING -> AppError.ProviderUnavailable(ProviderId.GOOGLE_DRIVE)
        else -> AppError.Unknown("Drive returned HTTP ${failure.httpStatus}", null)
    }

    /**
     * `401`. The token was rejected.
     *
     * Declared retryable with [Recovery.RETRY_TRANSPARENTLY] because `Rules.md`
     * RT-5 permits exactly one refresh before the account becomes
     * `AuthorizationRequired`. **The once-per-operation budget is not implemented
     * here** - it belongs to the operation, because TK-6 and SM-1 scope it to a
     * single operation and only the operation knows its own extent. The second
     * failure surfaces as re-authorisation.
     */
    private fun authenticationFailed(failure: DriveHttpFailure): AppError =
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
    private fun forbidden(failure: DriveHttpFailure, context: DriveOperationContext): AppError =
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
    private fun storageExhausted(): AppError = AppError.QuotaExceeded(
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
        val fileId = context.fileId
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
    private fun rateLimited(failure: DriveHttpFailure): AppError = AppError.RateLimited(
        retryAfterMillis = (failure.retryAfterMillis ?: DEFAULT_RETRY_AFTER_MILLIS)
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
    fun network(cause: TransportCause, retryable: Boolean): AppError =
        AppError.Network(cause = cause, retryable = retryable)

    /**
     * Extracts the `reason` from a Google JSON error body, tolerantly.
     *
     * Returns null for a null or empty body, a body with no `reason`, a
     * truncated body, or a body that is not JSON at all. Null is the honest
     * answer and the caller maps it conservatively.
     *
     * Google nests reasons as `error.errors[].reason`; the first `"reason"`
     * pair in the document is the one that describes the failure.
     *
     * Values are returned **as they appear**, with no unescaping. Drive's reason
     * codes are plain identifiers, so the two forms are identical for every
     * reason that matters here; a body carrying `\"` would be malformed as far as
     * this mapper is concerned, and returning a half-unescaped string would be
     * worse than returning it verbatim.
     */
    fun reasonOf(body: String?): String? {
        if (body.isNullOrEmpty()) return null
        val start = quotedValueStart(body, REASON_FIELD) ?: return null
        val end = body.indexOf('"', start)
        return if (end < 0) null else body.substring(start, end)
    }

    /**
     * Index of the first character *inside* the quoted value of [field], or null
     * when the field is absent, is not a field, or its value is not a string.
     *
     * Split out purely to keep both functions under the project's
     * `ReturnCount` ceiling: a single linear scan with six exits is harder to
     * read than a scan with two.
     */
    private fun quotedValueStart(body: String, field: String): Int? {
        val key = body.indexOf(field)
        if (key < 0) return null

        var index = key + field.length
        // Skip whitespace, then require the ':' that makes this a field rather
        // than a substring of some larger value.
        while (index < body.length && body[index].isWhitespace()) index++
        if (index >= body.length || body[index] != ':') return null

        index++
        while (index < body.length && body[index].isWhitespace()) index++
        return if (index < body.length && body[index] == '"') index + 1 else null
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

    private const val REASON_FIELD = "\"reason\""
    private const val MILLIS_PER_SECOND = 1_000L
    private const val MAX_RETRY_AFTER_SECONDS = MAX_RETRY_AFTER_MILLIS / MILLIS_PER_SECOND
}
