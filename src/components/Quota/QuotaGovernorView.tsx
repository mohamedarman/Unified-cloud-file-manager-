import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  ExternalLink,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import { StorageVisualizer } from './StorageVisualizer';
import { humanReadableBytes } from '../../utils/formatters';
import { globalQuotaGovernor, ProvisionalBudgets } from '../../utils/quotaGovernor';

export const QuotaGovernorView: React.FC = () => {
  const { accounts, quotas, quotaSnapshot, refreshQuotaSnapshot, addAuditLog } = useFileManager();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);

  // Periodically refresh the quota snapshot countdown
  useEffect(() => {
    const timer = setInterval(() => {
      refreshQuotaSnapshot();
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSimulateLoad = async () => {
    if (accounts.length === 0) return;
    setIsSimulating(true);
    setSimulationLog([]);

    const log = (msg: string) => {
      setSimulationLog((prev) => [msg, ...prev.slice(0, 15)]);
    };

    log('⚡ Starting burst simulation: 6 parallel requests across accounts...');

    // Fire 6 concurrent requests to test per-account and global governor limits
    const tasks = accounts.flatMap((acc) =>
      [1, 2, 3].map((idx) => async () => {
        const admission = globalQuotaGovernor.tryAcquire(acc.localId);
        refreshQuotaSnapshot();

        if (admission.granted) {
          log(`✅ Req #${idx} for ${acc.badgeLabel}: Admission GRANTED. Processing in-flight...`);
          addAuditLog(acc.localId, 'GOVERNOR_ADMITTED', `Burst req #${idx} admitted under governor cap.`);
          // Simulate latency
          await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
          globalQuotaGovernor.release(acc.localId);
          refreshQuotaSnapshot();
          log(`🏁 Req #${idx} for ${acc.badgeLabel}: Completed and permit released.`);
        } else {
          log(`🛑 Req #${idx} for ${acc.badgeLabel}: REFUSED by QuotaGovernor (${admission.reason}). Shedding load.`);
          addAuditLog(acc.localId, 'GOVERNOR_REFUSED', `Burst req #${idx} refused: ${admission.reason}`, undefined, 'WARN');
        }
      })
    );

    await Promise.all(tasks.map((t) => t()));
    setIsSimulating(false);
    refreshQuotaSnapshot();
    log('✨ Simulation completed.');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Storage Quotas & Quota Governor Telemetry
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Per-account storage monitoring and client-side concurrency bounds (Rules.md §1 & QD-4)
        </p>
      </div>

      {/* Contractual Language Prohibition Disclaimer (Rules.md §1 & §23) */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs space-y-2">
        <div className="flex items-center gap-2 font-semibold text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-700" />
          <span>Language Prohibition & Architectural Compliance Guarantee</span>
        </div>
        <p className="leading-relaxed text-blue-900">
          Unified Cloud File Manager contributes no storage, pools no quota, and bypasses no Google Drive limits. Storage remains owned, metered, and enforced by each respective Google Account.
        </p>
      </div>

      {/* Recharts Multi-Cloud Data Visualization */}
      <StorageVisualizer />

      {/* 1. Storage Quotas Per Account */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider text-xs">
            Google Account Storage Usage ({accounts.length} connected)
          </h3>
          <span className="text-[11px] text-slate-400">
            Source: Google Drive about.get
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const quota = quotas[acc.localId];
            if (!quota) return null;

            const usedPercent =
              quota.limitBytes && quota.limitBytes > 0
                ? Math.round((quota.usedBytes / quota.limitBytes) * 100)
                : 0;

            const isWarning = usedPercent >= 80;
            const isDanger = usedPercent >= 95;

            return (
              <div
                key={acc.localId}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: acc.color }}
                      />
                      <span className="font-semibold text-slate-900 text-sm">
                        {acc.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 truncate block mt-0.5">
                      {acc.displayEmail}
                    </span>
                  </div>

                  <AccountBadge accountId={acc.localId} />
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {humanReadableBytes(quota.usedBytes)} used
                    </span>
                    <span className="text-slate-500">
                      of {humanReadableBytes(quota.limitBytes)}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isDanger
                          ? 'bg-rose-600'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, usedPercent)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
                    <span>{usedPercent}% capacity</span>
                    {isDanger && (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Almost full
                      </span>
                    )}
                  </div>
                </div>

                {/* Manage Link */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Google One Storage</span>
                  <a
                    href={quota.manageUrl || 'https://one.google.com/storage'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline"
                  >
                    <span>Manage space</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Quota Governor Telemetry (Architecture.md §12.7) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider text-xs">
              Quota Governor Telemetry (ProvisionalBudgets)
            </h3>
            <p className="text-xs text-slate-500">
              Guards against rate limits with client-side concurrency caps and rate budgets
            </p>
          </div>

          <button
            onClick={handleSimulateLoad}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Simulating Load...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Simulate Concurrent Burst</span>
              </>
            )}
          </button>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-400 font-medium">Global Concurrency</span>
            <div className="text-2xl font-bold text-slate-900">
              {quotaSnapshot.inFlightTotal}
              <span className="text-sm font-normal text-slate-400"> / {quotaSnapshot.globalLimit} max</span>
            </div>
            <p className="text-[11px] text-slate-500">Total requests in-flight across all accounts</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-400 font-medium">Per-Account Ceiling</span>
            <div className="text-2xl font-bold text-slate-900">
              {quotaSnapshot.perAccountLimit}
              <span className="text-sm font-normal text-slate-400"> max / acct</span>
            </div>
            <p className="text-[11px] text-slate-500">Prevents one account from monopolizing budget</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-400 font-medium">Rolling Window Budget</span>
            <div className="text-2xl font-bold text-slate-900">
              {quotaSnapshot.requestsInWindow}
              <span className="text-sm font-normal text-slate-400"> / {quotaSnapshot.requestsPerWindow}</span>
            </div>
            <p className="text-[11px] text-slate-500">Pacing ceiling per 100-second window</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs text-slate-400 font-medium">Window Rollover Timer</span>
            <div className="text-2xl font-bold text-slate-900">
              {Math.ceil(quotaSnapshot.millisUntilRefresh / 1000)}
              <span className="text-sm font-normal text-slate-400"> seconds</span>
            </div>
            <p className="text-[11px] text-slate-500">Time remaining in current rate window</p>
          </div>
        </div>

        {/* In-Flight by Account Breakdown */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Active Concurrency by Account
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const count = quotaSnapshot.inFlightByAccount[acc.localId] || 0;
              return (
                <div
                  key={acc.localId}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: acc.color }}
                    />
                    <span className="font-medium text-slate-800">{acc.badgeLabel}</span>
                  </div>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {count} / {quotaSnapshot.perAccountLimit} slots
                  </span>
                </div>
              );
            })}
          </div>

          {/* Simulation Log Output */}
          {simulationLog.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                Live Governor Simulation Trace:
              </span>
              <div className="bg-slate-900 text-slate-200 p-3 rounded-xl text-xs font-mono max-h-36 overflow-y-auto space-y-1">
                {simulationLog.map((line, i) => (
                  <div key={i} className="leading-tight">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
