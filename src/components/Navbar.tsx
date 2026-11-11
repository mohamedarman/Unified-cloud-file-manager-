import React, { useState } from 'react';
import {
  Cloud,
  Search,
  AlertTriangle,
  User as UserIcon,
  Sun,
  Moon,
  Monitor,
  Keyboard,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Layers,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { useFileManager } from '../context/FileManagerContext';
import { useInfrastructure } from '../context/InfrastructureContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onOpenUpload?: () => void;
  onOpenAddAccount?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenUpload,
  onOpenAddAccount,
  onOpenCommandPalette,
  onOpenShortcuts,
}) => {
  const {
    currentTab,
    setCurrentTab,
    accounts,
    activeAccountId,
    setActiveAccountId,
  } = useFileManager();

  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, logout, availableUsers, switchAccount } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5">
        {/* Zone 1: Brand Wordmark */}
        <div
          onClick={() => setCurrentTab('files')}
          className="flex items-center gap-2.5 cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white block leading-tight">
              Unified Cloud File Manager
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Isolated Multi-Account Storage Workspace
            </span>
          </div>
        </div>

        {/* Zone 2: Account Scope Selector & Quick Command Search */}
        <div className="hidden lg:flex items-center gap-3 flex-1 max-w-xl mx-4">
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex-1 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs border border-slate-200/80 dark:border-slate-700/70 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Search files, accounts, or run command...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>
          )}

          <select
            aria-label="Filter by connected cloud account"
            value={activeAccountId}
            onChange={(e) => {
              const val = e.target.value;
              setActiveAccountId(val === 'ALL' ? 'ALL' : Number(val));
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Accounts ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.localId} value={acc.localId}>
                {acc.badgeLabel} · {acc.displayEmail}
              </option>
            ))}
          </select>
        </div>

        {/* Zone 3: Quick Actions & User Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Search & Command Palette"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {onOpenUpload && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <span>Upload</span>
            </button>
          )}

          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="hidden md:inline-flex p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title={`Theme: ${resolvedTheme}`}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 hidden md:inline">
                  {user.name}
                </span>
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isUserMenuOpen && (
                <div
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                  className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 text-xs space-y-1"
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('accounts');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span>Connected Cloud Drives</span>
                    <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {accounts.length}
                    </span>
                  </button>

                  {onOpenAddAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAddAccount();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 font-medium"
                    >
                      + Connect Cloud Account
                    </button>
                  )}

                  {availableUsers.length > 1 && (
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Switch Workspace User
                      </span>
                      {availableUsers
                        .filter((u) => u.id !== user.id)
                        .map((other) => (
                          <button
                            key={other.id}
                            type="button"
                            onClick={async () => {
                              setIsUserMenuOpen(false);
                              await switchAccount(other.id);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 truncate"
                          >
                            {other.name} ({other.email})
                          </button>
                        ))}
                    </div>
                  )}

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('legal');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      Privacy Policy & Legal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

