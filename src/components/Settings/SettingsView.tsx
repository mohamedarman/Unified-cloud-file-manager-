import React, { useState } from 'react';
import {
  Settings,
  User,
  Bell,
  Smartphone,
  HardDrive,
  Trash2,
  RotateCcw,
  Check,
  Moon,
  Sun,
  Monitor,
  Shield,
  Layers,
  Sparkles,
  Info,
  Laptop,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFileManager } from '../../context/FileManagerContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const {
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    resetAllData,
    isMobilePreview,
    setIsMobilePreview,
  } = useFileManager();

  const { themeMode, setThemeMode, resolvedTheme } = useTheme();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [offlineSyncWifiOnly, setOfflineSyncWifiOnly] = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span>App Preferences & Settings</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure appearance theme, storage caching, mobile behavior, and profile settings
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* 1. Theme & Appearance Selection (Sun, Dark, System) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Appearance & Theme
              </h3>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                Global Color Palette
              </p>
            </div>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Active: {resolvedTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>

          {/* Theme Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* SUN THEME (LIGHT) */}
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                themeMode === 'light'
                  ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-2 ring-amber-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
                    <Sun className="w-5 h-5" />
                  </div>
                  {themeMode === 'light' && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Sun Theme
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Crisp, vibrant light palette designed for well-lit daytime environments.
                  </p>
                </div>
              </div>

              {/* Miniature UI Preview Swatch */}
              <div className="mt-3 p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
                <div className="h-2 bg-slate-200 rounded-sm w-3/4" />
                <div className="h-2 bg-amber-100 rounded-sm w-1/2" />
              </div>
            </button>

            {/* DARK THEME (NIGHT) */}
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                themeMode === 'dark'
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
                    <Moon className="w-5 h-5" />
                  </div>
                  {themeMode === 'dark' && (
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Dark Theme
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Deep charcoal and slate palette reducing eye fatigue in low-light conditions.
                  </p>
                </div>
              </div>

              {/* Miniature UI Preview Swatch */}
              <div className="mt-3 p-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-2xs space-y-1">
                <div className="h-2 bg-slate-700 rounded-sm w-3/4" />
                <div className="h-2 bg-indigo-600 rounded-sm w-1/2" />
              </div>
            </button>

            {/* SYSTEM DEFAULT (AUTO) */}
            <button
              type="button"
              onClick={() => setThemeMode('system')}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                themeMode === 'system'
                  ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
                    <Monitor className="w-5 h-5" />
                  </div>
                  {themeMode === 'system' && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    System Default
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Automatically adapts to your device operating system preference.
                  </p>
                </div>
              </div>

              {/* Miniature Split Preview Swatch */}
              <div className="mt-3 p-1.5 rounded-lg bg-gradient-to-r from-white to-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xs space-y-1">
                <div className="h-2 bg-slate-400/40 rounded-sm w-3/4" />
                <div className="h-2 bg-blue-500 rounded-sm w-1/2" />
              </div>
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        {user && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              User Profile
            </h3>

            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-14 h-14 rounded-2xl border border-slate-200 dark:border-slate-700 object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-xl">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">{user.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <span className="inline-block text-[10px] uppercase font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {user.provider} verified
                </span>
              </div>
            </div>
          </div>
        )}

        {/* View & Interface Preferences */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Display & Browsing Preferences
          </h3>

          <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Default File View Mode
                </label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="grid">Responsive Grid Cards</option>
                  <option value="list">Detailed Table Rows</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Default Sorting Order
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="date_desc">Modified Date (Newest first)</option>
                  <option value="date_asc">Modified Date (Oldest first)</option>
                  <option value="name_asc">Name (A to Z)</option>
                  <option value="name_desc">Name (Z to A)</option>
                  <option value="size_desc">File Size (Largest first)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Mobile Viewport Frame (Simulator)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Render phone frame for ergonomic mobile testing on desktop displays
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isMobilePreview}
                  onChange={(e) => setIsMobilePreview(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Background Transfer Notifications
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Show progress and completion alerts for uploads and downloads
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Sync Only on Unmetered Wi-Fi
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Avoid cellular data consumption for heavy thumbnail previews and media
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={offlineSyncWifiOnly}
                  onChange={(e) => setOfflineSyncWifiOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {saveSuccess && (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>Preferences saved!</span>
                </span>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
              >
                Save Preferences
              </button>
            </div>
          </form>
        </div>

        {/* Cache and Storage Hygiene */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Local Cache & Storage Hygiene
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                Clear Ephemeral Thumbnail & Index Cache
              </span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Purges in-memory directory blobs and preview snapshots without disconnecting cloud accounts.
              </p>
            </div>

            <button
              onClick={handleClearCache}
              disabled={cacheCleared}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition text-xs shrink-0"
            >
              {cacheCleared ? 'Cache Cleared!' : 'Purge Cache'}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                Factory Reset All Local Data
              </span>
              <span className="text-slate-400 text-[11px]">
                Disconnects all accounts, clears operations history, and re-initializes mock storage
              </span>
            </div>

            <button
              onClick={() => {
                if (
                  confirm(
                    'Are you sure you want to reset all mock cloud accounts and cached data back to default?'
                  )
                ) {
                  resetAllData();
                  alert('App data has been reset to defaults.');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-medium transition text-xs shrink-0 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
