import React from 'react';
import { FileQuestion, Home, HardDrive, Search, ArrowLeft } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';

interface NotFoundViewProps {
  missingPath?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ missingPath }) => {
  const { setCurrentTab } = useFileManager();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-950 transition-colors select-none">
      <div className="max-w-md w-full space-y-6">
        {/* Visual Badge */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center shadow-lg shadow-blue-500/10">
          <FileQuestion className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-pulse" />
          <span className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-500 text-white rounded-full shadow-xs">
            404
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Page or View Not Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The requested workspace view {missingPath ? `"${missingPath}"` : ''} does not exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        {/* Helpful Recovery Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard Home</span>
          </button>

          <button
            onClick={() => setCurrentTab('files')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
          >
            <HardDrive className="w-4 h-4 text-slate-500" />
            <span>File Browser</span>
          </button>

          <button
            onClick={() => setCurrentTab('search')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span>Global Search</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
          Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">⌘K</kbd> to open the Command Palette from anywhere.
        </div>
      </div>
    </div>
  );
};
