import React from 'react';
import {
  X,
  Download,
  Share2,
  Star,
  ExternalLink,
  Edit2,
  FolderInput,
  Trash2,
  Maximize2,
  FileText,
  Clock,
  HardDrive,
} from 'lucide-react';
import { CloudFile, PROVIDERS } from '../../types';
import { useFileManager } from '../../context/FileManagerContext';
import { FileIcon, getFileTypeDetails } from '../FileBrowser/FileIcon';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import { humanReadableBytes, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

interface QuickLookModalProps {
  file: CloudFile | null;
  onClose: () => void;
  onOpenDetails: (file: CloudFile) => void;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  file,
  onClose,
  onOpenDetails,
}) => {
  const { downloadFile, toggleStar, trashFile, accounts } = useFileManager();

  if (!file) return null;

  const meta = getFileTypeDetails(file.mimeType, file.name, file.isFolder);
  const account = accounts.find((a) => a.localId === file.ref.accountId);
  const provider = PROVIDERS[file.ref.provider];

  const handleCopyLink = () => {
    const link =
      file.webViewLink ||
      `https://cloud.filemanager.app/files/${file.ref.provider.toLowerCase()}/${file.ref.accountId}/${file.ref.fileId}`;
    navigator.clipboard.writeText(link);
    toast.success('Share link copied to clipboard');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh] text-slate-900 dark:text-slate-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.bgLightClass} dark:bg-slate-800 ${meta.borderClass} dark:border-slate-700`}
            >
              <FileIcon
                mimeType={file.mimeType}
                fileName={file.name}
                isFolder={file.isFolder}
                className="w-4 h-4"
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate" title={file.name}>
                {file.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <AccountBadge accountId={file.ref.accountId} />
                <span>·</span>
                <span>{meta.label}</span>
                {!file.isFolder && (
                  <>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      {humanReadableBytes(file.sizeBytes)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-4">
            <button
              onClick={() => {
                toggleStar(file);
                toast.success(file.isStarred ? 'Removed from starred' : 'Added to starred');
              }}
              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                file.isStarred ? 'text-amber-500' : 'text-slate-500'
              }`}
              title={file.isStarred ? 'Starred' : 'Star file'}
            >
              <Star className={`w-4 h-4 ${file.isStarred ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
              title="Copy Share Link"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {!file.isFolder && (
              <button
                onClick={() => {
                  downloadFile(file);
                  toast.success(`Downloading ${file.name}`);
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onOpenDetails(file);
              }}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 transition"
              title="Open full inspector"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 relative">
          {file.thumbnailLink ? (
            <img
              src={file.thumbnailLink}
              alt={file.name}
              className="max-h-[460px] max-w-full rounded-xl shadow-md object-contain border border-slate-200 dark:border-slate-800"
            />
          ) : file.previewText ? (
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[440px] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                <span>Text Preview</span>
                <span>UTF-8 Document</span>
              </div>
              {file.previewText}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xs ${meta.bgLightClass} dark:bg-slate-850 ${meta.borderClass} dark:border-slate-700`}
              >
                <FileIcon
                  mimeType={file.mimeType}
                  fileName={file.name}
                  isFolder={file.isFolder}
                  className="w-8 h-8"
                />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {meta.label} · {file.mimeType}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Modified: <strong className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{formatDate(file.modifiedTimeMillis)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span>Storage: <strong className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{file.isFolder ? 'Folder' : humanReadableBytes(file.sizeBytes)}</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenDetails(file);
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition cursor-pointer text-xs shadow-xs"
            >
              Open Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
