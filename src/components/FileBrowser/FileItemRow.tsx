import React from 'react';
import { Star, Download, Eye, Trash2, RotateCcw } from 'lucide-react';
import { CloudFile, cacheKey } from '../../types';
import { useFileManager } from '../../context/FileManagerContext';
import { FileIcon, getFileTypeDetails } from './FileIcon';
import { AccountBadge } from './AccountBadge';
import { humanReadableBytes, formatDate } from '../../utils/formatters';

interface FileItemRowProps {
  file: CloudFile;
  onOpenDetails: (file: CloudFile) => void;
  onDoubleClick: (file: CloudFile) => void;
}

export const FileItemRow: React.FC<FileItemRowProps> = ({
  file,
  onOpenDetails,
  onDoubleClick,
}) => {
  const {
    selectedFileKeys,
    toggleSelectFile,
    toggleStar,
    downloadFile,
    trashFile,
    restoreFile,
  } = useFileManager();

  const key = cacheKey(file.ref);
  const isSelected = selectedFileKeys.has(key);
  const fileMeta = getFileTypeDetails(file.mimeType, file.name, file.isFolder);

  return (
    <tr
      onClick={() => onOpenDetails(file)}
      onDoubleClick={() => onDoubleClick(file)}
      className={`group border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-850 cursor-pointer text-xs select-none transition ${
        isSelected ? 'bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/50' : ''
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelectFile(key)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>

      {/* Name, Icon, and MIME Type Badge */}
      <td className="px-3 py-2.5 max-w-xs md:max-w-md">
        <div className="flex items-center gap-2.5">
          {/* Form-factor icon box with soft category backdrop */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${fileMeta.bgLightClass} dark:bg-slate-800 ${fileMeta.borderClass} dark:border-slate-700`}
          >
            <FileIcon
              mimeType={file.mimeType}
              fileName={file.name}
              isFolder={file.isFolder}
              className="w-4 h-4"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition"
                title={file.name}
              >
                {file.name}
              </span>
              <span
                className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded border shadow-2xs uppercase tracking-wider shrink-0 hidden sm:inline-block ${fileMeta.bgLightClass} dark:bg-slate-800 ${fileMeta.borderClass} dark:border-slate-700 ${fileMeta.textColorClass}`}
              >
                {fileMeta.badgeText}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
              {fileMeta.label}
            </span>
          </div>
        </div>
      </td>

      {/* Account Attribution Badge */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <AccountBadge accountId={file.ref.accountId} showEmail />
      </td>

      {/* Modified Date */}
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">
        {formatDate(file.modifiedTimeMillis)}
      </td>

      {/* File Size */}
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap hidden md:table-cell font-mono text-[11px]">
        {file.isFolder ? '—' : humanReadableBytes(file.sizeBytes)}
      </td>

      {/* Quick Actions */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleStar(file);
            }}
            className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
              file.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-400 opacity-0 group-hover:opacity-100'
            }`}
            title={file.isStarred ? 'Starred' : 'Star file'}
          >
            <Star className={`w-4 h-4 ${file.isStarred ? 'fill-amber-400' : ''}`} />
          </button>

          {!file.isFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadFile(file);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition opacity-0 group-hover:opacity-100"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {file.isTrashed ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                restoreFile(file);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 transition opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Restore from Trash"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                trashFile(file);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 transition opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Move to Trash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
