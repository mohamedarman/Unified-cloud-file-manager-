import React from 'react';
import {
  HardDrive,
  ExternalLink,
  AlertTriangle,
  Database,
  Cloud,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import { humanReadableBytes } from '../../utils/formatters';

export const QuotaGovernorView: React.FC = () => {
  const { accounts, quotas } = useFileManager();

  // Calculate global aggregate totals
  const totalLimitBytes = Object.values(quotas).reduce((acc, q) => acc + (q?.limitBytes || 0), 0);
  const totalUsedBytes = Object.values(quotas).reduce((acc, q) => acc + (q?.usedBytes || 0), 0);
  const totalFreeBytes = Math.max(0, totalLimitBytes - totalUsedBytes);
  const aggregateUsedPercent = totalLimitBytes > 0 ? Math.round((totalUsedBytes / totalLimitBytes) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-950 pb-28 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">
          Cloud Storage Space
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Simple breakdown of used and free storage space per connected cloud account
        </p>
      </div>

      {/* Aggregate Storage Card */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Total Connected Cloud Storage</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {accounts.length} Cloud {accounts.length === 1 ? 'Account' : 'Accounts'} Connected
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            {aggregateUsedPercent}% Used
          </span>
        </div>

        {/* Global Storage Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, aggregateUsedPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono pt-1">
            <span>Used: <strong className="text-slate-800 dark:text-slate-200">{humanReadableBytes(totalUsedBytes)}</strong></span>
            <span>Free: <strong className="text-slate-800 dark:text-slate-200">{humanReadableBytes(totalFreeBytes)}</strong></span>
            <span>Total: <strong className="text-slate-800 dark:text-slate-200">{humanReadableBytes(totalLimitBytes)}</strong></span>
          </div>
        </div>
      </div>

      {/* Individual Account Quota Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Storage Usage Per Connected Cloud
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const quota = quotas[acc.localId];
            if (!quota) return null;

            const usedBytes = quota.usedBytes || 0;
            const limitBytes = quota.limitBytes || 0;
            const freeBytes = Math.max(0, limitBytes - usedBytes);
            const usedPercent = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 100) : 0;

            const isWarning = usedPercent >= 80;
            const isDanger = usedPercent >= 95;

            return (
              <div
                key={acc.localId}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color }}
                      />
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                        {acc.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                      {acc.displayEmail}
                    </span>
                  </div>

                  <AccountBadge accountId={acc.localId} />
                </div>

                {/* Progress Bar & Space Numbers */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {humanReadableBytes(usedBytes)} used
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {humanReadableBytes(freeBytes)} free
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
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

                  <div className="flex justify-between items-center text-[11px] text-slate-400 dark:text-slate-500 pt-0.5 font-mono">
                    <span>{usedPercent}% used of {humanReadableBytes(limitBytes)}</span>
                    {isDanger && (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 font-sans">
                        <AlertTriangle className="w-3 h-3" /> Almost full
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Manage Space Link */}
                {quota.manageUrl && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 dark:text-slate-500">Cloud Storage</span>
                    <a
                      href={quota.manageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Manage space</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
