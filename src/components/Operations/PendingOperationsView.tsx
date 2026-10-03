import React from 'react';
import {
  ListRestart,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Trash,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import { formatDate } from '../../utils/formatters';

export const PendingOperationsView: React.FC = () => {
  const {
    pendingOperations,
    reconcileOperation,
    retryOperation,
    clearCompletedOperations,
  } = useFileManager();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Pending Operations Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Durable offline write queue with reconciliation safeguards against duplicate uploads (PendingOperationEntity.kt & Architecture.md §12)
          </p>
        </div>

        <button
          onClick={clearCompletedOperations}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition"
        >
          <Trash className="w-3.5 h-3.5" />
          <span>Clear Completed</span>
        </button>
      </div>

      {/* Info notice about outcomeUncertain and reconciliation */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-semibold">
          <HelpCircle className="w-4 h-4 text-amber-700" />
          <span>Architectural Safeguard: Outcome Reconciliation (Rule X-1)</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          When an operation loses network connectivity mid-flight, outcomeUncertain is set to true. The system reconciles against Google Drive's actual state before retrying, avoiding duplicate folders or re-uploads.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {pendingOperations.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700 text-sm">All operations settled</p>
            <p className="text-xs text-slate-400 mt-0.5">No write operations are pending in the queue.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Op ID</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Operation</th>
                  <th className="px-4 py-3">File / Target</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Uncertainty</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingOperations.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      #{op.id}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <AccountBadge accountId={op.accountId} />
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                        {op.operation}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-xs truncate" title={op.fileName || op.fileId || ''}>
                      <span className="font-medium text-slate-800">
                        {op.fileName || op.fileId || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          op.state === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : op.state === 'RUNNING'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : op.state === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {op.state}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {op.outcomeUncertain ? (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 w-max">
                          <AlertTriangle className="w-3 h-3" /> Reconcile needed
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Settled</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600 font-mono">
                      {op.attemptCount}
                    </td>

                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {formatDate(op.createdAt)}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {op.outcomeUncertain && (
                          <button
                            onClick={() => reconcileOperation(op.id)}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-medium transition"
                          >
                            Reconcile
                          </button>
                        )}

                        {op.state === 'FAILED' && (
                          <button
                            onClick={() => retryOperation(op.id)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition"
                            title="Retry Operation"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
