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
  onOpenCommandPalette,
  onOpenShortcuts,
}) => {
  const {
    currentTab,
    setCurrentTab,
    isMobilePreview,
    setIsMobilePreview,
  } = useFileManager();

  const { alerts, selectedEnvironment, setSelectedEnvironment } = useInfrastructure();
  const { themeMode, toggleTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false);

  const activeAlertsCount = alerts.filter((a) => a.status !== 'RESOLVED').length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 gap-4">
        {/* Brand / Logo + Context Environment Selector */}
        <div className="flex items-center gap-3 select-none">
          <div
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shadow-blue-500/20 group-hover:scale-105 transition">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight leading-tight block">
                MultiCloud Console
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Enterprise Cloud Ops
              </span>
            </div>
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

          {/* Clean Environment Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title="Select Active Deployment Context"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  selectedEnvironment === 'production'
                    ? 'bg-emerald-500'
                    : selectedEnvironment === 'staging'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
              <span className="uppercase font-semibold tracking-wider">
                {selectedEnvironment}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isEnvMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 text-xs font-mono"
                onClick={() => setIsEnvMenuOpen(false)}
              >
                {(['production', 'staging', 'development'] as const).map((env) => (
                  <button
                    key={env}
                    onClick={() => setSelectedEnvironment(env)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                      selectedEnvironment === env
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/40'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="capitalize">{env}</span>
                    {selectedEnvironment === env && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Universal Command Search Bar */}
        <div className="flex-1 max-w-xl mx-2">
          <div
            onClick={() => onOpenCommandPalette?.()}
            className="relative flex items-center w-full cursor-pointer group"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 absolute left-3.5 pointer-events-none transition" />
            <input
              type="text"
              readOnly
              placeholder="Search resources, metrics, logs, runbooks... (⌘K)"
              className="w-full pl-9 pr-14 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-150 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-100 cursor-pointer select-none"
            />
            <kbd className="hidden sm:inline-flex items-center text-[10px] text-slate-400 dark:text-slate-500 font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 absolute right-3 pointer-events-none shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right Actions: Health Status, Theme, Shortcuts, User Profile */}
        <div className="flex items-center gap-2">
          {/* Active Alert Warning Badge */}
          {activeAlertsCount > 0 ? (
            <button
              onClick={() => setCurrentTab('monitoring_alerts')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold shadow-2xs hover:bg-amber-100 transition cursor-pointer"
              title="Inspect Active Alerts"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>{activeAlertsCount} {activeAlertsCount === 1 ? 'Alert' : 'Alerts'}</span>
            </button>
          ) : (
            <div
              onClick={() => setCurrentTab('dashboard')}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium cursor-pointer"
              title="All multi-cloud nodes reporting nominal SLA"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-mono text-[11px]">SLA 99.99%</span>
            </div>
          )}

          {/* Keyboard Shortcuts Trigger */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="hidden md:flex p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              title="Keyboard Shortcuts Cheatsheet (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
            title={`Active: ${themeMode} (${resolvedTheme}). Click to toggle`}
          >
            {themeMode === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-blue-400" />
            )}
          </button>

          {/* Device & Frame Studio Switcher */}
          <button
            onClick={() => setIsMobilePreview(!isMobilePreview)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer ${
              isMobilePreview
                ? 'bg-blue-600 border-blue-500 text-white font-semibold shadow-xs'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Toggle Multi-Device & Frame Comparison Studio (HotKey: M)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Device Studio</span>
            <span className="md:hidden">Frames</span>
          </button>

          {/* User Profile */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1 pl-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden md:inline">
                  {user.name}
                </span>
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-6 h-6 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">
                    {user.name.charAt(0)}
                  </div>
                )}
              </button>

              {isUserMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 text-xs"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => setCurrentTab('settings')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                  >
                    Console Settings
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
