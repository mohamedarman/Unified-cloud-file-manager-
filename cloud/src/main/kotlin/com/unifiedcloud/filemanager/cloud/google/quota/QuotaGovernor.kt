package com.unifiedcloud.filemanager.cloud.google.quota

import com.unifiedcloud.filemanager.domain.model.LocalAccountId

/**
 * Result of asking the governor for permission to make a request.
 *
 * A sealed result rather than a boolean because the caller needs to react
 * differently to each refusal. Per-account saturation means "this account is
 * busy, queue behind it"; global saturation means "the device as a whole is at
 * its ceiling, shed load"; an exhausted rate budget means "stop for now". All
 * three collapse to `false` in a boolean, and the caller then guesses - which is
 * how a per-account bottleneck turns into a global stall.
 */
sealed interface Admission {
    /** The request may proceed. The caller now owes exactly one [QuotaGovernor.release]. */
    data object Granted : Admission

    /** The request may not proceed. Nothing was reserved, so nothing needs releasing. */
    data class Refused(val reason: Refusal) : Admission
}

/** Why a request was not admitted. */
enum class Refusal {
    /** This one account already has [QuotaGovernor.perAccountLimit] requests in flight. */
    PER_ACCOUNT_LIMIT,

    /** Every account together is at [QuotaGovernor.globalLimit]. */
    GLOBAL_LIMIT,

    /** The rolling request budget for the current window is spent. */
    RATE_BUDGET_EXHAUSTED,
}

/**
 * The concurrency and pacing limits the governor enforces.
 *
 * **Every number here is PROVISIONAL and none of them is a measurement.**
 *
 * `Rules.md` QD-1 requires real quotas to be read from the Cloud Console and
 * measured, never hard-coded from memory. That rule is not being evaded here -
 * it is being respected by refusing to guess. These are **our own client-side
 * ceilings**, chosen to be conservative, and they are not claims about what
 * Drive will tolerate. The real per-project quota is **UNKNOWN** (V-06, Q-05,
 * `Memory.md` §2) and stays that way until somebody reads the Cloud Console.
 *
 * [ARE_MEASURED] exists so that this distinction cannot rot. It is asserted
 * `false` by a test. The day V-06 is answered and these numbers are derived from
 * a real reading, that test fails and forces the constants, the comments, and
 * `Memory.md` to be updated together - rather than a derived number quietly
 * inheriting the authority of a measurement it never had.
 */
object ProvisionalBudgets {
    /**
     * False, and asserted false by `QuotaGovernorTest`.
     *
     * Not a knob. A flag that records provenance, so the difference between
     * "a conservative default we chose" and "a number we read from the Cloud
     * Console" stays visible in the code rather than only in a comment.
     */
    const val ARE_MEASURED = false

    /**
     * Concurrent requests permitted for a single account.
     *
     * More than one, because a single listing legitimately fans out - metadata,
     * then thumbnails, then capabilities - and serialising them would make every
     * screen feel slower for no benefit. Not so many that one account can starve
     * the others of the global budget.
     */
    const val PER_ACCOUNT_LIMIT = 4

    /**
     * Concurrent requests permitted across all accounts.
     *
     * With at most `D-1.4`'s five accounts, this is a little over one per account:
     * enough that no account waits on another's traffic, low enough that the
     * device is not opening a pile of sockets to a quota we have not measured.
     */
    const val GLOBAL_LIMIT = 8

    /** Length of the rolling request window, in milliseconds. */
    const val REQUEST_WINDOW_MILLIS = 100_000L

    /**
     * Requests permitted per [REQUEST_WINDOW_MILLIS].
     *
     * **Not the Drive quota.** Drive's real limit is per-project and unmeasured
     * (V-06). This is a self-imposed pacing ceiling set well below any plausible
     * provider limit, so that normal use never approaches the boundary and the
     * failure mode is a slower UI rather than a `403`.
     */
    const val REQUESTS_PER_WINDOW = 120

    /** Init block asserting the internal consistency the governor relies on. */
    init {
        require(PER_ACCOUNT_LIMIT > 0) { "PER_ACCOUNT_LIMIT must be positive" }
        require(GLOBAL_LIMIT > 0) { "GLOBAL_LIMIT must be positive" }
        require(REQUESTS_PER_WINDOW > 0) { "REQUESTS_PER_WINDOW must be positive" }
        require(REQUEST_WINDOW_MILLIS > 0) { "REQUEST_WINDOW_MILLIS must be positive" }
        // A single account must be able to reach its own ceiling, or the
        // per-account limit is unreachable and every queue serialises behind the
        // global cap for no reason.
        require(PER_ACCOUNT_LIMIT <= GLOBAL_LIMIT) {
            "PER_ACCOUNT_LIMIT ($PER_ACCOUNT_LIMIT) must not exceed GLOBAL_LIMIT ($GLOBAL_LIMIT)"
        }
    }
}

/**
 * A point-in-time view of what the governor is doing.
 *
 * Returned by [QuotaGovernor.snapshot] so a caller - or a bug report - can see
 * the whole picture without inferring it from three separate getters read at
 * three different moments.
 */
data class QuotaSnapshot(
    val inFlightTotal: Int,
    val inFlightByAccount: Map<LocalAccountId, Int>,
    val requestsInWindow: Int,
)

/**
 * Bounds concurrent Drive requests, per account and globally.
 *
 * `Architecture.md` §12.1 and §12.7 make this the component every fan-out
 * acquires from, and `Rules.md` QD-4 requires both a per-account and a global
 * cap. Fan-out without a cap is the failure `AR-05` rates **Major**: unified
 * search and unified listing both fan out across every connected account, and
 * with five accounts an uncapped fan-out multiplies every request by five
 * against a quota nobody has measured.
 *
 * **This is not the token-refresh mutex.** They are separate and must stay
 * separate. The mutex exists so that concurrent operations *within* one account
 * perform exactly one refresh (matrix case M10, `Architecture.md` §7.3 area);
 * the governor bounds how many requests may be in flight. A single object doing
 * both jobs would either serialise all traffic to one account - throwing away
 * the parallelism the fan-out exists for - or permit concurrent refreshes, which
 * is precisely the M10 defect.
 *
 * **Refuses rather than blocks.** [tryAcquire] returns a decision and reserves
 * nothing on refusal, leaving the waiting policy to the caller. A governor that
 * blocked would hold a coroutine while holding a monitor, and would make
 * structured concurrency (I-6, CN-1) considerably harder to reason about.
 *
 * Thread-safe. The synchronisation is confined to this class; no caller needs a
 * lock of its own.
 */
class QuotaGovernor(
    /** Concurrent requests per account. See [ProvisionalBudgets.PER_ACCOUNT_LIMIT]. */
    val perAccountLimit: Int = ProvisionalBudgets.PER_ACCOUNT_LIMIT,
    /** Concurrent requests across all accounts. See [ProvisionalBudgets.GLOBAL_LIMIT]. */
    val globalLimit: Int = ProvisionalBudgets.GLOBAL_LIMIT,
    /** Rolling request budget. See [ProvisionalBudgets.REQUESTS_PER_WINDOW]. */
    private val requestBudget: RequestBudget = RequestBudget(),
) {
    init {
        require(perAccountLimit > 0) { "perAccountLimit must be positive, was $perAccountLimit" }
        require(globalLimit > 0) { "globalLimit must be positive, was $globalLimit" }
        require(perAccountLimit <= globalLimit) {
            "perAccountLimit ($perAccountLimit) must not exceed globalLimit ($globalLimit); " +
                "otherwise the per-account cap is unreachable"
        }
    }

    private val lock = Any()
    private val inFlightByAccount = mutableMapOf<LocalAccountId, Int>()
    private var inFlightTotal = 0

    /**
     * Reserves capacity for one request by [accountId].
     *
     * On [Admission.Granted] the caller **must** eventually call [release] with
     * the same account, or the capacity leaks and the governor eventually
     * refuses everything. Pairing these is the caller's job because only the
     * caller knows the extent of the operation - `try/finally` around a
     * `withContext`, not around an `if`.
     *
     * The account is required by construction, so a request cannot be admitted
     * without one (I-1). There is no overload that omits it and no ambient
     * "current account" to fall back on (I-3).
     */
    fun tryAcquire(accountId: LocalAccountId): Admission {
        // The budget is charged before a slot is taken so a paced-out request
        // does not also consume concurrency. Charging is not refunded: the
        // request was counted as made, and pretending otherwise would make the
        // pacing figure mean something weaker than it says.
        if (!requestBudget.tryConsume()) {
            return Admission.Refused(Refusal.RATE_BUDGET_EXHAUSTED)
        }

        synchronized(lock) {
            val forAccount = inFlightByAccount[accountId] ?: 0
            if (forAccount >= perAccountLimit) {
                return Admission.Refused(Refusal.PER_ACCOUNT_LIMIT)
            }
            if (inFlightTotal >= globalLimit) {
                return Admission.Refused(Refusal.GLOBAL_LIMIT)
            }
            inFlightByAccount[accountId] = forAccount + 1
            inFlightTotal++
            return Admission.Granted
        }
    }

    /**
     * Returns capacity taken by [tryAcquire].
     *
     * Never drives a count negative. An extra release is a bookkeeping bug in
     * the caller, and clamping here means the bug shows up as capacity that is
     * returned too early rather than as a governor that refuses every request
     * for the rest of the process.
     */
    fun release(accountId: LocalAccountId) {
        synchronized(lock) {
            val forAccount = inFlightByAccount[accountId] ?: 0
            if (forAccount <= 0) return
            if (forAccount == 1) {
                inFlightByAccount.remove(accountId)
            } else {
                inFlightByAccount[accountId] = forAccount - 1
            }
            inFlightTotal = (inFlightTotal - 1).coerceAtLeast(0)
        }
    }

    /** Requests currently in flight for one account. */
    fun inFlightFor(accountId: LocalAccountId): Int =
        synchronized(lock) {
            inFlightByAccount[accountId] ?: 0
        }

    /** Requests currently in flight across all accounts. */
    fun inFlightTotal(): Int = synchronized(lock) { inFlightTotal }

    /** The whole picture, read at one instant. */
    fun snapshot(): QuotaSnapshot =
        synchronized(lock) {
            QuotaSnapshot(
                inFlightTotal = inFlightTotal,
                inFlightByAccount = inFlightByAccount.toMap(),
                requestsInWindow = requestBudget.consumedInWindow(),
            )
        }

    /**
     * Runs [block] with capacity reserved, releasing it however [block] ends.
     *
     * The intended way to use the governor. Capacity held across a coroutine
     * suspension is the whole point, and a `try/finally` is what stops a
     * cancellation from leaking a slot - a leak here eventually refuses every
     * request on the device with no visible cause.
     */
    suspend fun <T> withPermit(
        accountId: LocalAccountId,
        block: suspend () -> T,
    ): T? {
        if (tryAcquire(accountId) !is Admission.Granted) return null
        return try {
            block()
        } finally {
            release(accountId)
        }
    }
}

/**
 * A rolling-window budget on how many requests may be *started*.
 *
 * Separate from concurrency on purpose. Concurrency bounds how many requests are
 * open at once; this bounds how many may be *begun* over a period. Without the
 * second, a caller that finishes requests instantly can issue thousands per
 * second through a governor whose concurrency cap is never reached - the cap
 * would be satisfied on every check and constrain nothing.
 *
 * The window is a fixed window anchored at first use, not a sliding one. A
 * sliding window needs per-request timestamps and buys precision this does not
 * need; the worst case is a boundary effect where two windows' allowances are
 * spent close together, which the [ProvisionalBudgets] figures are loose enough
 * to absorb.
 */
class RequestBudget(
    private val windowMillis: Long = ProvisionalBudgets.REQUEST_WINDOW_MILLIS,
    private val requestsPerWindow: Int = ProvisionalBudgets.REQUESTS_PER_WINDOW,
    /** Monotonic milliseconds. Injected so tests do not sleep. */
    private val clock: () -> Long = { System.nanoTime() / NANOS_PER_MILLI },
) {
    init {
        require(windowMillis > 0) { "windowMillis must be positive, was $windowMillis" }
        require(requestsPerWindow > 0) { "requestsPerWindow must be positive, was $requestsPerWindow" }
    }

    private val lock = Any()
    private var windowStart = clock()
    private var consumed = 0

    /**
     * Charges one request against the current window.
     *
     * True when the request may start. A false result is not an error and is not
     * retried: the caller surfaces partial results (SC-3) rather than waiting.
     */
    fun tryConsume(): Boolean =
        synchronized(lock) {
            val now = clock()
            if (now - windowStart >= windowMillis) {
                windowStart = now
                consumed = 0
            }
            if (consumed >= requestsPerWindow) {
                return@synchronized false
            }
            consumed++
            true
        }

    /** Requests charged in the current window. */
    fun consumedInWindow(): Int = synchronized(lock) { consumed }

    /** Milliseconds until the current window rolls over. */
    fun millisUntilRefresh(): Long =
        synchronized(lock) {
            (windowStart + windowMillis - clock()).coerceAtLeast(0L)
        }

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000L
    }
}
