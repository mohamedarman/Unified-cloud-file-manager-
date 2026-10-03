import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Edit2,
  FolderInput,
  Copy,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Share2,
  History,
  Star,
  ShieldAlert,
  Info,
  CheckCircle2,
  Eye,
  FileText,
} from 'lucide-react';
import { CloudFile, FileAction, ActionAvailability } from '../../types';
import { useFileManager } from '../../context/FileManagerContext';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import { FileIcon } from '../FileBrowser/FileIcon';
import { FilePreviewPane } from '../FileBrowser/FilePreviewPane';
import { ResolveFileActions } from '../../utils/resolveFileActions';
import { Redactor } from '../../utils/redactor';
import { humanReadableBytes, formatDate } from '../../utils/formatters';

interface FileDetailsModalProps {
  file: CloudFile;
  onClose: () => void;
  onOpenRename: (file: CloudFile) => void;
  onOpenRevisions: (file: CloudFile) => void;
  onOpenDeleteConfirm: (file: CloudFile) => void;
  onOpenMove?: (file: CloudFile) => void;
}

export const FileDetailsModal: React.FC<FileDetailsModalProps> = ({
  file,
  onClose,
  onOpenRename,
  onOpenRevisions,
  onOpenDeleteConfirm,
  onOpenMove,
}) => {
  const {
    accounts,
    capabilities,
    downloadFile,
    trashFile,
    restoreFile,
    toggleStar,
    addAuditLog,
  } = useFileManager();

  const [copiedLink, setCopiedLink] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(false);

  const account = accounts.find((a) => a.localId === file.ref.accountId);
  const accountCapabilities =
    capabilities[file.ref.accountId] || {
      canReadFiles: true,
      canWriteFiles: true,
      canCreateFolders: true,
      canRename: true,
      canTrash: true,
      canSearch: true,
      canReadRevisions: true,
      canStar: true,
      canDownloadBytes: true,
      grantsOfflineAccess: true,
      canExport: true,
    };

  const resolvedActions = ResolveFileActions.resolve(file, accountCapabilities);
  const correlationTag = Redactor.fileRefTag(file.ref.accountId, file.ref.fileId);

  const handleCopyLink = () => {
    const link =
      file.webViewLink ||
      `https://cloud.filemanager.app/files/${file.ref.provider.toLowerCase()}/${file.ref.accountId}/${file.ref.fileId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    addAuditLog(file.ref.accountId, 'SHARE_LINK_COPIED', `Copied link for ${file.name}`, file.ref.fileId);
  };

  const handleExport = (format: string) => {
    addAuditLog(
      file.ref.accountId,
      'DOCUMENT_EXPORT',
      `Exported document "${file.name}" to ${format}`,
      file.ref.fileId
    );
    // Trigger simulated export download
    downloadFile({
      ...file,
      name: `${file.name.replace(/\.[^/.]+$/, '')}.${format.toLowerCase()}`,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 transition-colors"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon mimeType={file.mimeType} fileName={file.name} isFolder={file.isFolder} className="w-6 h-6 shrink-0" />
            <div className="truncate">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate" title={file.name}>
                {file.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <AccountBadge accountId={file.ref.accountId} showEmail />
                {file.isStarred && (
                  <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-medium">
                    Starred
                  </span>
                )}
                {file.isTrashed && (
                  <span className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-800 font-medium">
                    Trashed
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive In-Modal File Preview (PDF, Images, Text, Code, Spreadsheets, Audio) */}
        {!file.isFolder && (
          <div className="p-4 sm:p-5 pb-0">
            <FilePreviewPane file={file} />
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-5">
          {/* Metadata Grid */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              File Metadata & Attribution
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Provider Account</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{account?.displayName}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Account Email</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                  {account?.displayEmail}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">File Size</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {file.isFolder ? 'Folder' : humanReadableBytes(file.sizeBytes)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">MIME Type</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate block" title={file.mimeType}>
                  {file.mimeType}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Date Modified</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(file.modifiedTimeMillis)}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Ownership Status</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {file.isOwnedByUser ? 'Owned by user' : 'Shared with account'}
                </span>
              </div>

              <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Audit Log Tag (O-3)</span>
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-750 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    refTag#{correlationTag}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Provider File ID (FI-05)</span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {file.ref.fileId}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Text/Content Preview Snippet */}
          {file.previewText && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Content Preview Snippet</span>
                </span>
                <button
                  onClick={() => setShowTextPreview(!showTextPreview)}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  {showTextPreview ? 'Collapse' : 'Expand preview'}
                </button>
              </div>
              <div
                className={`bg-slate-900 text-slate-200 p-3 rounded-xl text-xs font-mono border border-slate-800 whitespace-pre-wrap transition-all overflow-hidden ${
                  showTextPreview ? 'max-h-60 overflow-y-auto' : 'max-h-24'
                }`}
              >
                {file.previewText}
              </div>
            </div>
          )}

          {/* Dynamic Action Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Action Matrix (Evaluated Dynamically)
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Rule PC-1 & PC-4 compliant
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* OPEN */}
              <ActionButton
                action={resolvedActions.get(FileAction.OPEN)!}
                label="Open in Cloud Viewer"
                icon={<ExternalLink className="w-4 h-4 text-blue-600" />}
                onClick={() => {
                  window.open(file.webViewLink || '#', '_blank');
                  onClose();
                }}
              />

              {/* DOWNLOAD */}
              <ActionButton
                action={resolvedActions.get(FileAction.DOWNLOAD)!}
                label="Download Directly"
                icon={<Download className="w-4 h-4 text-blue-600" />}
                onClick={() => {
                  downloadFile(file);
                  onClose();
                }}
              />

              {/* EXPORT */}
              <ActionButton
                action={resolvedActions.get(FileAction.EXPORT)!}
                label="Export Document (PDF)"
                icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                onClick={() => handleExport('PDF')}
              />

              {/* RENAME */}
              <ActionButton
                action={resolvedActions.get(FileAction.RENAME)!}
                label="Rename File"
                icon={<Edit2 className="w-4 h-4 text-slate-700" />}
                onClick={() => {
                  onClose();
                  onOpenRename(file);
                }}
              />

              {/* MOVE */}
              <ActionButton
                action={resolvedActions.get(FileAction.MOVE)!}
                label="Move to Folder"
                icon={<FolderInput className="w-4 h-4 text-slate-700" />}
                onClick={() => {
                  onClose();
                  if (onOpenMove) onOpenMove(file);
                }}
              />

              {/* STAR / UNSTAR */}
              <ActionButton
                action={resolvedActions.get(FileAction.STAR)!}
                label={file.isStarred ? 'Unstar File' : 'Star File'}
                icon={<Star className={`w-4 h-4 ${file.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-500'}`} />}
                onClick={() => toggleStar(file)}
              />

              {/* SHARE */}
              <ActionButton
                action={resolvedActions.get(FileAction.SHARE)!}
                label={copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}
                icon={copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-slate-700" />}
                onClick={handleCopyLink}
              />

              {/* REVISIONS */}
              <ActionButton
                action={resolvedActions.get(FileAction.VIEW_REVISIONS)!}
                label="Version History"
                icon={<History className="w-4 h-4 text-slate-700" />}
                onClick={() => {
                  onClose();
                  onOpenRevisions(file);
                }}
              />

              {/* TRASH / RESTORE */}
              {file.isTrashed ? (
                <ActionButton
                  action={resolvedActions.get(FileAction.RESTORE)!}
                  label="Restore from Trash"
                  icon={<RotateCcw className="w-4 h-4 text-emerald-600" />}
                  onClick={() => {
                    restoreFile(file);
                    onClose();
                  }}
                />
              ) : (
                <ActionButton
                  action={resolvedActions.get(FileAction.TRASH)!}
                  label="Move to Trash"
                  icon={<Trash2 className="w-4 h-4 text-rose-600" />}
                  onClick={() => {
                    trashFile(file);
                    onClose();
                  }}
                />
              )}

              {/* DELETE PERMANENTLY */}
              {file.isTrashed && (
                <ActionButton
                  action={resolvedActions.get(FileAction.DELETE_PERMANENTLY)!}
                  label="Delete Permanently"
                  icon={<AlertTriangle className="w-4 h-4 text-rose-700" />}
                  onClick={() => {
                    onClose();
                    onOpenDeleteConfirm(file);
                  }}
                  destructive
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActionButtonProps {
  action?: ActionAvailability;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  label,
  icon,
  onClick,
  destructive = false,
}) => {
  if (!action || !action.available) {
    const reasonText =
      !action
        ? 'Action unavailable for this file format'
        : action.reason?.type === 'ScopeInsufficient'
        ? `Scope insufficient (${action.reason.feature}): ${action.reason.message || 'not granted'}`
        : action.reason?.type === 'FileCannot'
        ? action.reason.explanation
        : 'File is in trash';

    return (
      <div className="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-850/60 opacity-60 flex flex-col justify-between cursor-not-allowed">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
          <div className="grayscale opacity-50">{icon}</div>
          <span className="line-through">{label}</span>
        </div>
        <div className="mt-1 flex items-start gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-normal">
          <Info className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
          <span>{reasonText}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-xl border text-left flex items-center justify-between font-medium transition cursor-pointer ${
        destructive
          ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-300'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs'
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
        Available
      </span>
    </button>
  );
};
