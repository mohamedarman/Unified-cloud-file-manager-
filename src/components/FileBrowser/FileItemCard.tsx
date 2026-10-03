import React from 'react';
import { Star, Download, Eye, Trash2 } from 'lucide-react';
import { CloudFile, cacheKey } from '../../types';
import { useFileManager } from '../../context/FileManagerContext';
import { FileIcon, getFileTypeDetails } from './FileIcon';
import { AccountBadge } from './AccountBadge';
import { humanReadableBytes, formatShortDate } from '../../utils/formatters';

interface FileItemCardProps {
  file: CloudFile;
  onOpenDetails: (file: CloudFile) => void;
  onDoubleClick: (file: CloudFile) => void;
}

export const FileItemCard: React.FC<FileItemCardProps> = ({
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
  } = useFileManager();

  const key = cacheKey(file.ref);
  const isSelected = selectedFileKeys.has(key);
  const fileMeta = getFileTypeDetails(file.mimeType, file.name, file.isFolder);

  return (
    <div
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          toggleSelectFile(key);
        } else {
          onOpenDetails(file);
        }
      }}
      onDoubleClick={() => onDoubleClick(file)}
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-150 p-3 flex flex-col justify-between cursor-pointer select-none hover:shadow-md ${
        isSelected
          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Top Header: Account Badge & Selection Checkbox */}
      <div className="flex items-center justify-between mb-2">
        <AccountBadge accountId={file.ref.accountId} />

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleStar(file);
            }}
            className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
              file.isStarred ? 'text-amber-500 fill-amber-500 opacity-100' : 'text-slate-400'
            }`}
            title={file.isStarred ? 'Starred' : 'Star file'}
          >
            <Star className={`w-4 h-4 ${file.isStarred ? 'fill-amber-400' : ''}`} />
          </button>

          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelectFile(key);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Center preview/icon with category-themed ambient backdrop */}
      <div
        className={`relative h-28 flex items-center justify-center my-1 rounded-xl overflow-hidden border transition-all duration-200 ${
          file.thumbnailLink
            ? 'bg-slate-900/5 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800'
            : `${fileMeta.bgLightClass} dark:bg-slate-800/80 ${fileMeta.borderClass} dark:border-slate-700`
        }`}
      >
        {file.thumbnailLink ? (
          <>
            <img
              src={file.thumbnailLink}
              alt={file.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              loading="lazy"
            />
            {/* Format badge on thumbnail */}
            <span
              className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider backdrop-blur-md bg-white/90 border border-slate-200 ${fileMeta.textColorClass}`}
            >
              {fileMeta.badgeText}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5">
            <FileIcon
              mimeType={file.mimeType}
              fileName={file.name}
              isFolder={file.isFolder}
              className="w-10 h-10 transition-transform group-hover:scale-110 duration-200"
            />
            <span
              className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border shadow-2xs uppercase tracking-wider ${fileMeta.bgLightClass} ${fileMeta.borderClass} ${fileMeta.textColorClass}`}
            >
              {fileMeta.badgeText}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <p
            className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition"
            title={file.name}
          >
            {file.name}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span className="truncate max-w-[90px]">{fileMeta.label}</span>
          <span className="font-mono text-[10px]">
            {file.isFolder ? 'Folder' : humanReadableBytes(file.sizeBytes)}
          </span>
        </div>
      </div>
    </div>
  );
};
