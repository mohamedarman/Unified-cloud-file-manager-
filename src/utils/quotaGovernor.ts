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

  public release(accountId: LocalAccountId): void {
    const current = this.inFlightByAccount.get(accountId) || 0;
    if (current <= 0) return;

    if (current === 1) {
      this.inFlightByAccount.delete(accountId);
    } else {
      this.inFlightByAccount.set(accountId, current - 1);
    }
    this.inFlightTotal = Math.max(0, this.inFlightTotal - 1);
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
}

export const globalQuotaGovernor = new QuotaGovernor();
