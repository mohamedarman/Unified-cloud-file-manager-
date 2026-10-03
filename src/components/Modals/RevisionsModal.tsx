import React from 'react';
import { X, History, User, Clock } from 'lucide-react';
import { CloudFile } from '../../types';
import { formatDate, humanReadableBytes } from '../../utils/formatters';

interface RevisionsModalProps {
  file: CloudFile;
  onClose: () => void;
}

export const RevisionsModal: React.FC<RevisionsModalProps> = ({ file, onClose }) => {
  const revisions = file.revisions || [
    {
      id: 'rev_current',
      modifiedTimeMillis: file.modifiedTimeMillis,
      sizeBytes: file.sizeBytes || 24000,
      modifiedBy: 'You',
      label: 'Current Version',
    },
  ];

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

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {revisions.map((rev, index) => (
            <div
              key={rev.id}
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                index === 0
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {rev.label || `Revision ${revisions.length - index}`}
                  </span>
                  {index === 0 && (
                    <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500">
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
                <span className="text-[11px] text-slate-600 font-medium block">
                  {humanReadableBytes(rev.sizeBytes)}
                </span>
                <button
                  onClick={() => alert(`Restoring revision "${rev.label || rev.id}"...`)}
                  className="mt-1 text-[10px] text-blue-600 hover:underline font-medium"
                >
                  Restore this
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
