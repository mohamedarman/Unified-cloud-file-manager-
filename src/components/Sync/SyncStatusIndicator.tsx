import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cloud,
  ChevronDown,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { PROVIDERS } from '../../types';

export const SyncStatusIndicator: React.FC = () => {
  const {
    accounts,
    syncStatuses,
    syncAccount,
    syncAllAccounts,
    simulateProviderIssue,
  } = useFileManager();

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format relative time helper
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

  // Summarize overall health
  const statusesList = accounts.map((acc) => syncStatuses[acc.localId]).filter(Boolean);
  const hasError = statusesList.some((s) => s.status === 'error');
  const hasWarning = statusesList.some((s) => s.status === 'warning');
  const isSyncing = statusesList.some((s) => s.status === 'syncing') || isSyncingAll;

  // Most recent sync timestamp
  const latestSyncTime = Math.max(...statusesList.map((s) => s.lastSyncedAt || 0), 0);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    await syncAllAccounts();
    setIsSyncingAll(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Navbar Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
          hasError
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
            : hasWarning
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
            : isSyncing
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60'
            : 'bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 shadow-2xs'
        }`}
        title="Multi-Cloud Background Synchronization Status"
      >
        {/* Pulse micro-indicator */}
        <span className="relative flex h-2 w-2">
          {isSyncing && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              hasError
                ? 'bg-rose-500'
                : hasWarning
                ? 'bg-amber-500'
                : isSyncing
                ? 'bg-blue-500'
                : 'bg-emerald-500'
            }`}
          />
        </span>

        {/* Status text */}
        <span className="hidden sm:inline font-semibold">
          {hasError
            ? 'Sync Issue'
            : hasWarning
            ? 'Degraded'
            : isSyncing
            ? 'Syncing'
            : 'Synced'}
        </span>

        {/* Clean unboxed relative time */}
        <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:inline font-mono tabular-nums">
          {latestSyncTime ? getRelativeTime(latestSyncTime) : 'Ready'}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded Sync Details Popover Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Popover Header */}
          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-850/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Cloud Synchronization</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Delta change-tokens verified in background
              </p>
            </div>

            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white text-[11px] font-semibold shadow-xs transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>Sync All</span>
            </button>
          </div>

          {/* Sync Providers List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 space-y-1">
            {accounts.map((acc) => {
              const provider = PROVIDERS[acc.provider];
              const sync = syncStatuses[acc.localId] || {
                provider: acc.provider,
                accountId: acc.localId,
                status: 'synced',
                lastSyncedAt: Date.now(),
                latencyMs: 35,
                itemsSynced: 10,
                autoSyncIntervalMinutes: 5,
              };

              const isItemSyncing = sync.status === 'syncing';
              const isItemError = sync.status === 'error';
              const isItemWarning = sync.status === 'warning';

              return (
                <div
                  key={acc.localId}
                  className={`p-3 rounded-xl border transition-all ${
                    isItemError
                      ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                      : isItemWarning
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                      : isItemSyncing
                      ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                      : 'bg-white dark:bg-slate-850/60 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Provider Brand & Account */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs"
                        style={{ backgroundColor: acc.color }}
                      >
                        {provider.shortName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                            {acc.displayName}
                          </p>
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: provider.brandColor }}
                            title={provider.name}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {acc.displayEmail}
                        </p>
                      </div>
                    </div>

                    {/* Single Sync Button */}
                    <button
                      onClick={() => syncAccount(acc.localId)}
                      disabled={isItemSyncing}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer"
                      title="Sync this cloud account now"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isItemSyncing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Clean unboxed metadata with dot separators */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 font-medium">
                      {isItemError ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Connection Error</span>
                        </span>
                      ) : isItemWarning ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Degraded / Throttled</span>
                        </span>
                      ) : isItemSyncing ? (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Checking delta changes...</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Healthy</span>
                        </span>
                      )}
                    </div>

                    {/* Clean unboxed telemetry */}
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px] tabular-nums">
                      <span>{sync.latencyMs}ms</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {getRelativeTime(sync.lastSyncedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Error Diagnostic Message */}
                  {isItemError && (
                    <div className="mt-2 p-2.5 bg-rose-100/70 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                      <p className="font-semibold text-rose-950 dark:text-rose-100 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Remote connection issue</span>
                      </p>
                      <p className="text-[11px] text-rose-800 dark:text-rose-300">
                        {sync.errorMessage ||
                          'OAuth token expired or cloud endpoint unreachable.'}
                      </p>
                      <button
                        onClick={() => {
                          simulateProviderIssue(acc.localId, 'none');
                          syncAccount(acc.localId);
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-semibold transition"
                      >
                        Reconnect & Refresh Token
                      </button>
                    </div>
                  )}

                  {/* Warning Message */}
                  {isItemWarning && (
                    <div className="mt-2 p-2 bg-amber-100/70 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        {sync.errorMessage ||
                          'Rate limit ceiling approached. Backing off automatically.'}
                      </p>
                      <button
                        onClick={() => {
                          simulateProviderIssue(acc.localId, 'none');
                          syncAccount(acc.localId);
                        }}
                        className="text-[10px] text-amber-900 dark:text-amber-200 font-semibold underline"
                      >
                        Reset throttling ceiling
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Diagnostic Tools */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Cadence: every 5 min</span>
            </span>

            <button
              onClick={() => {
                const target = accounts[0]?.localId;
                if (target) {
                  const current = syncStatuses[target]?.status;
                  simulateProviderIssue(
                    target,
                    current === 'error' ? 'none' : 'error'
                  );
                }
              }}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline transition font-medium"
            >
              Test Diagnostics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
