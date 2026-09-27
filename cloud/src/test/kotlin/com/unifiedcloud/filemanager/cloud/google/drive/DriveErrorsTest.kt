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
import com.unifiedcloud.filemanager.domain.usecase.RetryDecision
import com.unifiedcloud.filemanager.domain.usecase.TransferRetryPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `Rules.md` ER-5, `Architecture.md` §11.1.3.
 *
 * The load-bearing assertion in this file is that a `403` is resolved by
 * **reason**, never by status code. A regression that maps every `403` to a
 * permission error, or every `403` to a rate limit, is the defect these tests
 * exist to catch, and neither would be visible from a status code alone.
 */
class DriveErrorsTest {

    private val account = LocalAccountId(1)
    private val file = ProviderFileId("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")

    private fun context(
        fileId: ProviderFileId? = file,
        grantedScopesSuffice: Boolean = true,
    ) = DriveErrors.DriveOperationContext(
        accountId = account,
        fileId = fileId,
        grantedScopesSuffice = grantedScopesSuffice,
    )

    private fun failure(status: Int, reason: String? = null, retryAfter: Long? = null) =
        DriveErrors.DriveHttpFailure(
            httpStatus = status,
            reason = reason,
            retryAfterMillis = retryAfter,
        )

    // --- 403: the reason is the whole point ---------------------------------

    @Test
    fun `403 with insufficientPermissions and an adequate grant is FILE_NOT_SHARED`() {
        val error = DriveErrors.map(
            failure(403, DriveErrors.REASON_INSUFFICIENT_PERMISSIONS),
            context(grantedScopesSuffice = true),
        )

        assertEquals(AppError.Unauthorized(PermissionReason.FILE_NOT_SHARED), error)
    }

    @Test
    fun `403 with insufficientPermissions and an inadequate grant is SCOPE_INSUFFICIENT`() {
        val error = DriveErrors.map(
            failure(403, DriveErrors.REASON_INSUFFICIENT_PERMISSIONS),
            context(grantedScopesSuffice = false),
        )

        assertEquals(AppError.Unauthorized(PermissionReason.SCOPE_INSUFFICIENT), error)
    }

    @Test
    fun `the two insufficientPermissions outcomes are not the same error`() {
        // The whole reason PermissionReason carries a FILE_NOT_SHARED case: one
        // is fixed by the file's owner, the other by changing the app's grant.
        // Collapsing them tells a user to reconnect for a file they were simply
        // never given.
        val shared = DriveErrors.map(
            failure(403, DriveErrors.REASON_INSUFFICIENT_PERMISSIONS),
            context(grantedScopesSuffice = true),
        )
        val scope = DriveErrors.map(
            failure(403, DriveErrors.REASON_INSUFFICIENT_PERMISSIONS),
            context(grantedScopesSuffice = false),
        )

        assertNotEquals(shared, scope)
    }

    @Test
    fun `403 userRateLimitExceeded is a rate limit, not a permission error`() {
        // ER-5 in its purest form. Mapping this to a permission error produces an
        // unactionable message and, worse, invites a reconnect that fixes nothing.
        val error = DriveErrors.map(
            failure(403, DriveErrors.REASON_USER_RATE_LIMIT_EXCEEDED, retryAfter = 5_000),
            context(),
        )

        assertEquals(AppError.RateLimited(5_000), error)
    }

    @Test
    fun `403 insufficientStorage is a quota failure, not a permission error`() {
        val error = DriveErrors.map(
            failure(403, DriveErrors.REASON_INSUFFICIENT_STORAGE),
            context(),
        )

        assertTrue(error is AppError.QuotaExceeded)
    }

    @Test
    fun `a storage 403 reports no byte figures`() {
        // Drive does not put them in the error body. Inventing them would mean
        // asserting a number about Google's quota that we never measured
        // (V-06, QD-1) and could present as a capacity claim.
        val error = DriveErrors.map(
            failure(403, DriveErrors.REASON_INSUFFICIENT_STORAGE),
            context(),
        ) as AppError.QuotaExceeded

        assertNull(error.limitBytes)
        assertNull(error.usedBytes)
        assertEquals(QuotaScope.STORAGE, error.scope)
        assertEquals(ProviderId.GOOGLE_DRIVE, error.providerId)
    }

    @Test
    fun `an unrecognised 403 reason is not guessed at`() {
        val error = DriveErrors.map(failure(403, "someFutureReasonWeHaveNeverSeen"), context())

        assertTrue("expected a refusal to classify, got $error", error is AppError.Unknown)
    }

    @Test
    fun `a bare 403 with no reason is not reported as a rate limit`() {
        // The specific mistake ER-5 warns about. An unclassifiable 403 must not
        // become "wait and retry", which would be both unactionable and, if it
        // were retried, a retry storm against a permanent refusal.
        val error = DriveErrors.map(failure(403, reason = null), context())

        assertNotEquals(AppError.RateLimited(1_000), error)
    }

    @Test
    fun `a bare 403 with no reason is not retried`() {
        val error = DriveErrors.map(failure(403, reason = null), context())

        val decision = TransferRetryPolicy.decide(error, attempt = 1)

        assertTrue("an unclassifiable 403 must surface, got $decision", decision is RetryDecision.Surface)
    }

    // --- 401 ----------------------------------------------------------------

    @Test
    fun `401 is retryable exactly once via a transparent refresh`() {
        val error = DriveErrors.map(failure(401, "authError"), context())

        assertEquals(
            AppError.TokenRefreshFailed(
                providerId = ProviderId.GOOGLE_DRIVE,
                errorCode = "authError",
                httpStatus = 401,
                retryable = true,
                recovery = Recovery.RETRY_TRANSPARENTLY,
            ),
            error,
        )
    }

    @Test
    fun `a 401 with no reason still maps rather than escaping as a raw exception`() {
        // PC-5: raw provider exceptions must not escape.
        val error = DriveErrors.map(failure(401, reason = null), context())

        assertTrue(error is AppError.TokenRefreshFailed)
    }

    // --- 404 ----------------------------------------------------------------

    @Test
    fun `404 becomes FileNotFound carrying the full FileRef`() {
        val error = DriveErrors.map(failure(404, "notFound"), context())

        assertEquals(
            AppError.FileNotFound(
                FileRef(
                    provider = ProviderId.GOOGLE_DRIVE,
                    accountId = account,
                    fileId = file,
                ),
            ),
            error,
        )
    }

    @Test
    fun `404 does not claim the file does not exist rather than being unshared`() {
        // Drive reports both identically. The taxonomy deliberately refuses to
        // distinguish them, so a test asserting a "does not exist" message would
        // be asserting a privacy leak.
        val error = DriveErrors.map(failure(404, "notFound"), context())

        assertTrue(
            "a 404 must not be reported as a permission problem",
            error !is AppError.Unauthorized,
        )
    }

    @Test
    fun `a 404 with no file id is not dressed up with an invented one`() {
        val error = DriveErrors.map(failure(404, "notFound"), context(fileId = null))

        assertTrue("expected a refusal to classify, got $error", error is AppError.Unknown)
    }

    // --- 429 ----------------------------------------------------------------

    @Test
    fun `429 obeys the retry guidance the provider supplies`() {
        // RT-4. Substituting our own backoff for a provider-supplied delay means
        // the next call fails for a reason we caused.
        val error = DriveErrors.map(failure(429, "rateLimitExceeded", retryAfter = 30_000), context())

        assertEquals(AppError.RateLimited(30_000), error)
    }

    @Test
    fun `429 without guidance falls back to our own small courtesy delay`() {
        val error = DriveErrors.map(failure(429, "rateLimitExceeded"), context())

        assertEquals(AppError.RateLimited(DriveErrors.DEFAULT_RETRY_AFTER_MILLIS), error)
    }

    @Test
    fun `an absurd retry delay is clamped so it cannot hang a worker`() {
        val error = DriveErrors.map(failure(429, "rateLimitExceeded", retryAfter = Long.MAX_VALUE), context())

        assertEquals(AppError.RateLimited(DriveErrors.MAX_RETRY_AFTER_MILLIS), error)
    }

    @Test
    fun `a negative retry delay is clamped to zero rather than parking a coroutine`() {
        val error = DriveErrors.map(failure(429, "rateLimitExceeded", retryAfter = -5_000), context())

        assertEquals(AppError.RateLimited(0), error)
    }

    // --- 5xx and the unclassified tail ---------------------------------------

    @Test
    fun `5xx is a provider outage`() {
        for (status in listOf(500, 502, 503, 504)) {
            assertEquals(
                AppError.ProviderUnavailable(ProviderId.GOOGLE_DRIVE),
                DriveErrors.map(failure(status), context()),
            )
        }
    }

    @Test
    fun `an unexpected status is classified rather than passed through`() {
        val error = DriveErrors.map(failure(418), context())

        assertTrue("expected a refusal to classify, got $error", error is AppError.Unknown)
    }

    // --- transport ----------------------------------------------------------

    @Test
    fun `a transport failure carries its classification and retryability`() {
        val error = DriveErrors.network(TransportCause.TIMEOUT, retryable = true)

        assertEquals(AppError.Network(TransportCause.TIMEOUT, retryable = true), error)
    }

    // --- both permission outcomes are terminal (RT-6) ------------------------

    @Test
    fun `neither permission outcome is ever retried`() {
        val outcomes = listOf(
            DriveErrors.map(
                failure(403, DriveErrors.REASON_INSUFFICIENT_PERMISSIONS),
                context(grantedScopesSuffice = true),
            ),
            DriveErrors.map(
                failure(403, DriveErrors.REASON_INSUFFICIENT_PERMISSIONS),
                context(grantedScopesSuffice = false),
            ),
        )

        outcomes.forEach { error ->
            assertTrue(
                "$error must surface, not retry",
                TransferRetryPolicy.decide(error, attempt = 1) is RetryDecision.Surface,
            )
        }
    }

    @Test
    fun `a storage 403 is never retried`() {
        val error = DriveErrors.map(failure(403, DriveErrors.REASON_INSUFFICIENT_STORAGE), context())

        // Retrying cannot change the user's own Drive limit.
        assertTrue(TransferRetryPolicy.decide(error, attempt = 1) is RetryDecision.Surface)
    }

    // --- reason extraction ---------------------------------------------------

    @Test
    fun `reason is read from a real Google error envelope`() {
        val body = """
            {
              "error": {
                "code": 403,
                "message": "Insufficient Permission",
                "errors": [
                  {
                    "domain": "global",
                    "reason": "insufficientPermissions",
                    "message": "Insufficient Permission"
                  }
                ]
              }
            }
        """.trimIndent()

        assertEquals("insufficientPermissions", DriveErrors.reasonOf(body))
    }

    @Test
    fun `reason survives a compact single-line body`() {
        val body = """{"error":{"code":403,"errors":[{"reason":"userRateLimitExceeded"}]}}"""

        assertEquals("userRateLimitExceeded", DriveErrors.reasonOf(body))
    }

    @Test
    fun `reason extraction returns null rather than throwing on hostile input`() {
        // A mapper that throws on a garbage body loses the original failure, and
        // an intercepting proxy returning an HTML error page is not exotic.
        val hostile = listOf(
            null,
            "",
            "   ",
            "<html><body>403 Forbidden</body></html>",
            """{"error":{"code":403,"message":"nope"}}""",
            """{"error":{"errors":[{"reason":"unterminated}]}}""",
            """{"error":{"errors":[{"reason":"noColonAfterKey"}}""",
            """reason""",
            "\u0000",
        )

        hostile.forEach { body ->
            assertNull("expected null for <$body>", DriveErrors.reasonOf(body))
        }
    }

    @Test
    fun `a truncated body does not throw or return a partial value`() {
        val body = """{"error":{"errors":[{"domain":"global","rea"""

        assertNull(DriveErrors.reasonOf(body))
    }

    @Test
    fun `a round trip from body to AppError works without an HTTP client`() {
        // The contract that makes TS-3 satisfiable: recorded response bodies in,
        // AppError out, and the live Drive API is never contacted.
        val body = """{"error":{"errors":[{"reason":"insufficientStorage"}]}}"""

        val failure = DriveErrors.DriveHttpFailure(
            httpStatus = 403,
            reason = DriveErrors.reasonOf(body),
            retryAfterMillis = null,
        )

        assertTrue(DriveErrors.map(failure, context()) is AppError.QuotaExceeded)
    }

    // --- Retry-After parsing -------------------------------------------------

    @Test
    fun `retry-after is read as delay seconds`() {
        assertEquals(30_000L, DriveErrors.retryAfterMillisOf("30"))
        assertEquals(1_000L, DriveErrors.retryAfterMillisOf(" 1 "))
        assertEquals(0L, DriveErrors.retryAfterMillisOf("0"))
    }

    @Test
    fun `an http-date retry-after is declined rather than guessed at`() {
        // Parsing it needs a date parser, Drive does not send it for these limits,
        // and a lenient date parse that returns the wrong instant is worse than
        // no answer at all.
        assertNull(DriveErrors.retryAfterMillisOf("Wed, 21 Oct 2026 07:28:00 GMT"))
    }

    @Test
    fun `a malformed retry-after is declined rather than guessed at`() {
        val malformed = listOf(null, "", "   ", "soon", "-1", "1.5", "9999999999999999999999")

        malformed.forEach { value ->
            assertNull("expected null for <$value>", DriveErrors.retryAfterMillisOf(value))
        }
    }

    @Test
    fun `a parseable but enormous retry-after cannot overflow into a negative delay`() {
        // `9223372036854775` parses as a Long but `seconds * 1000` wraps it
        // negative. A caller trusting that value would act as though the limit had
        // already passed and hammer the API, which is the opposite of what the
        // header was asking for.
        val enormous = "9223372036854775"

        assertEquals(
            DriveErrors.MAX_RETRY_AFTER_MILLIS,
            DriveErrors.retryAfterMillisOf(enormous),
        )
    }

    @Test
    fun `retry-after parsing never yields a negative delay`() {
        val inputs = listOf("0", "1", "60", "9223372036854775", Long.MAX_VALUE.toString())

        inputs.forEach { value ->
            val parsed = DriveErrors.retryAfterMillisOf(value)
            assertTrue(
                "expected a null or non-negative delay for <$value>, got $parsed",
                parsed == null || parsed >= 0L,
            )
        }
    }
}
