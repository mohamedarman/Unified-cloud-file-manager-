import React, { useEffect, useState } from 'react';
import { X, History, User, Clock, RefreshCw } from 'lucide-react';
import { CloudFile, FileRevision } from '../../types';
import { formatDate, humanReadableBytes } from '../../utils/formatters';
import { cloudProviderService } from '../../services/cloudProviderService';

interface RevisionsModalProps {
  file: CloudFile;
  onClose: () => void;
}

export const RevisionsModal: React.FC<RevisionsModalProps> = ({ file, onClose }) => {
  const [revisions, setRevisions] = useState<FileRevision[]>(file.revisions || []);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadLiveRevisions = async () => {
      if (!cloudProviderService.hasLiveToken(file.ref.accountId)) {
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        const liveRevs = await cloudProviderService.fetchRevisions(
          {
            localId: file.ref.accountId,
            provider: file.ref.provider,
            providerAccountId: String(file.ref.accountId),
            displayEmail: '',
            displayName: '',
            badgeLabel: '',
            color: '#2563EB',
            state: 'CONNECTED' as any,
            grantedScopes: ['read'],
            lastVerifiedAt: Date.now(),
          },
          file
        );
        if (!cancelled) {
          setRevisions(liveRevs);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to load revisions from provider'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void loadLiveRevisions();
    return () => {
      cancelled = true;
    };
  }, [file.ref.accountId, file.ref.fileId, file.ref.provider]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 text-slate-900 dark:text-slate-100 transition-colors"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Version History</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs">{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Querying provider revision history...</span>
          </div>
        ) : errorMessage ? (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-200">
            {errorMessage}
          </div>
        ) : revisions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Not available — no revision history returned by provider for this file.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {revisions.map((rev, index) => (
              <div
                key={rev.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  index === 0
                    ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-800'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {rev.label || `Revision ${revisions.length - index}`}
                    </span>
                    {index === 0 && (
                      <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">
                        Latest
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(rev.modifiedTimeMillis)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {rev.modifiedBy}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium block">
                    {humanReadableBytes(rev.sizeBytes)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
