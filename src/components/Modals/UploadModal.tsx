import React, { useState } from 'react';
import { X, UploadCloud, Folder, AlertCircle, Check } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { LocalAccountId } from '../../types';
import { humanReadableBytes } from '../../utils/formatters';

interface UploadModalProps {
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose }) => {
  const { accounts, files, quotas, activeAccountId, uploadFile } = useFileManager();

  const [selectedAccountId, setSelectedAccountId] = useState<LocalAccountId>(
    activeAccountId === 'ALL' ? accounts[0]?.localId || 1 : activeAccountId
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.localId === selectedAccountId);
  const quota = quotas[selectedAccountId];

  // List folders in this account
  const accountFolders = files.filter(
    (f) => f.ref.accountId === selectedAccountId && f.isFolder && !f.isTrashed
  );

  const isUnlimited = quota?.limitBytes === null || quota?.limitBytes === undefined;
  const freeBytes = isUnlimited
    ? Infinity
    : Math.max(0, (quota?.limitBytes || 0) - (quota?.usedBytes || 0));

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    if (!isUnlimited && selectedFile.size > freeBytes) {
      setError(
        `File size (${humanReadableBytes(selectedFile.size)}) exceeds free storage (${humanReadableBytes(freeBytes)}) in ${selectedAccount?.badgeLabel || 'this account'}.`
      );
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      await uploadFile(selectedAccountId, selectedFolderId, selectedFile);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 text-slate-900 dark:text-slate-100 transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Upload to Cloud Drive
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct transfer to authorized cloud account
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Account Target */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
            1. Target Cloud Account <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {accounts.map((acc) => {
              const isSelected = acc.localId === selectedAccountId;
              return (
                <div
                  key={acc.localId}
                  onClick={() => setSelectedAccountId(acc.localId)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-400'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: acc.color }}
                    />
                    <div className="truncate">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {acc.badgeLabel}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {acc.displayEmail}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Account Storage Gauge */}
          {selectedAccount && quota && (
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
              <span>Remaining storage in {selectedAccount.badgeLabel}:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isUnlimited ? 'Unlimited' : `${humanReadableBytes(freeBytes)} free of ${humanReadableBytes(quota.limitBytes)}`}
              </span>
            </div>
          )}
        </div>

        {/* 2. Destination Folder */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
            2. Destination Folder in Account
          </label>
          <select
            value={selectedFolderId || ''}
            onChange={(e) => setSelectedFolderId(e.target.value || null)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
          >
            <option value="">Root Folder</option>
            {accountFolders.map((f) => (
              <option key={f.ref.fileId} value={f.ref.fileId}>
                📁 {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Drag and Drop Zone */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
            3. Choose File to Upload
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition cursor-pointer ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-850/50'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-2" />
            {selectedFile ? (
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {humanReadableBytes(selectedFile.size)} • {selectedFile.type || 'binary'}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Drag and drop a file here, or{' '}
                  <label className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    browse
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Uploads directly to selected cloud drive via streaming
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleUploadSubmit}
            disabled={!selectedFile || isUploading}
            className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            {isUploading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <span>Start Upload</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
