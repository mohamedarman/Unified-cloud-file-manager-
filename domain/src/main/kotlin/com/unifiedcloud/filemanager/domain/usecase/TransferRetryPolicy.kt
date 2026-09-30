package com.unifiedcloud.filemanager.domain.usecase

import com.unifiedcloud.filemanager.domain.error.AppError
import com.unifiedcloud.filemanager.domain.error.Recovery
import kotlin.math.min
import kotlin.random.Random

/**
 * What to do about a failed operation.
 */
sealed interface RetryDecision {
    /** Try again after [delayMillis]. */
    data class Retry(val delayMillis: Long) : RetryDecision

    /**
     * Stop retrying and tell the user.
     *
     * [error] is the reason to show, already classified. The UI must not have to
     * re-interpret it to know whether to offer "Retry", "Reconnect", or nothing.
     */
    data class Surface(val error: AppError) : RetryDecision

    /** The operation was cancelled. Not a failure; do not present it as one. */
    data object Abandoned : RetryDecision
}

/**
 * Decides whether a failure is worth retrying, and when.
 *
 * This exists as a pure function so the policy can be asserted directly, without
 * a clock, a network, or a harness. Retry behaviour is exactly the kind of rule
 * that is easy to state in a document and easy to implement three slightly
 * different ways in three call sites, and a transfer that retries a revoked token
 * five times while a search that retries once behaves correctly is a real bug
 * users feel.
 *
 * The policy, in order:
 *
 *  1. Cancellation is never a failure. Retrying it would resurrect an operation
 *     the user deliberately stopped.
 *  2. A scope the user has not granted, a file they cannot see, and a file that
 *     does not exist are permanent. Retrying any of them is pure waste and, for
 *     the user, a long silent wait for an error they could have been shown
 *     immediately.
 *  3. Provider-supplied rate limits are obeyed exactly. We do not substitute
 *     our own backoff, because the provider knows when it will accept us and
 *     two disagreeing timers just make the next call fail.
 *  4. Transient transport failures back off exponentially with full jitter.
 *  5. Nothing is retried more than [maxAttempts] times. A background worker that
 *     retries forever is indistinguishable from a hung app.
 */
object TransferRetryPolicy {
    const val DEFAULT_MAX_ATTEMPTS = 5
    const val BASE_DELAY_MILLIS = 500L
    const val MAX_DELAY_MILLIS = 60_000L

    /**
     * @param attempt 1 for the first retry, 2 for the second, and so on.
     * @param jitterSource injected so tests are deterministic.
     */
    fun decide(
        error: AppError,
        attempt: Int,
        maxAttempts: Int = DEFAULT_MAX_ATTEMPTS,
        jitterSource: Random = Random.Default,
    ): RetryDecision {
        if (attempt >= maxAttempts) return RetryDecision.Surface(error)

        return when (error) {
            // 1. Cancellation is never a failure. Retrying it would resurrect an
            // operation the user deliberately stopped.
            is AppError.Cancelled -> RetryDecision.Abandoned

            // 2. Permanent conditions.
            is AppError.Unauthorized -> RetryDecision.Surface(error)
            is AppError.FileNotFound -> RetryDecision.Surface(error)

            // 3. Obey the provider's own instruction.
            is AppError.RateLimited ->
                RetryDecision.Retry(
                    error.retryAfterMillis.coerceIn(0, MAX_DELAY_MILLIS),
                )

            // Quota is the account's own limit; retrying cannot change it, and
            // hammering a quota-exhausted account is actively unhelpful.
            is AppError.QuotaExceeded -> RetryDecision.Surface(error)

            // 4. Transient.
            is AppError.Network ->
                if (error.retryable) {
                    RetryDecision.Retry(backoffMillis(attempt, jitterSource))
                } else {
                    RetryDecision.Surface(error)
                }

            is AppError.TokenRefreshFailed ->
                if (error.retryable && error.recovery == Recovery.RETRY_TRANSPARENTLY) {
                    RetryDecision.Retry(backoffMillis(attempt, jitterSource))
                } else {
                    RetryDecision.Surface(error)
                }

            is AppError.ProviderUnavailable -> RetryDecision.Retry(backoffMillis(attempt, jitterSource))

            // An unclassified failure is more likely a bug in our mapping than a
            // blip. Surfacing it means the bug is visible instead of hidden
            // behind five silent retries.
            is AppError.Unknown -> RetryDecision.Surface(error)
        }
    }

    /**
     * Exponential backoff with full jitter.
     *
     * Full jitter - a uniform draw from `[0, exponential]` - rather than fixed
     * exponential, because every transfer on the device tends to fail at the same
     * moment (a tunnel, a dead router). Without jitter they all retry in lockstep
     * and recreate the overload that caused the failure.
     */
    internal fun backoffMillis(
        attempt: Int,
        random: Random,
    ): Long {
        val exponential = BASE_DELAY_MILLIS * (1L shl min(attempt - 1, 20))
        val capped = min(exponential, MAX_DELAY_MILLIS)
        return if (capped <= 0) 0 else random.nextLong(0, capped + 1)
    }
}
