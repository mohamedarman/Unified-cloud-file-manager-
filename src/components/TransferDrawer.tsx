import React, { useState, useMemo } from 'react';
import {
  Upload,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Activity,
  Layers,
  FileCheck,
} from 'lucide-react';
import { useFileManager } from '../context/FileManagerContext';
import { humanReadableBytes } from '../utils/formatters';
import { TransferItem, TransferStatus } from '../types';

export const TransferDrawer: React.FC = () => {
  const {
    transfers,
    cancelTransfer,
    clearCompletedTransfers,
    retryTransfer,
    pauseResumeTransfer,
    accounts,
  } = useFileManager();

  const [isMinimized, setIsMinimized] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  if (transfers.length === 0) return null;

  // Compute aggregate statistics
  const activeTransfers = transfers.filter(
    (t) => t.status.status === 'Running' || t.status.status === 'Queued' || t.status.status === 'Paused'
  );
  const completedTransfers = transfers.filter((t) => t.status.status === 'Completed');
  const failedOrCancelledTransfers = transfers.filter(
    (t) => t.status.status === 'Failed' || t.status.status === 'Cancelled'
  );

  const totalBytesAll = transfers.reduce((sum, t) => sum + (t.totalBytes || 0), 0);
  const transferredBytesAll = transfers.reduce((sum, t) => sum + t.bytesTransferred, 0);
  const overallProgress = totalBytesAll > 0 ? Math.round((transferredBytesAll / totalBytesAll) * 100) : 0;

  const aggregateSpeed = activeTransfers.reduce((sum, t) => {
    if (t.status.status === 'Running') {
      return sum + (t.status.speedBytesPerSec || 0);
    }
    return sum;
  }, 0);

  // Filter transfers for display
  const displayedTransfers = transfers.filter((t) => {
    if (filterTab === 'ACTIVE') {
      return t.status.status === 'Running' || t.status.status === 'Queued' || t.status.status === 'Paused';
    }
    if (filterTab === 'COMPLETED') {
      return t.status.status === 'Completed' || t.status.status === 'Failed' || t.status.status === 'Cancelled';
    }
    return true;
  });

  const getAccountLabel = (accountId: number) => {
    const acc = accounts.find((a) => a.localId === accountId);
    return acc ? acc.badgeLabel : 'Cloud Drive';
  };

  const calculateEta = (transfer: TransferItem): string | null => {
    if (transfer.status.status !== 'Running' || !transfer.totalBytes) return null;
    const remainingBytes = Math.max(0, transfer.totalBytes - transfer.bytesTransferred);
    const speed = transfer.status.speedBytesPerSec;
    if (!speed || speed <= 0) return null;
    const seconds = Math.ceil(remainingBytes / speed);
    if (seconds < 60) return `${seconds}s left`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m left`;
  };

  // Minimized Compact Pill Mode
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-40 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl p-2.5 px-3.5 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-blue-500 transition-all group select-none"
      >
        <div className="relative flex items-center justify-center">
          {activeTransfers.length > 0 ? (
            <>
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500" />
            </>
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span>
              {activeTransfers.length > 0
                ? `${activeTransfers.length} Active Transfer${activeTransfers.length > 1 ? 's' : ''}`
                : 'All Transfers Complete'}
            </span>
            {activeTransfers.length > 0 && (
              <span className="text-[10px] font-mono text-blue-400 font-bold">
                {overallProgress}%
              </span>
            )}
          </div>
          {activeTransfers.length > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">
              {humanReadableBytes(aggregateSpeed)}/s aggregate
            </span>
          )}
        </div>

        <button
          className="text-slate-400 group-hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          title="Expand Transfer Drawer"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs flex flex-col transition-all duration-200">
      {/* 1. Header with Aggregate Progress Overview */}
      <div className="bg-slate-900 text-white p-3.5 flex flex-col gap-2.5 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              {activeTransfers.length > 0 ? (
                <Activity className="w-4 h-4 animate-pulse text-blue-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs">Transfers & Background Tasks</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                  {transfers.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {activeTransfers.length > 0
                  ? `${activeTransfers.length} running · ${humanReadableBytes(aggregateSpeed)}/s`
                  : 'Idle · No active tasks'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {completedTransfers.length > 0 && (
              <button
                onClick={clearCompletedTransfers}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition text-[10px] flex items-center gap-1"
                title="Clear completed tasks"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              onClick={() => setIsMinimized(true)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
              title="Minimize drawer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Aggregate Progress Bar */}
        {activeTransfers.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center text-[10px] text-slate-300 font-mono">
              <span>Overall Fleet Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Sub-Header Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-2 py-0.5 rounded-md transition ${
              filterTab === 'ALL'
                ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({transfers.length})
          </button>
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-2 py-0.5 rounded-md transition ${
              filterTab === 'ACTIVE'
                ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active ({activeTransfers.length})
          </button>
          <button
            onClick={() => setFilterTab('COMPLETED')}
            className={`px-2 py-0.5 rounded-md transition ${
              filterTab === 'COMPLETED'
                ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Finished ({completedTransfers.length + failedOrCancelledTransfers.length})
          </button>
        </div>

        <span className="text-[10px] text-slate-400 font-mono">
          {humanReadableBytes(transferredBytesAll)} of {humanReadableBytes(totalBytesAll)}
        </span>
      </div>

      {/* 3. Granular File Transfers List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 space-y-2">
        {displayedTransfers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <FileCheck className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              No transfers in this view
            </p>
          </div>
        ) : (
          displayedTransfers.map((transfer) => {
            const isUpload = transfer.direction === 'UPLOAD';
            const status = transfer.status;
            const progress =
              status.status === 'Running'
                ? status.progress
                : status.status === 'Completed'
                ? 100
                : status.status === 'Paused'
                ? transfer.totalBytes
                  ? Math.round((transfer.bytesTransferred / transfer.totalBytes) * 100)
                  : 50
                : 0;

            const eta = calculateEta(transfer);
            const accountLabel = getAccountLabel(transfer.ref.accountId);

            return (
              <div
                key={transfer.id}
                className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                {/* File Title & Direction Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isUpload
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                      }`}
                      title={isUpload ? 'File Upload' : 'File Download'}
                    >
                      {isUpload ? <Upload className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight"
                        title={transfer.fileName}
                      >
                        {transfer.fileName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                        <span className="font-mono">{accountLabel}</span>
                        <span>·</span>
                        <span className="font-mono uppercase font-semibold">
                          {isUpload ? 'Upload' : 'Download'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Per-Item Action Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Pause / Resume button */}
                    {(status.status === 'Running' || status.status === 'Paused') && (
                      <button
                        onClick={() => pauseResumeTransfer(transfer.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-750 transition"
                        title={status.status === 'Running' ? 'Pause transfer' : 'Resume transfer'}
                      >
                        {status.status === 'Running' ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-blue-500" />
                        )}
                      </button>
                    )}

                    {/* Retry button for Failed / Cancelled */}
                    {(status.status === 'Failed' || status.status === 'Cancelled') && (
                      <button
                        onClick={() => retryTransfer(transfer.id)}
                        className="p-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition"
                        title="Retry transfer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Cancel button */}
                    {(status.status === 'Running' || status.status === 'Queued' || status.status === 'Paused') && (
                      <button
                        onClick={() => cancelTransfer(transfer.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Cancel transfer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Granular Visual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        status.status === 'Completed'
                          ? 'bg-emerald-500'
                          : status.status === 'Cancelled'
                          ? 'bg-slate-400'
                          : status.status === 'Failed'
                          ? 'bg-rose-500'
                          : status.status === 'Paused'
                          ? 'bg-amber-400'
                          : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 animate-pulse'
                      }`}
                      style={{ width: `${Math.max(4, progress)}%` }}
                    />
                  </div>

                  {/* Granular Progress Metrics & Speed Telemetry */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>
                        {humanReadableBytes(transfer.bytesTransferred)} /{' '}
                        {transfer.totalBytes ? humanReadableBytes(transfer.totalBytes) : 'Unknown'}
                      </span>
                      {status.status === 'Running' && status.speedBytesPerSec > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            {humanReadableBytes(status.speedBytesPerSec)}/s
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {eta && <span className="text-slate-400">{eta}</span>}
                      <span
                        className={`font-semibold px-1 py-0.2 rounded text-[9px] uppercase ${
                          status.status === 'Completed'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                            : status.status === 'Running'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                            : status.status === 'Paused'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                            : status.status === 'Failed'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {status.status === 'Running' ? `${progress}%` : status.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error message detail if failed */}
                {status.status === 'Failed' && status.error && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-lg">
                    {status.error}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
