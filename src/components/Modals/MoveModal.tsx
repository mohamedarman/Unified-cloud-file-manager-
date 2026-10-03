import React, { useState } from 'react';
import { X, FolderInput, Folder } from 'lucide-react';
import { CloudFile } from '../../types';
import { useFileManager } from '../../context/FileManagerContext';

interface MoveModalProps {
  file: CloudFile;
  onClose: () => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({ file, onClose }) => {
  const { files, moveFile } = useFileManager();

  // Find candidate folders in the same account (cannot be self or inside self)
  const candidateFolders = files.filter(
    (f) =>
      f.ref.accountId === file.ref.accountId &&
      f.isFolder &&
      !f.isTrashed &&
      f.ref.fileId !== file.ref.fileId
  );

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    file.parentFolderId
  );

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    moveFile(file, selectedFolderId);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 text-slate-900 dark:text-slate-100 transition-colors"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FolderInput className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Move File</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs">{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleMove} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Select Destination in Account
            </label>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              <div
                onClick={() => setSelectedFolderId(null)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition ${
                  selectedFolderId === null
                    ? 'border-blue-500 bg-blue-50/70 font-semibold text-blue-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Folder className="w-4 h-4 text-slate-400" />
                <span>Root / My Cloud Drive</span>
              </div>

              {candidateFolders.map((f) => (
                <div
                  key={f.ref.fileId}
                  onClick={() => setSelectedFolderId(f.ref.fileId)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition ${
                    selectedFolderId === f.ref.fileId
                      ? 'border-blue-500 bg-blue-50/70 font-semibold text-blue-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Folder className="w-4 h-4 text-amber-500" />
                  <span className="truncate">{f.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
            >
              Move Here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
