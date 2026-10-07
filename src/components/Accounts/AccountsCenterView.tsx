import React, { useState } from 'react';
import {
  Cloud,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  Unlink,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { AccountState, PROVIDERS } from '../../types';
import { humanReadableBytes, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

interface AccountsCenterViewProps {
  onOpenAddAccount: () => void;
}

export const AccountsCenterView: React.FC<AccountsCenterViewProps> = ({
  onOpenAddAccount,
}) => {
  const {
    accounts,
    quotas,
    disconnectAccount,
    reconnectAccount,
    addAuditLog,
    syncStatuses,
    syncAccount,
    syncAllAccounts,
    simulateProviderIssue,
  } = useFileManager();

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleTestConnection = async (accId: number, name: string) => {
    reconnectAccount(accId);
    await syncAccount(accId);
    addAuditLog(accId, 'ACCOUNT_PING', `Exercised live health check for ${name}`);
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    await syncAllAccounts();
    setIsSyncingAll(false);
  };

  const getRelativeTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Connected Cloud Accounts</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time background sync cadence, connection health, and OAuth isolation across cloud endpoints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            <span>Sync All Clouds</span>
          </button>

          <button
            onClick={onOpenAddAccount}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Connect Account</span>
          </button>
        </div>
      </div>

      {/* Global Sync Health Summary Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Multi-Cloud Synchronization Active
              </h3>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Polling Delta Changes</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated background polling every 5 minutes with change-token verification and rate-limit guardrails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0 font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase">Connected Clouds</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{accounts.length} Accounts</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase">Avg Latency</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">~38ms</span>
          </div>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const quota = quotas[acc.localId];
          const provider = PROVIDERS[acc.provider];
          const sync = syncStatuses[acc.localId] || {
            provider: acc.provider,
            accountId: acc.localId,
            status: 'synced',
            lastSyncedAt: Date.now() - 120_000,
            latencyMs: 38,
            itemsSynced: 25,
            autoSyncIntervalMinutes: 5,
          };

          const isSyncing = sync.status === 'syncing';
          const isError = sync.status === 'error';
          const isWarning = sync.status === 'warning';

          const usedPercent =
            quota?.limitBytes && quota.limitBytes > 0
              ? Math.round((quota.usedBytes / quota.limitBytes) * 100)
              : 0;

          return (
            <div
              key={acc.localId}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs space-y-4 transition ${
                isError
                  ? 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-400/20'
                  : isWarning
                  ? 'border-amber-300 dark:border-amber-800 ring-2 ring-amber-400/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Account Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-xs"
                    style={{ backgroundColor: acc.color }}
                  >
                    {provider.shortName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate flex items-center gap-1.5">
                      <span>{acc.displayName}</span>
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: provider.brandColor }}
                        title={provider.name}
                      />
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{acc.displayEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      acc.state === AccountState.CONNECTED && !isError
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className="text-slate-600 dark:text-slate-300">
                    {isError ? 'Connection Alert' : acc.state}
                  </span>
                </div>
              </div>

              {/* Dedicated Background Sync Status Box */}
              <div
                className={`p-3 rounded-xl border space-y-2 text-xs transition ${
                  isError
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                    : isWarning
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                    : isSyncing
                    ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isError ? (
                      <>
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Remote Connection Error</span>
                      </>
                    ) : isWarning ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Degraded / Rate Limited</span>
                      </>
                    ) : isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                        <span>Syncing Delta Tokens...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Background Sync Healthy</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => syncAccount(acc.localId)}
                    disabled={isSyncing}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                </div>

                {/* Clean unboxed telemetry metrics */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Last Synced</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                      {getRelativeTime(sync.lastSyncedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Cadence</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Every {sync.autoSyncIntervalMinutes}m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Latency</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                      {sync.latencyMs}ms
                    </span>
                  </div>
                </div>

                {/* Connection Error Message & Recovery */}
                {isError && (
                  <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 space-y-1.5">
                    <p className="text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>{sync.errorMessage || 'OAuth token expired or cloud endpoint unreachable.'}</span>
                    </p>
                    <button
                      onClick={() => {
                        simulateProviderIssue(acc.localId, 'none');
                        syncAccount(acc.localId);
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                    >
                      Reconnect Account & Restore Health
                    </button>
                  </div>
                )}

                {/* Connection Warning Message & Recovery */}
                {isWarning && (
                  <div className="pt-2 border-t border-amber-200 dark:border-amber-900/60 space-y-1">
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      {sync.errorMessage || 'Rate limit threshold exceeded (429 Backoff Active). Requests temporarily throttled.'}
                    </p>
                    <button
                      onClick={() => {
                        simulateProviderIssue(acc.localId, 'none');
                        syncAccount(acc.localId);
                      }}
                      className="text-[11px] text-amber-900 dark:text-amber-200 font-semibold underline"
                    >
                      Reset rate limit counter & re-verify
                    </button>
                  </div>
                )}
              </div>

              {/* Provider & Quota Bar */}
              {quota && (
                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {provider.name} Quota
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                      {humanReadableBytes(quota.usedBytes)} of{' '}
                      {humanReadableBytes(quota.limitBytes)} ({usedPercent}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-750 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        usedPercent > 90
                          ? 'bg-rose-600'
                          : usedPercent > 75
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, usedPercent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                    <span className="font-mono tabular-nums">
                      {humanReadableBytes((quota.limitBytes || 0) - quota.usedBytes)} free
                    </span>
                    <a
                      href={quota.manageUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Manage storage</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Granted Scopes as Clean Unboxed Text with Dot Separators */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Granted Authorization Scopes
                </span>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {acc.grantedScopes.map((scope, idx) => (
                    <React.Fragment key={scope}>
                      {idx > 0 && (
                        <span className="text-slate-300 dark:text-slate-600 select-none" aria-hidden="true">
                          ·
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {scope.split('/').pop()}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Verified timestamp & Action buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                  Verified: {formatDate(acc.lastVerifiedAt)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(acc.localId, acc.displayName)}
                    className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    title="Live connection ping"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      disconnectAccount(acc.localId);
                      toast.success(`Disconnected ${acc.displayName}. Tokens and local cache purged.`);
                    }}
                    className="px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-medium transition flex items-center gap-1 border border-rose-200 dark:border-rose-900/60 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
