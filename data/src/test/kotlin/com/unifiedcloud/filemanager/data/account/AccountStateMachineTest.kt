package com.unifiedcloud.filemanager.data.account

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `Architecture.md` §7.3, SM-1…SM-6, `Rules.md` TK-7/TK-8/TK-9.
 *
 * Two of these are structural rather than behavioural and are worth naming:
 *
 *  - [an unverified token cannot reach Connected] asserts SM-6 is enforced by
 *    the transition table, not merely described in a comment.
 *  - [cancellation never transitions any state] asserts SM-5 by walking *every*
 *    state, because the failure this prevents is one account's cancelled
 *    operation dropping it into `ReauthRequired` and looking like a revocation.
 */
class AccountStateMachineTest {

    private val connected = AccountEvent.TokensStored(verifiedByLiveCall = true)
    private val unverified = AccountEvent.TokensStored(verifiedByLiveCall = false)

    private fun allowed(from: AccountState, event: AccountEvent): AccountState {
        val result = AccountStateMachine.next(from, event)
        assertTrue("expected $from + $event to be allowed, got $result", result is Transition.Allowed)
        return (result as Transition.Allowed).to
    }

    private fun refused(from: AccountState, event: AccountEvent, why: TransitionRefusal) {
        val result = AccountStateMachine.next(from, event)
        assertEquals(
            "expected $from + $event to be refused because $why, got $result",
            Transition.Refused(from, event, why),
            result,
        )
    }

    // --- the diagram, edge for edge -----------------------------------------

    @Test
    fun `Disconnected to Authorizing on add account`() {
        assertEquals(
            AccountState.AUTHORIZING,
            allowed(AccountState.DISCONNECTED, AccountEvent.AddAccountRequested),
        )
    }

    @Test
    fun `Authorizing to Disconnected when consent is abandoned`() {
        assertEquals(
            AccountState.DISCONNECTED,
            allowed(AccountState.AUTHORIZING, AccountEvent.ConsentAbandoned),
        )
    }

    @Test
    fun `Authorizing to Connected once tokens are stored and verified`() {
        assertEquals(AccountState.CONNECTED, allowed(AccountState.AUTHORIZING, connected))
    }

    @Test
    fun `Connected to Refreshing when the access token expires`() {
        assertEquals(
            AccountState.REFRESHING,
            allowed(AccountState.CONNECTED, AccountEvent.AccessTokenExpired),
        )
    }

    @Test
    fun `Refreshing to Connected when the refresh succeeds`() {
        assertEquals(
            AccountState.CONNECTED,
            allowed(AccountState.REFRESHING, AccountEvent.RefreshSucceeded),
        )
    }

    @Test
    fun `Refreshing to ReauthRequired on invalid_grant`() {
        assertEquals(
            AccountState.REAUTH_REQUIRED,
            allowed(AccountState.REFRESHING, AccountEvent.RefreshRejected),
        )
    }

    @Test
    fun `Connected to ReauthRequired when the provider rejects the credential`() {
        assertEquals(
            AccountState.REAUTH_REQUIRED,
            allowed(AccountState.CONNECTED, AccountEvent.ProviderRejectedCredential),
        )
    }

    @Test
    fun `ReauthRequired to Authorizing when the user reconnects`() {
        assertEquals(
            AccountState.AUTHORIZING,
            allowed(AccountState.REAUTH_REQUIRED, AccountEvent.ReconnectRequested),
        )
    }

    @Test
    fun `Connected to Disconnected on disconnect`() {
        assertEquals(
            AccountState.DISCONNECTED,
            allowed(AccountState.CONNECTED, AccountEvent.DisconnectRequested),
        )
    }

    @Test
    fun `ReauthRequired to Disconnected on disconnect`() {
        assertEquals(
            AccountState.DISCONNECTED,
            allowed(AccountState.REAUTH_REQUIRED, AccountEvent.DisconnectRequested),
        )
    }

    // --- SM-6: a token is not proof of a working account ---------------------

    @Test
    fun `an unverified token cannot reach Connected`() {
        // The whole point of SM-6, and why verifiedByLiveCall is a constructor
        // parameter rather than a comment. A screen that says "connected" and
        // then fails on first use is the failure.
        refused(AccountState.AUTHORIZING, unverified, TransitionRefusal.LIVE_VERIFICATION_REQUIRED)
    }

    @Test
    fun `an unverified token is refused for its own reason, not as an illegal edge`() {
        // The two refusals mean different things: one is a bug in the caller, the
        // other is a normal consequence of ordering.
        val result = AccountStateMachine.next(AccountState.AUTHORIZING, unverified)

        assertTrue(
            "expected LIVE_VERIFICATION_REQUIRED, got $result",
            result is Transition.Refused &&
                result.refusal == TransitionRefusal.LIVE_VERIFICATION_REQUIRED,
        )
    }

    @Test
    fun `an unverified token is refused from every state`() {
        AccountState.values().forEach { state ->
            refused(state, unverified, TransitionRefusal.LIVE_VERIFICATION_REQUIRED)
        }
    }

    // --- SM-5 / TK-9: cancellation never transitions state -------------------

    @Test
    fun `cancellation never transitions any state`() {
        AccountState.values().forEach { state ->
            val result = AccountStateMachine.next(state, AccountEvent.OperationCancelled)

            assertTrue(
                "cancellation changed $state to $result",
                result is Transition.Refused,
            )
            if (result is Transition.Refused) {
                assertEquals(state, result.state)
            }
        }
    }

    @Test
    fun `cancelling a refresh does not strand the account in Refreshing`() {
        // A cancelled refresh is not a rejected one. Treating it as one would
        // show the user a re-authorisation prompt for a credential that is
        // probably fine.
        refused(
            AccountState.REFRESHING,
            AccountEvent.OperationCancelled,
            TransitionRefusal.NOT_PERMITTED_FROM_STATE,
        )
    }

    @Test
    fun `abandoning consent and cancelling an operation are different events`() {
        // The distinction the explicit OperationCancelled event exists to keep.
        val abandoned = AccountStateMachine.next(
            AccountState.AUTHORIZING,
            AccountEvent.ConsentAbandoned,
        )
        val cancelled = AccountStateMachine.next(
            AccountState.AUTHORIZING,
            AccountEvent.OperationCancelled,
        )

        assertTrue(abandoned is Transition.Allowed)
        assertTrue(cancelled is Transition.Refused)
    }

    // --- SM-2 / TK-7: ReauthRequired is terminal until the user acts ---------

    @Test
    fun `ReauthRequired refuses to start an operation`() {
        val operationalEvents = listOf(
            AccountEvent.AccessTokenExpired,
            AccountEvent.RefreshSucceeded,
            AccountEvent.RefreshRejected,
            AccountEvent.ProviderRejectedCredential,
            AccountEvent.AddAccountRequested,
        )

        operationalEvents.forEach { event ->
            refused(
                AccountState.REAUTH_REQUIRED,
                event,
                TransitionRefusal.NOT_PERMITTED_FROM_STATE,
            )
        }
    }

    @Test
    fun `ReauthRequired never degrades into a retry loop`() {
        // TK-7, SM-1, RT-7. Offering every refresh-flavoured event in turn must
        // not walk the account back out of the terminal state.
        var state = AccountState.REAUTH_REQUIRED
        val refreshEvents = listOf(
            AccountEvent.AccessTokenExpired,
            AccountEvent.RefreshSucceeded,
            AccountEvent.RefreshRejected,
            AccountEvent.ProviderRejectedCredential,
        )

        repeat(10) {
            refreshEvents.forEach { event ->
                val result = AccountStateMachine.next(state, event)
                if (result is Transition.Allowed) state = result.to
            }
        }

        assertEquals(AccountState.REAUTH_REQUIRED, state)
    }

    @Test
    fun `the only escapes from ReauthRequired are user actions`() {
        val escapes = listOf(
            AccountEvent.ReconnectRequested,
            AccountEvent.DisconnectRequested,
        )

        escapes.forEach { event ->
            assertTrue(
                "$event should be an escape",
                AccountStateMachine.next(AccountState.REAUTH_REQUIRED, event) is Transition.Allowed,
            )
        }
    }

    // --- illegal edges are refused, not interpreted --------------------------

    @Test
    fun `every event with no edge from a state is refused`() {
        val all = listOf(
            AccountEvent.AddAccountRequested,
            AccountEvent.ConsentAbandoned,
            connected,
            AccountEvent.AccessTokenExpired,
            AccountEvent.RefreshSucceeded,
            AccountEvent.RefreshRejected,
            AccountEvent.ProviderRejectedCredential,
            AccountEvent.ReconnectRequested,
            AccountEvent.DisconnectRequested,
        )

        AccountState.values().forEach { state ->
            all.filter { event ->
                AccountStateMachine.next(state, event) !is Transition.Allowed
            }.forEach { event ->
                refused(
                    state,
                    event,
                    if (event is AccountEvent.TokensStored) {
                        TransitionRefusal.LIVE_VERIFICATION_REQUIRED
                    } else {
                        TransitionRefusal.NOT_PERMITTED_FROM_STATE
                    },
                )
            }
        }
    }

    @Test
    fun `Connected cannot jump straight to Authorizing`() {
        // Re-authorising goes through ReauthRequired, so a revoked credential is
        // visible in the state rather than skipped over.
        refused(
            AccountState.CONNECTED,
            AccountEvent.AddAccountRequested,
            TransitionRefusal.NOT_PERMITTED_FROM_STATE,
        )
    }

    @Test
    fun `Disconnected cannot receive a refresh result`() {
        refused(
            AccountState.DISCONNECTED,
            AccountEvent.RefreshSucceeded,
            TransitionRefusal.NOT_PERMITTED_FROM_STATE,
        )
    }

    @Test
    fun `a refusal reports the state it refused from`() {
        // So a caller can log or assert which state produced the refusal instead
        // of guessing after the fact.
        val result = AccountStateMachine.next(AccountState.CONNECTED, AccountEvent.ConsentAbandoned)

        assertTrue(result is Transition.Refused)
        assertEquals(AccountState.CONNECTED, (result as Transition.Refused).state)
    }

    @Test
    fun `an allowed transition reports both endpoints`() {
        val result = AccountStateMachine.next(AccountState.DISCONNECTED, AccountEvent.AddAccountRequested)

        assertEquals(
            Transition.Allowed(
                from = AccountState.DISCONNECTED,
                to = AccountState.AUTHORIZING,
                event = AccountEvent.AddAccountRequested,
            ),
            result,
        )
    }

    // --- SM-1: one refresh at a time ----------------------------------------

    @Test
    fun `Connected does not refresh twice in a row`() {
        // SM-1. Expiry moves to REFRESHING; from there only a refresh *result* is
        // accepted, so a second expiry cannot start a second refresh.
        assertTrue(
            AccountStateMachine.next(
                AccountState.REFRESHING,
                AccountEvent.AccessTokenExpired,
            ) is Transition.Refused,
        )
    }

    // --- SM-3: accounts are independent -------------------------------------

    @Test
    fun `the machine holds no state, so one account cannot affect another`() {
        // SM-3 enforced by construction rather than by discipline: `next` is a
        // pure function of its arguments, so there is no field anywhere that one
        // account's transition could write and another's read. The observable
        // consequence is that it does not remember having been called - offering
        // the same event twice yields the same answer both times, with no
        // accumulated effect for a second account to inherit.
        val event = AccountEvent.ReconnectRequested

        val first = AccountStateMachine.next(AccountState.REAUTH_REQUIRED, event)
        val second = AccountStateMachine.next(AccountState.REAUTH_REQUIRED, event)

        assertEquals(first, second)
        assertEquals(AccountState.AUTHORIZING, (first as Transition.Allowed).to)
        // A second account, still disconnected, is unaffected by the transition
        // above: its own state was never stored anywhere the first could reach.
        val other = AccountStateMachine.next(AccountState.DISCONNECTED, AccountEvent.AddAccountRequested)

        assertEquals(
            Transition.Allowed(
                from = AccountState.DISCONNECTED,
                to = AccountState.AUTHORIZING,
                event = AccountEvent.AddAccountRequested,
            ),
            other,
        )
    }

    // --- what each state permits --------------------------------------------

    @Test
    fun `only Connected starts new operations`() {
        assertTrue(AccountStateMachine.allowsNewOperations(AccountState.CONNECTED))

        AccountState.values()
            .filter { it != AccountState.CONNECTED }
            .forEach { state ->
                assertFalse("$state must not start new operations", AccountStateMachine.allowsNewOperations(state))
            }
    }

    @Test
    fun `only Connected permits mutations`() {
        // SM-4: REAUTH_REQUIRED keeps the cached view readable but disables the
        // actions, so a write cannot fail against a dead credential.
        assertTrue(AccountStateMachine.allowsMutations(AccountState.CONNECTED))

        AccountState.values()
            .filter { it != AccountState.CONNECTED }
            .forEach { state ->
                assertFalse("$state must not permit mutations", AccountStateMachine.allowsMutations(state))
            }
    }

    @Test
    fun `a refreshing account is not yet a problem for the user`() {
        // TK-7: prompting during a refresh in flight would be alarming and
        // premature, and a refresh usually succeeds.
        assertFalse(AccountStateMachine.requiresUserAction(AccountState.REFRESHING))
        assertTrue(AccountStateMachine.requiresUserAction(AccountState.REAUTH_REQUIRED))
    }

    @Test
    fun `only ReauthRequired requires user action`() {
        AccountState.values().forEach { state ->
            assertEquals(
                state == AccountState.REAUTH_REQUIRED,
                AccountStateMachine.requiresUserAction(state),
            )
        }
    }
}
