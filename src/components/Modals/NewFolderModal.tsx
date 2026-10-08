import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { LocalAccountId } from '../../types';

interface NewFolderModalProps {
  onClose: () => void;
}

const INVALID_CHARS_REGEX = /[\\/:*?"<>|]/;

export const NewFolderModal: React.FC<NewFolderModalProps> = ({ onClose }) => {
  const { createFolder, accounts, activeAccountId, currentFolderId } = useFileManager();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<LocalAccountId>(
    activeAccountId === 'ALL' ? accounts[0]?.localId || 1 : activeAccountId
  );

  const validateName = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Folder name cannot be empty.';
    if (trimmed.length > 255) return 'Folder name exceeds maximum length (255 characters).';
    if (INVALID_CHARS_REGEX.test(trimmed)) {
      return 'Folder name cannot contain special characters (\\ / : * ? " < > |).';
    }
    if (trimmed === '.' || trimmed === '..' || trimmed.includes('../') || trimmed.includes('..\\')) {
      return 'Path traversal sequences are not allowed.';
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (error) {
      setError(validateName(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    createFolder(targetAccountId, name.trim(), currentFolderId);
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
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">New Folder</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close new folder modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Folder Name
            </label>
            <input
              type="text"
              placeholder="e.g. New Project, Receipts 2026"
              value={name}
              onChange={handleChange}
              autoFocus
              maxLength={255}
              aria-invalid={!!error}
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none transition ${
                error
                  ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                  : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
              }`}
            />
            {error && (
              <p role="alert" className="text-[11px] text-rose-500 dark:text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !!error}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
