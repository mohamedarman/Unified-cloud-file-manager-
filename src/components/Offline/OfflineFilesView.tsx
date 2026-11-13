import React from 'react';
import {
  WifiOff,
  HardDrive,
  Trash2,
  FileQuestion,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudFile, cacheKey } from '../../types';
import { FileItemCard } from '../FileBrowser/FileItemCard';
import { FileItemRow } from '../FileBrowser/FileItemRow';
import { humanReadableBytes } from '../../utils/formatters';

interface OfflineFilesViewProps {
  onOpenDetails: (file: CloudFile) => void;
}

export const OfflineFilesView: React.FC<OfflineFilesViewProps> = ({ onOpenDetails }) => {
  const { files, viewMode, offlineCacheStats, evictOfflineCache } = useFileManager();

  // Only show files whose bytes are genuinely pinned in the local offline cache
  const offlineFiles = files.filter((f) => !f.isTrashed && f.isOfflineAvailable);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <WifiOff className="w-6 h-6 text-emerald-600" />
            <span>Offline Pinned Files Cache</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            File bytes cached in IndexedDB / Android Native Cache for offline reading and instant download
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl font-medium">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span>
              Cache Used: {humanReadableBytes(offlineCacheStats.totalBytes)} ({offlineCacheStats.pinnedCount} pinned)
            </span>
          </div>

          {offlineCacheStats.pinnedCount > 0 && (
            <button
              onClick={() => void evictOfflineCache()}
              className="flex items-center gap-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Evict Cache</span>
            </button>
          )}
        </div>
      </div>

      {offlineFiles.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <FileQuestion className="w-12 h-12 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">No files pinned for offline access</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Open any file&apos;s Details menu and select &quot;Pin for Offline Access&quot; to download and store its bytes in the local device cache.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {offlineFiles.map((file) => (
            <FileItemCard
              key={cacheKey(file.ref)}
              file={file}
              onOpenDetails={onOpenDetails}
              onDoubleClick={onOpenDetails}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 hidden sm:table-cell">Cached Size</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {offlineFiles.map((file) => (
                <FileItemRow
                  key={cacheKey(file.ref)}
                  file={file}
                  onOpenDetails={onOpenDetails}
                  onDoubleClick={onOpenDetails}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
