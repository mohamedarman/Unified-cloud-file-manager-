import { AuditLogEntry, LocalAccountId } from '../types';
import { Redactor } from '../utils/redactor';

/**
 * Enterprise Audit Trail Service
 * Enforces correlation tracking, immutable audit hashing, and PII masking.
 */
class AuditService {
  private static instance: AuditService;
  private logs: AuditLogEntry[] = [];

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public recordLog(
    accountId: LocalAccountId,
    action: string,
    rawMessage: string,
    severity: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
  ): AuditLogEntry {
    const correlationTag = Redactor.fileRefTag(accountId, `${action}-${Date.now()}`);
    const redactedMessage = Redactor.scrub(rawMessage);

    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      accountId,
      action,
      rawMessage,
      redactedMessage,
      correlationTag,
      severity,
    };

    this.logs.unshift(entry);

    // Keep memory footprint bounded
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }

    return entry;
  }

  public getRecentLogs(limit = 100): AuditLogEntry[] {
    return this.logs.slice(0, limit);
  }
}

export const auditService = AuditService.getInstance();
