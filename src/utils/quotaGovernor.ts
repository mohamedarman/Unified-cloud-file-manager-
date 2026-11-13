import { LocalAccountId, QuotaSnapshot } from '../types';

export const ProvisionalBudgets = {
  ARE_MEASURED: false,
  PER_ACCOUNT_LIMIT: 4,
  GLOBAL_LIMIT: 8,
  REQUEST_WINDOW_MILLIS: 100_000,
  REQUESTS_PER_WINDOW: 120,
};

export type AdmissionResult =
  | { granted: true }
  | { granted: false; reason: 'PER_ACCOUNT_LIMIT' | 'GLOBAL_LIMIT' | 'RATE_BUDGET_EXHAUSTED' };

export class QuotaGovernor {
  private inFlightByAccount: Map<LocalAccountId, number> = new Map();
  private inFlightTotal = 0;
  private windowStart = Date.now();
  private consumedInWindow = 0;
  private waiters: Array<() => void> = [];

  constructor(
    public readonly perAccountLimit: number = ProvisionalBudgets.PER_ACCOUNT_LIMIT,
    public readonly globalLimit: number = ProvisionalBudgets.GLOBAL_LIMIT,
    public readonly requestWindowMillis: number = ProvisionalBudgets.REQUEST_WINDOW_MILLIS,
    public readonly requestsPerWindow: number = ProvisionalBudgets.REQUESTS_PER_WINDOW
  ) {}

  public tryAcquire(accountId: LocalAccountId): AdmissionResult {
    const now = Date.now();
    if (now - this.windowStart >= this.requestWindowMillis) {
      this.windowStart = now;
      this.consumedInWindow = 0;
    }

    if (this.consumedInWindow >= this.requestsPerWindow) {
      return { granted: false, reason: 'RATE_BUDGET_EXHAUSTED' };
    }

    const currentForAccount = this.inFlightByAccount.get(accountId) || 0;
    if (currentForAccount >= this.perAccountLimit) {
      return { granted: false, reason: 'PER_ACCOUNT_LIMIT' };
    }

    if (this.inFlightTotal >= this.globalLimit) {
      return { granted: false, reason: 'GLOBAL_LIMIT' };
    }

    this.consumedInWindow++;
    this.inFlightByAccount.set(accountId, currentForAccount + 1);
    this.inFlightTotal++;

    return { granted: true };
  }

  /**
   * Queues the caller in FIFO order until a concurrency slot opens for `accountId`
   * or `maxWaitMillis` elapses, preventing multi-file uploads from failing immediately.
   */
  public async acquireQueued(
    accountId: LocalAccountId,
    maxWaitMillis = 30_000
  ): Promise<AdmissionResult> {
    let decision = this.tryAcquire(accountId);
    if (decision.granted || decision.reason === 'RATE_BUDGET_EXHAUSTED') {
      return decision;
    }

    const deadline = Date.now() + maxWaitMillis;
    while (!decision.granted) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return decision;
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          const idx = this.waiters.indexOf(wake);
          if (idx >= 0) this.waiters.splice(idx, 1);
          resolve();
        }, remaining);
        const wake = () => {
          clearTimeout(timer);
          resolve();
        };
        this.waiters.push(wake);
      });
      decision = this.tryAcquire(accountId);
      if (!decision.granted && decision.reason === 'RATE_BUDGET_EXHAUSTED') {
        return decision;
      }
    }
    return decision;
  }

  public release(accountId: LocalAccountId): void {
    const current = this.inFlightByAccount.get(accountId) || 0;
    if (current <= 0) return;

    if (current === 1) {
      this.inFlightByAccount.delete(accountId);
    } else {
      this.inFlightByAccount.set(accountId, current - 1);
    }
    this.inFlightTotal = Math.max(0, this.inFlightTotal - 1);

    const pending = this.waiters.splice(0, this.waiters.length);
    for (const wake of pending) {
      wake();
    }
  }

  public snapshot(): QuotaSnapshot {
    const inFlightObj: Record<number, number> = {};
    this.inFlightByAccount.forEach((val, key) => {
      inFlightObj[key] = val;
    });

    const now = Date.now();
    const millisUntilRefresh = Math.max(0, this.windowStart + this.requestWindowMillis - now);

    return {
      inFlightTotal: this.inFlightTotal,
      inFlightByAccount: inFlightObj,
      requestsInWindow: this.consumedInWindow,
      perAccountLimit: this.perAccountLimit,
      globalLimit: this.globalLimit,
      requestsPerWindow: this.requestsPerWindow,
      millisUntilRefresh,
    };
  }

  public async withPermit<T>(accountId: LocalAccountId, task: () => Promise<T>): Promise<T | null> {
    const admission = this.tryAcquire(accountId);
    if (!admission.granted) {
      return null;
    }
    try {
      return await task();
    } finally {
      this.release(accountId);
    }
  }

  public async withQueuedPermit<T>(
    accountId: LocalAccountId,
    task: () => Promise<T>,
    maxWaitMillis = 30_000
  ): Promise<T | null> {
    const admission = await this.acquireQueued(accountId, maxWaitMillis);
    if (!admission.granted) {
      return null;
    }
    try {
      return await task();
    } finally {
      this.release(accountId);
    }
  }
}

export const globalQuotaGovernor = new QuotaGovernor();
