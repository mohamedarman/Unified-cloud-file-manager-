import {
  AccountState,
  AccountEvent,
  Transition,
  TransitionRefusal,
} from '../types';

/**
 * Token lifecycle state machine directly ported from AccountStateMachine.kt.
 * Pure transition function enforcing SM-1 through SM-6.
 */
export const AccountStateMachine = {
  next(from: AccountState, event: AccountEvent): Transition {
    // SM-5: OperationCancelled is never a transition from anywhere
    if (event.type === 'OperationCancelled') {
      return {
        type: 'Refused',
        state: from,
        event,
        refusal: TransitionRefusal.NOT_PERMITTED_FROM_STATE,
      };
    }

    // SM-6: TokensStored requires live verification call
    if (event.type === 'TokensStored' && !event.verifiedByLiveCall) {
      return {
        type: 'Refused',
        state: from,
        event,
        refusal: TransitionRefusal.LIVE_VERIFICATION_REQUIRED,
      };
    }

    const nextState = this.edgeFor(from, event);
    if (nextState) {
      return {
        type: 'Allowed',
        from,
        to: nextState,
        event,
      };
    }

    return {
      type: 'Refused',
      state: from,
      event,
      refusal: TransitionRefusal.NOT_PERMITTED_FROM_STATE,
    };
  },

  edgeFor(from: AccountState, event: AccountEvent): AccountState | null {
    switch (from) {
      case AccountState.DISCONNECTED:
        if (event.type === 'AddAccountRequested') return AccountState.AUTHORIZING;
        return null;

      case AccountState.AUTHORIZING:
        if (event.type === 'ConsentAbandoned') return AccountState.DISCONNECTED;
        if (event.type === 'TokensStored') return AccountState.CONNECTED;
        return null;

      case AccountState.CONNECTED:
        if (event.type === 'AccessTokenExpired') return AccountState.REFRESHING;
        if (event.type === 'ProviderRejectedCredential') return AccountState.REAUTH_REQUIRED;
        if (event.type === 'DisconnectRequested') return AccountState.DISCONNECTED;
        return null;

      case AccountState.REFRESHING:
        if (event.type === 'RefreshSucceeded') return AccountState.CONNECTED;
        if (event.type === 'RefreshRejected') return AccountState.REAUTH_REQUIRED;
        return null;

      case AccountState.REAUTH_REQUIRED:
        if (event.type === 'ReconnectRequested') return AccountState.AUTHORIZING;
        if (event.type === 'DisconnectRequested') return AccountState.DISCONNECTED;
        return null;

      default:
        return null;
    }
  },

  allowsNewOperations(state: AccountState): boolean {
    return state === AccountState.CONNECTED;
  },

  allowsMutations(state: AccountState): boolean {
    return state === AccountState.CONNECTED;
  },

  requiresUserAction(state: AccountState): boolean {
    return state === AccountState.REAUTH_REQUIRED;
  },
};
