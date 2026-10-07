package com.unifiedcloud.filemanager.data.account

/**
 * The account's token lifecycle.
 *
 * `Architecture.md` §7.3. The states are the diagram's, and the names are the
 * diagram's names, so the code and the document can be read side by side.
 */
enum class AccountState {
    /** No credential. The starting state, and the only state with no credential. */
    DISCONNECTED,

    /** A consent flow is in progress. No token is usable yet. */
    AUTHORIZING,

    /** A token exists **and has been exercised against a live call** (SM-6). */
    CONNECTED,

    /** An access token expired and exactly one refresh is in flight (SM-1). */
    REFRESHING,

    /**
     * The refresh token is gone or was revoked. Terminal for this account's
     * operations until the user acts (SM-2).
     */
    REAUTH_REQUIRED,
}

/**
 * Something that can happen to an account.
 *
 * The cancellation split at the bottom is the subtle one; see
 * [AccountEvent.ConsentAbandoned] and [AccountEvent.OperationCancelled].
 */
sealed interface AccountEvent {
    /** The user tapped "Add account". */
    data object AddAccountRequested : AccountEvent

    /**
     * The user backed out of, or denied, the consent screen.
     *
     * This **does** move the account, from [AccountState.AUTHORIZING] to
     * [AccountState.DISCONNECTED], because abandoning a flow the user started is
     * a decision rather than an interruption.
     */
    data object ConsentAbandoned : AccountEvent

    /**
     * Tokens were received.
     *
     * [verifiedByLiveCall] carries SM-6: a token that was never exercised is not
     * proof of a working account. It is a constructor parameter rather than a
     * note in a comment because the whole failure this prevents - a screen that
     * says "connected" and then fails on first use - is invisible until a user
     * hits it.
     */
    data class TokensStored(val verifiedByLiveCall: Boolean) : AccountEvent

    /** The access token expired. Starts the single permitted refresh. */
    data object AccessTokenExpired : AccountEvent

    /** The refresh succeeded. */
    data object RefreshSucceeded : AccountEvent

    /** The refresh returned `invalid_grant`, or the grant was revoked. */
    data object RefreshRejected : AccountEvent

    /** A provider call reported that the credential is no longer good. */
    data object ProviderRejectedCredential : AccountEvent

    /** The user chose to re-authorise. */
    data object ReconnectRequested : AccountEvent

    /** The user disconnected. Purges everything (ST-4). */
    data object DisconnectRequested : AccountEvent

    /**
     * An in-flight **operation** was cancelled - a listing, a search, an upload.
     *
     * This transitions nothing, from any state, ever (SM-5, CN-2). It exists as
     * an explicit event precisely so that "the user cancelled" and "the user
     * abandoned the consent screen" cannot be conflated: the first must leave
     * the account untouched, the second must not.
     */
    data object OperationCancelled : AccountEvent
}

/** Why a transition was refused. */
enum class TransitionRefusal {
    /** The event is not defined from this state. */
    NOT_PERMITTED_FROM_STATE,

    /**
     * `TokensStored` without a live verification call (SM-6).
     *
     * Separate from [NOT_PERMITTED_FROM_STATE] because it is the one refusal
     * that is a bug in the caller rather than a normal consequence of ordering.
     */
    LIVE_VERIFICATION_REQUIRED,
}

/**
 * The outcome of offering an [AccountEvent] to an [AccountState].
 *
 * A sealed result rather than a nullable next state, because an illegal
 * transition is **loud**. Returning null and letting a caller default to
 * "unchanged" is how a machine quietly stops enforcing its own rules: the
 * refusal looks like a no-op, and a no-op is indistinguishable from working as
 * intended.
 */
sealed interface Transition {
    /** The state changes. */
    data class Allowed(
        val from: AccountState,
        val to: AccountState,
        val event: AccountEvent,
    ) : Transition

    /**
     * The state does not change, and [refusal] says why.
     *
     * Refusal is not always a defect - refusing [AccountState.REAUTH_REQUIRED]
     * to start an operation is SM-2 working - so it is a value to be handled,
     * not an exception to be thrown.
     */
    data class Refused(
        val state: AccountState,
        val event: AccountEvent,
        val refusal: TransitionRefusal,
    ) : Transition
}

/**
 * The token state machine (`Architecture.md` §7.3), as a pure transition
 * function.
 *
 * **Why there is no mutable state here.** SM-3 says entering
 * `ReauthRequired` for account A does not change account B's state. With one
 * instance per account that rule is enforced by remembering to be careful; with
 * a pure function of `(state, event)` there is nowhere for A's state to be
 * stored that B can read, so the rule holds without anyone doing anything. That
 * is the same reasoning as D-1.11, where distinct value classes make an identity
 * mix-up a compile error instead of a review item.
 *
 * Holding the current state per account - and persisting it - belongs to the
 * account repository. It is a `Map<LocalAccountId, AccountState>` with a
 * repository boundary, and it is not written yet.
 *
 * Pure, and therefore testable without a device, a clock, or a network.
 */
object AccountStateMachine {
    /**
     * The single permitted move from [from] on [event].
     *
     * The table is `Architecture.md` §7.3's diagram, edge for edge. Nothing is
     * added: an event with no edge from the current state is refused rather than
     * interpreted generously.
     */
    fun next(
        from: AccountState,
        event: AccountEvent,
    ): Transition =
        when {
            // SM-5: never a transition, from anywhere. Checked first so no future
            // edge added below can accidentally acquire one.
            event is AccountEvent.OperationCancelled ->
                Transition.Refused(from, event, TransitionRefusal.NOT_PERMITTED_FROM_STATE)

            // SM-6: checked before the AUTHORIZING edge so an unverified token
            // cannot reach CONNECTED by way of a missing case.
            event is AccountEvent.TokensStored && !event.verifiedByLiveCall ->
                Transition.Refused(from, event, TransitionRefusal.LIVE_VERIFICATION_REQUIRED)

            else ->
                edgeFor(from, event)
                    ?.let { Transition.Allowed(from, it, event) }
                    ?: Transition.Refused(from, event, TransitionRefusal.NOT_PERMITTED_FROM_STATE)
        }

    private fun edgeFor(
        from: AccountState,
        event: AccountEvent,
    ): AccountState? =
        when (from) {
            AccountState.DISCONNECTED ->
                when (event) {
                    is AccountEvent.AddAccountRequested -> AccountState.AUTHORIZING
                    else -> null
                }

            AccountState.AUTHORIZING ->
                when (event) {
                    is AccountEvent.ConsentAbandoned -> AccountState.DISCONNECTED
                    is AccountEvent.TokensStored -> AccountState.CONNECTED
                    else -> null
                }

            AccountState.CONNECTED ->
                when (event) {
                    is AccountEvent.AccessTokenExpired -> AccountState.REFRESHING
                    is AccountEvent.ProviderRejectedCredential -> AccountState.REAUTH_REQUIRED
                    is AccountEvent.DisconnectRequested -> AccountState.DISCONNECTED
                    else -> null
                }

            AccountState.REFRESHING ->
                when (event) {
                    is AccountEvent.RefreshSucceeded -> AccountState.CONNECTED
                    is AccountEvent.RefreshRejected -> AccountState.REAUTH_REQUIRED
                    else -> null
                }

            // SM-2: only the user's own action moves the account out. Every other
            // event is refused, which is what "terminal until the user acts" means
            // when it is enforced rather than described.
            AccountState.REAUTH_REQUIRED ->
                when (event) {
                    is AccountEvent.ReconnectRequested -> AccountState.AUTHORIZING
                    is AccountEvent.DisconnectRequested -> AccountState.DISCONNECTED
                    else -> null
                }
        }

    /**
     * Whether new operations may be started for an account in this state.
     *
     * SM-2 and SM-4. In [AccountState.REAUTH_REQUIRED] this is false, and the
     * cached view stays visible but stale and non-actionable - deleting the cache
     * instead would throw away a listing the user can still read, and keeping it
     * silently actionable would let a write fail against a dead credential.
     */
    fun allowsNewOperations(state: AccountState): Boolean =
        when (state) {
            AccountState.CONNECTED -> true
            AccountState.DISCONNECTED,
            AccountState.AUTHORIZING,
            AccountState.REFRESHING,
            AccountState.REAUTH_REQUIRED,
            -> false
        }

    /**
     * Whether mutating actions are permitted in this state.
     *
     * False in [AccountState.REAUTH_REQUIRED] per SM-4. Reads of the cache are
     * still allowed; it is the *actions* that are disabled.
     */
    fun allowsMutations(state: AccountState): Boolean = state == AccountState.CONNECTED

    /**
     * Whether the user must do something before this account works again.
     *
     * Drives the re-authorisation prompt. False for [AccountState.REFRESHING]
     * because a refresh in flight is not the user's problem, and telling them
     * so would be alarming and premature (TK-7).
     */
    fun requiresUserAction(state: AccountState): Boolean = state == AccountState.REAUTH_REQUIRED
}
