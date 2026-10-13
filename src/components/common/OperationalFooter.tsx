import React from 'react';
import {
  ShieldCheck,
  Command,
  HelpCircle,
  Cloud,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';

interface OperationalFooterProps {
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
}

export const OperationalFooter: React.FC<OperationalFooterProps> = ({
  onOpenCommandPalette,
  onOpenShortcuts,
}) => {
  const { setCurrentTab } = useFileManager();

  return (
    <footer className="hidden md:flex items-center justify-between px-4 py-1.5 bg-slate-900 text-slate-400 border-t border-slate-800 text-[11px] font-mono select-none z-20 shrink-0">
      {/* Left: App Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-slate-200">
            Unified Cloud File Manager Active
          </span>
        </div>
      </div>

      {/* Right: Legal & Keyboard Shortcuts */}
      <div className="flex items-center gap-3">
        {/* Legal Links */}
        <div className="flex items-center gap-2 text-slate-400">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.hash = '#/privacy';
              setCurrentTab('legal');
            }}
            className="hover:text-slate-200 transition cursor-pointer"
            title="View Privacy Policy and Compliance"
          >
            Privacy
          </button>
          <span className="text-slate-700">·</span>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.hash = '#/terms';
              setCurrentTab('legal');
            }}
            className="hover:text-slate-200 transition cursor-pointer"
            title="View Terms of Service"
          >
            Terms
          </button>
        </div>

        <span className="text-slate-700">|</span>

        {/* Shortcuts quick triggers */}
        <div className="flex items-center gap-2 text-slate-500">
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Open Universal Command Palette"
          >
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </button>

          <button
            onClick={onOpenShortcuts}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Open Keyboard Shortcuts Cheatsheet"
          >
            <HelpCircle className="w-2.5 h-2.5" />
            <span>?</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
