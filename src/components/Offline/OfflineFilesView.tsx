import React from 'react';
import {
  WifiOff,
  Download,
  FolderOpen,
  CheckCircle2,
  HardDrive,
  Trash2,
  FileQuestion,
  ExternalLink,
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
  const { files, viewMode, downloadFile } = useFileManager();

  // Find files flagged for offline access (or sample offline files)
  const offlineFiles = files.filter(
    (f) =>
      !f.isTrashed &&
      (f.isOfflineAvailable ||
        f.isStarred ||
        f.mimeType === 'application/pdf' ||
        f.thumbnailLink)
  );

  const totalOfflineSize = offlineFiles.reduce(
    (acc, f) => acc + (f.sizeBytes || 1024 * 1024),
    0
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <WifiOff className="w-6 h-6 text-emerald-600" />
            <span>Offline Files & Downloads Vault</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Files stored locally on your device for immediate offline access without data usage
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
          <HardDrive className="w-4 h-4 text-emerald-600" />
          <span>Offline Vault: {humanReadableBytes(totalOfflineSize)}</span>
        </div>
      </div>

      {offlineFiles.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center bg-white rounded-2xl border border-slate-200">
          <FileQuestion className="w-12 h-12 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700 text-sm">No files cached for offline use</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Star important files or click "Download" to make documents and media available when disconnected.
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 hidden sm:table-cell">Size</th>
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
