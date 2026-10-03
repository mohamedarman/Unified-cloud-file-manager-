import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { LocalAccountId } from '../../types';

interface NewFolderModalProps {
  onClose: () => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({ onClose }) => {
  const { createFolder, accounts, activeAccountId, currentFolderId } = useFileManager();

  const [name, setName] = useState('');
  const [targetAccountId, setTargetAccountId] = useState<LocalAccountId>(
    activeAccountId === 'ALL' ? accounts[0]?.localId || 1 : activeAccountId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createFolder(targetAccountId, name.trim(), currentFolderId);
      onClose();
    }
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
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">New Folder</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeAccountId === 'ALL' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Cloud Account
              </label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(Number(e.target.value) as LocalAccountId)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.localId} value={acc.localId}>
                    {acc.badgeLabel} ({acc.displayEmail})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Folder Name
            </label>
            <input
              type="text"
              placeholder="e.g. New Project, Receipts 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition disabled:opacity-50"
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
