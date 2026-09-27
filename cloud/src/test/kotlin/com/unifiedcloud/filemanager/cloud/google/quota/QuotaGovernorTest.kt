package com.unifiedcloud.filemanager.cloud.google.quota

import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.concurrent.thread

/**
 * `Rules.md` QD-4, `Architecture.md` §12.1, AR-05.
 *
 * The concurrency test at the bottom is the one that earns its keep. A
 * governor whose counter is incremented outside its monitor admits more than its
 * own cap, and it admits *more* rather than fewer - so every single-threaded
 * test in this file would still pass.
 */
class QuotaGovernorTest {

    private val alice = LocalAccountId(1)
    private val bob = LocalAccountId(2)

    private fun governor(
        perAccount: Int = 2,
        global: Int = 4,
        budget: RequestBudget = RequestBudget(requestsPerWindow = 1_000),
    ) = QuotaGovernor(perAccountLimit = perAccount, globalLimit = global, requestBudget = budget)

    // --- provenance ---------------------------------------------------------

    @Test
    fun `the budgets are not marked as measured`() {
        // A tripwire, not a style assertion. When V-06 is answered and these
        // numbers are derived from a real Cloud Console reading, this test fails
        // and forces the constants, the comments, and Memory.md to move together
        // - so a derived number never inherits authority it has not earned.
        assertEquals(false, ProvisionalBudgets.ARE_MEASURED)
    }

    @Test
    fun `the provisional budgets are internally consistent`() {
        // Constructing the object runs its init block, where the cross-constant
        // invariants live. Asserting them again here means a failure names the
        // constant that is wrong rather than pointing at a require() deep in an
        // object initialiser.
        ProvisionalBudgets.ARE_MEASURED
        assertTrue(ProvisionalBudgets.PER_ACCOUNT_LIMIT > 0)
        assertTrue(ProvisionalBudgets.GLOBAL_LIMIT > 0)
        assertTrue(ProvisionalBudgets.REQUESTS_PER_WINDOW > 0)
        assertTrue(ProvisionalBudgets.REQUEST_WINDOW_MILLIS > 0)
        assertTrue(ProvisionalBudgets.PER_ACCOUNT_LIMIT <= ProvisionalBudgets.GLOBAL_LIMIT)
    }

    // --- per-account cap ----------------------------------------------------

    @Test
    fun `an account is admitted up to its per-account limit and no further`() {
        val governor = governor(perAccount = 2, global = 8)

        assertEquals(Admission.Granted, governor.tryAcquire(alice))
        assertEquals(Admission.Granted, governor.tryAcquire(alice))
        assertEquals(
            Admission.Refused(Refusal.PER_ACCOUNT_LIMIT),
            governor.tryAcquire(alice),
        )
    }

    @Test
    fun `one account saturating does not block another`() {
        // The blast-radius property from Architecture.md 24.1: the caps bound
        // how far a single misbehaving account can spread.
        val governor = governor(perAccount = 1, global = 8)

        assertEquals(Admission.Granted, governor.tryAcquire(alice))
        assertEquals(Admission.Refused(Refusal.PER_ACCOUNT_LIMIT), governor.tryAcquire(alice))
        assertEquals(Admission.Granted, governor.tryAcquire(bob))
    }

    @Test
    fun `per-account accounting is tracked separately`() {
        val governor = governor(perAccount = 3, global = 8)

        repeat(2) { governor.tryAcquire(alice) }
        governor.tryAcquire(bob)

        assertEquals(2, governor.inFlightFor(alice))
        assertEquals(1, governor.inFlightFor(bob))
        assertEquals(3, governor.inFlightTotal())
    }

    // --- global cap ---------------------------------------------------------

    @Test
    fun `the global cap holds across accounts`() {
        val governor = governor(perAccount = 4, global = 3)

        assertEquals(Admission.Granted, governor.tryAcquire(alice))
        assertEquals(Admission.Granted, governor.tryAcquire(alice))
        assertEquals(Admission.Granted, governor.tryAcquire(bob))
        assertEquals(Admission.Refused(Refusal.GLOBAL_LIMIT), governor.tryAcquire(LocalAccountId(3)))
    }

    @Test
    fun `a refused request reserves nothing`() {
        // A refusal that consumed capacity would shrink the governor every time
        // a caller backs off, which looks exactly like a leak.
        val governor = governor(perAccount = 1, global = 1)

        assertEquals(Admission.Granted, governor.tryAcquire(alice))
        assertEquals(Admission.Refused(Refusal.GLOBAL_LIMIT), governor.tryAcquire(bob))
        assertEquals(1, governor.inFlightTotal())

        governor.release(alice)

        assertEquals(0, governor.inFlightTotal())
        assertEquals(Admission.Granted, governor.tryAcquire(bob))
    }

    // --- release ------------------------------------------------------------

    @Test
    fun `release returns capacity to the right account`() {
        val governor = governor(perAccount = 1, global = 4)

        governor.tryAcquire(alice)
        governor.release(alice)

        assertEquals(0, governor.inFlightFor(alice))
        assertEquals(Admission.Granted, governor.tryAcquire(alice))
    }

    @Test
    fun `an extra release never drives a count negative`() {
        val governor = governor(perAccount = 2, global = 4)
        governor.tryAcquire(alice)

        repeat(5) { governor.release(alice) }

        assertEquals(0, governor.inFlightFor(alice))
        assertEquals(0, governor.inFlightTotal())
    }

    @Test
    fun `releasing an account that was never admitted is harmless`() {
        val governor = governor()

        governor.release(LocalAccountId(99))

        assertEquals(0, governor.inFlightTotal())
    }

    @Test
    fun `repeated acquire and release cycles stay balanced`() {
        // The leak case that matters in production: a long-lived governor on a
        // long-lived process slowly refusing everything.
        val governor = governor(perAccount = 2, global = 4)

        repeat(500) {
            assertEquals(Admission.Granted, governor.tryAcquire(alice))
            governor.release(alice)
        }

        assertEquals(0, governor.inFlightTotal())
        assertEquals(Admission.Granted, governor.tryAcquire(alice))
    }

    // --- configuration is validated -----------------------------------------

    @Test
    fun `a per-account cap above the global cap is rejected`() {
        // Otherwise the per-account limit is unreachable and every queue
        // serialises behind the global cap for no reason.
        val refused = runCatching { QuotaGovernor(perAccountLimit = 8, globalLimit = 4) }

        assertTrue(refused.isFailure)
    }

    @Test
    fun `a non-positive cap is rejected`() {
        assertTrue(runCatching { QuotaGovernor(perAccountLimit = 0, globalLimit = 4) }.isFailure)
        assertTrue(runCatching { QuotaGovernor(perAccountLimit = 2, globalLimit = 0) }.isFailure)
    }

    // --- snapshot -----------------------------------------------------------

    @Test
    fun `the snapshot reports both levels and the budget together`() {
        val governor = governor(perAccount = 3, global = 8)

        governor.tryAcquire(alice)
        governor.tryAcquire(alice)
        governor.tryAcquire(bob)

        val snapshot = governor.snapshot()

        assertEquals(3, snapshot.inFlightTotal)
        assertEquals(2, snapshot.inFlightByAccount[alice])
        assertEquals(1, snapshot.inFlightByAccount[bob])
        assertEquals(3, snapshot.requestsInWindow)
    }

    @Test
    fun `the snapshot does not alias the governor's own state`() {
        val governor = governor(perAccount = 3, global = 8)
        governor.tryAcquire(alice)

        val snapshot = governor.snapshot()
        governor.tryAcquire(alice)

        assertEquals("a snapshot must be a moment, not a view", 1, snapshot.inFlightTotal)
    }

    // --- request budget -----------------------------------------------------

    @Test
    fun `the request budget is spent after its allowance`() {
        var now = 0L
        val budget = RequestBudget(windowMillis = 100, requestsPerWindow = 3, clock = { now })
        val governor = QuotaGovernor(
            perAccountLimit = 10,
            globalLimit = 10,
            requestBudget = budget,
        )

        repeat(3) { assertEquals(Admission.Granted, governor.tryAcquire(alice)) }
        assertEquals(
            Admission.Refused(Refusal.RATE_BUDGET_EXHAUSTED),
            governor.tryAcquire(alice),
        )
    }

    @Test
    fun `the budget refuses without consuming a concurrency slot`() {
        var now = 0L
        val budget = RequestBudget(windowMillis = 100, requestsPerWindow = 1, clock = { now })
        val governor = QuotaGovernor(
            perAccountLimit = 1,
            globalLimit = 1,
            requestBudget = budget,
        )

        governor.tryAcquire(alice)
        governor.tryAcquire(alice)

        // The first acquire took the only slot; the second was refused on the
        // budget. If the refusal had also taken the slot, the next release would
        // have to give back two.
        assertEquals(1, governor.inFlightTotal())
        governor.release(alice)
        assertEquals(0, governor.inFlightTotal())
    }

    @Test
    fun `the budget refills when the window rolls over`() {
        var now = 0L
        val budget = RequestBudget(windowMillis = 100, requestsPerWindow = 2, clock = { now })
        val governor = QuotaGovernor(
            perAccountLimit = 10,
            globalLimit = 10,
            requestBudget = budget,
        )

        repeat(2) { governor.tryAcquire(alice) }
        assertTrue(governor.tryAcquire(alice) is Admission.Refused)

        now += 100

        assertEquals(Admission.Granted, governor.tryAcquire(alice))
    }

    @Test
    fun `the window has not rolled over one millisecond early`() {
        var now = 0L
        val budget = RequestBudget(windowMillis = 100, requestsPerWindow = 1, clock = { now })
        val governor = QuotaGovernor(
            perAccountLimit = 10,
            globalLimit = 10,
            requestBudget = budget,
        )

        governor.tryAcquire(alice)
        now += 99

        assertTrue(governor.tryAcquire(alice) is Admission.Refused)
    }

    @Test
    fun `the time until refresh never goes negative`() {
        var now = 0L
        val budget = RequestBudget(windowMillis = 100, requestsPerWindow = 1, clock = { now })
        now += 500

        assertEquals(0L, budget.millisUntilRefresh())
    }

    @Test
    fun `a non-positive budget configuration is rejected`() {
        assertTrue(runCatching { RequestBudget(windowMillis = 0) }.isFailure)
        assertTrue(runCatching { RequestBudget(requestsPerWindow = 0) }.isFailure)
    }

    // --- withPermit ---------------------------------------------------------

    @Test
    fun `withPermit returns the block's value and releases afterwards`() {
        val governor = governor(perAccount = 1, global = 1)

        val result = runTest {
            governor.withPermit(alice) { "listed" }
        }

        assertEquals("listed", result)
        assertEquals(0, governor.inFlightTotal())
    }

    @Test
    fun `withPermit releases when the block throws`() {
        // A leaked slot here eventually refuses every request on the device with
        // no visible cause, which is close to undebuggable.
        val governor = governor(perAccount = 1, global = 1)

        val thrown = runCatching {
            runTest {
                governor.withPermit(alice) { throw IllegalStateException("listing failed") }
            }
        }.exceptionOrNull()

        assertTrue(thrown is IllegalStateException)
        assertEquals(0, governor.inFlightTotal())
        assertEquals(Admission.Granted, governor.tryAcquire(alice))
    }

    @Test
    fun `withPermit does not run the block when admission is refused`() {
        val governor = governor(perAccount = 1, global = 1)
        var ran = false

        val result = runTest {
            governor.tryAcquire(alice)
            governor.withPermit(alice) { ran = true }
        }

        assertNull(result)
        assertFalse("a refused permit must not run the block", ran)
    }

    // --- concurrency --------------------------------------------------------

    @Test
    fun `concurrent acquires never exceed the global cap`() {
        val threads = 16
        val attemptsPerThread = 200
        val globalCap = 4
        val perAccountCap = 2
        val governor = QuotaGovernor(
            perAccountLimit = perAccountCap,
            globalLimit = globalCap,
            requestBudget = RequestBudget(requestsPerWindow = 1_000_000),
        )

        val inFlight = AtomicInteger(0)
        val peak = AtomicInteger(0)
        val start = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(threads)

        try {
            repeat(threads) { index ->
                pool.submit {
                    val account = LocalAccountId((index % 5) + 1L)
                    start.await()
                    repeat(attemptsPerThread) {
                        if (governor.tryAcquire(account) is Admission.Granted) {
                            val current = inFlight.incrementAndGet()
                            peak.updateAndGet { previous -> maxOf(previous, current) }
                            inFlight.decrementAndGet()
                            governor.release(account)
                        }
                    }
                }
            }
            start.countDown()
            pool.shutdown()
            assertTrue("pool did not finish in time", pool.awaitTermination(30, TimeUnit.SECONDS))
        } finally {
            pool.shutdownNow()
        }

        assertEquals("every slot was returned", 0, governor.inFlightTotal())
        assertTrue(
            "observed $peak in flight against a global cap of $globalCap",
            peak.get() <= globalCap,
        )
    }

    @Test
    fun `concurrent acquires never exceed the per-account cap`() {
        val threads = 12
        val perAccountCap = 2
        val governor = QuotaGovernor(
            perAccountLimit = perAccountCap,
            globalLimit = 64,
            requestBudget = RequestBudget(requestsPerWindow = 1_000_000),
        )

        val peak = AtomicInteger(0)
        val start = CountDownLatch(1)

        // Every thread hammers the SAME account, which is the case the
        // per-account cap exists for.
        val workers = List(threads) {
            thread {
                start.await()
                repeat(300) {
                    if (governor.tryAcquire(alice) is Admission.Granted) {
                        peak.updateAndGet { previous -> maxOf(previous, governor.inFlightFor(alice)) }
                        governor.release(alice)
                    }
                }
            }
        }

        start.countDown()
        workers.forEach { it.join() }

        assertEquals(0, governor.inFlightTotal())
        assertTrue(
            "observed ${peak.get()} concurrent for one account against a cap of $perAccountCap",
            peak.get() <= perAccountCap,
        )
    }
}
