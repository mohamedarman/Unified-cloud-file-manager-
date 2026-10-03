import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  category: string;
  items: { key: string; description: string }[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: 'General & Navigation',
      items: [
        { key: '⌘ K / Ctrl K', description: 'Open Universal Command Palette & Search' },
        { key: '?', description: 'Show this keyboard shortcuts cheatsheet' },
        { key: 'Esc', description: 'Close active modal, drawer, or deselect files' },
        { key: 'T', description: 'Cycle color theme: Sun (Light) → Dark → System' },
        { key: 'M', description: 'Toggle mobile preview device frame' },
      ],
    },
    {
      category: 'File & Folder Actions',
      items: [
        { key: 'Space', description: 'Quick Look / Preview selected file' },
        { key: '⌘ U', description: 'Open upload dialog for current cloud drive' },
        { key: '⌘ ⇧ N', description: 'Create a new folder in active directory' },
        { key: '⌘ A', description: 'Select all visible files in current view' },
        { key: 'Delete / ⌫', description: 'Move selected file(s) to trash' },
      ],
    },
    {
      category: 'View & Switchers',
      items: [
        { key: '1', description: 'Switch to Grid View layout' },
        { key: '2', description: 'Switch to Dense List View layout' },
        { key: 'G then F', description: 'Jump to Cloud Files Browser' },
        { key: 'G then G', description: 'Jump to Media Gallery' },
        { key: 'G then Q', description: 'Jump to Quota Governor' },
        { key: 'G then A', description: 'Jump to Cloud Accounts Center' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Speed up file operations and navigation across all clouds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {group.category}
              </h4>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-850/50">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {item.key.split(' ').map((k, kidx) =>
                        k === '/' || k === 'then' ? (
                          <span
                            key={kidx}
                            className="text-[10px] text-slate-400 px-0.5"
                          >
                            {k}
                          </span>
                        ) : (
                          <kbd
                            key={kidx}
                            className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono shadow-2xs text-slate-800 dark:text-slate-200"
                          >
                            {k}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">?</kbd> anywhere to open this dialog</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-750 text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
