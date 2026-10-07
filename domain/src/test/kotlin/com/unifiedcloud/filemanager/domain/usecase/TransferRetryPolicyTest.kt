package com.unifiedcloud.filemanager.domain.usecase

import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.error.PermissionReason
import com.unifiedcloud.filemanager.domain.error.QuotaScope
import com.unifiedcloud.filemanager.domain.error.Recovery
import com.unifiedcloud.filemanager.domain.error.TransportCause
import com.unifiedcloud.filemanager.domain.model.FileRef
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class TransferRetryPolicyTest {
    private fun ref() =
        FileRef(
            provider = ProviderId.GOOGLE_DRIVE,
            accountId = LocalAccountId(1),
            fileId = ProviderFileId("f1"),
        )

    private fun network(retryable: Boolean = true) = AppError.Network(TransportCause.TIMEOUT, retryable)

    // --- cancellation ------------------------------------------------------

    @Test
    fun `cancellation is abandoned, never retried`() {
        val decision = TransferRetryPolicy.decide(AppError.Cancelled, attempt = 1)

        assertEquals(RetryDecision.Abandoned, decision)
    }

    @Test
    fun `cancellation stays abandoned even below the attempt cap`() {
        // Cancellation must not consume retry budget, and must not become an
        // error the user is shown.
        repeat(3) { attempt ->
            assertEquals(
                RetryDecision.Abandoned,
                TransferRetryPolicy.decide(AppError.Cancelled, attempt = attempt + 1),
            )
        }
    }

    // --- permanent failures ------------------------------------------------

    @Test
    fun `unauthorized is surfaced immediately`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.Unauthorized(PermissionReason.SCOPE_INSUFFICIENT),
                attempt = 1,
            )

        assertTrue(decision is RetryDecision.Surface)
    }

    @Test
    fun `file-not-found is surfaced immediately`() {
        val decision = TransferRetryPolicy.decide(AppError.FileNotFound(ref()), attempt = 1)

        assertTrue(decision is RetryDecision.Surface)
    }

    @Test
    fun `quota is surfaced rather than retried`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.QuotaExceeded(ProviderId.GOOGLE_DRIVE, QuotaScope.STORAGE, null, null),
                attempt = 1,
            )

        // Retrying cannot change the user's own Drive limit.
        assertTrue(decision is RetryDecision.Surface)
    }

    @Test
    fun `unknown is surfaced so a mapping bug stays visible`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.Unknown("something odd", null),
                attempt = 1,
            )

        assertTrue(decision is RetryDecision.Surface)
    }

    // --- rate limiting -----------------------------------------------------

    @Test
    fun `rate limit honours the provider's own delay`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.RateLimited(retryAfterMillis = 7_000),
                attempt = 1,
            )

        assertEquals(RetryDecision.Retry(7_000), decision)
    }

    @Test
    fun `rate limit delay is capped so a hostile value cannot hang a worker`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.RateLimited(retryAfterMillis = Long.MAX_VALUE),
                attempt = 1,
            )

        assertEquals(
            RetryDecision.Retry(TransferRetryPolicy.MAX_DELAY_MILLIS),
            decision,
        )
    }

    @Test
    fun `rate limit uses the provider delay, not our backoff`() {
        // The provider knows when it will accept us. Substituting our own
        // exponential would guarantee the next call fails.
        val decision =
            TransferRetryPolicy.decide(
                AppError.RateLimited(retryAfterMillis = 250),
                attempt = 4,
                jitterSource = Random(1),
            )

        assertEquals(RetryDecision.Retry(250), decision)
    }

    // --- transient failures ------------------------------------------------

    @Test
    fun `retryable network failure is retried`() {
        val decision =
            TransferRetryPolicy.decide(
                network(retryable = true),
                attempt = 1,
                jitterSource = Random(42),
            )

        assertTrue(decision is RetryDecision.Retry)
    }

    @Test
    fun `non-retryable network failure is surfaced`() {
        val decision =
            TransferRetryPolicy.decide(
                network(retryable = false),
                attempt = 1,
            )

        assertTrue(decision is RetryDecision.Surface)
    }

    @Test
    fun `provider unavailable is retried`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.ProviderUnavailable(ProviderId.GOOGLE_DRIVE),
                attempt = 2,
                jitterSource = Random(7),
            )

        assertTrue(decision is RetryDecision.Retry)
    }

    // --- token refresh -----------------------------------------------------

    @Test
    fun `transparent token refresh failure is retried`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.TokenRefreshFailed(
                    providerId = ProviderId.GOOGLE_DRIVE,
                    errorCode = "invalid_grant",
                    httpStatus = 400,
                    retryable = true,
                    recovery = Recovery.RETRY_TRANSPARENTLY,
                ),
                attempt = 1,
                jitterSource = Random(3),
            )

        assertTrue(decision is RetryDecision.Retry)
    }

    @Test
    fun `reauthorise-required token failure is surfaced not retried`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.TokenRefreshFailed(
                    providerId = ProviderId.GOOGLE_DRIVE,
                    errorCode = "invalid_scope",
                    httpStatus = 403,
                    retryable = true,
                    recovery = Recovery.REAUTHORISE,
                ),
                attempt = 1,
            )

        // Retrying a credential that must be re-authorised wastes the user's time
        // and can trip Google's rate limiting on the token endpoint.
        assertTrue(decision is RetryDecision.Surface)
    }

    // --- attempt cap -------------------------------------------------------

    @Test
    fun `retries stop at the attempt cap`() {
        val decision =
            TransferRetryPolicy.decide(
                network(),
                attempt = TransferRetryPolicy.DEFAULT_MAX_ATTEMPTS,
                jitterSource = Random(1),
            )

        assertTrue(decision is RetryDecision.Surface)
    }

    @Test
    fun `a retryable failure below the cap still retries`() {
        val decision =
            TransferRetryPolicy.decide(
                network(),
                attempt = TransferRetryPolicy.DEFAULT_MAX_ATTEMPTS - 1,
                jitterSource = Random(1),
            )

        assertTrue(decision is RetryDecision.Retry)
    }

    @Test
    fun `the cap holds even for a rate limit`() {
        val decision =
            TransferRetryPolicy.decide(
                AppError.RateLimited(1_000),
                attempt = 99,
            )

        assertTrue(decision is RetryDecision.Surface)
    }

    // --- backoff shape -----------------------------------------------------

    @Test
    fun `backoff stays within the cap for every attempt`() {
        for (attempt in 1..30) {
            val delay = TransferRetryPolicy.backoffMillis(attempt, Random(attempt))
            assertTrue(
                "attempt $attempt produced $delay",
                delay in 0..TransferRetryPolicy.MAX_DELAY_MILLIS,
            )
        }
    }

    @Test
    fun `backoff is fully jittered, not fixed`() {
        // Every device on the same network fails together. Identical delays would
        // retry in lockstep and recreate the overload.
        val delays = (1..20).map { TransferRetryPolicy.backoffMillis(3, Random(it)) }

        assertTrue("expected varied delays, got $delays", delays.distinct().size > 1)
    }

    @Test
    fun `backoff grows with attempt before jitter`() {
        val early = (1..40).map { TransferRetryPolicy.backoffMillis(1, Random(it)) }.average()
        val late = (1..40).map { TransferRetryPolicy.backoffMillis(6, Random(it)) }.average()

        assertTrue("early=$early late=$late", late > early)
    }

    @Test
    fun `the same seed produces the same delay, so the policy is testable`() {
        val a = TransferRetryPolicy.backoffMillis(2, Random(99))
        val b = TransferRetryPolicy.backoffMillis(2, Random(99))

        assertEquals(a, b)
    }
}
