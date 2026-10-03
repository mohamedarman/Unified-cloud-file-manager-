import React from 'react';
import {
  X,
  HardDrive,
  ListRestart,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  RotateCcw,
  Unlink,
  ExternalLink,
  ChevronRight,
  LogOut,
  WifiOff,
  Settings,
  HelpCircle,
  Scale,
  Cloud,
} from 'lucide-react';
import { useFileManager, NavigationTab } from '../context/FileManagerContext';
import { useAuth } from '../context/AuthContext';
import { AccountState, PROVIDERS } from '../types';
import { humanReadableBytes } from '../utils/formatters';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddAccount: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  onOpenAddAccount,
}) => {
  const {
    accounts,
    quotas,
    disconnectAccount,
    setCurrentTab,
    setCurrentFolderId,
    resetAllData,
  } = useFileManager();

  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const navigateTo = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (tab === 'files') setCurrentFolderId(null);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 space-y-5 animate-in slide-in-from-bottom-5 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base">
            App Menu & Cloud Management
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        {user && (
          <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border border-blue-300 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900 text-xs sm:text-sm">{user.name}</p>
                <p className="text-[11px] text-slate-500">{user.email}</p>
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-white text-blue-700 font-semibold border border-blue-200">
                  {user.provider} account
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                logout();
              }}
              className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* All App Pages Grid */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Application Pages
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => navigateTo('accounts')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Accounts Center</span>
            </button>

            <button
              onClick={() => navigateTo('offline')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <WifiOff className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Offline Vault</span>
            </button>

            <button
              onClick={() => navigateTo('starred')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <span className="truncate">Starred Files</span>
            </button>

            <button
              onClick={() => navigateTo('trash')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="truncate">Trash Bin</span>
            </button>

            <button
              onClick={() => navigateTo('operations')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <ListRestart className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Write Queue</span>
            </button>

            <button
              onClick={() => navigateTo('security')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Security & Logs</span>
            </button>

            <button
              onClick={() => navigateTo('settings')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <Settings className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="truncate">Settings & Cache</span>
            </button>

            <button
              onClick={() => navigateTo('help')}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Help & FAQs</span>
            </button>

            <button
              onClick={() => navigateTo('legal')}
              className="col-span-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-800 text-left"
            >
              <Scale className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Privacy Policy & Legal Disclosures (Google Play Ready)</span>
            </button>
          </div>
        </div>

        {/* Reset / Clear Data */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Sandbox Reset</span>
          <button
            onClick={() => {
              if (confirm('Reset application data to initial multi-cloud demo state?')) {
                resetAllData();
                onClose();
              }
            }}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
