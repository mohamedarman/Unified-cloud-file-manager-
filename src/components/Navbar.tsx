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
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single text element wordmark */}
        <div
          onClick={() => setCurrentTab('files')}
          className="text-lg font-bold tracking-tight text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
        >
          Unified Cloud Memory
        </div>

        {/* Zone 2: 4–5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button onClick={() => setCurrentTab('files')} className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">Files</button>
          <button onClick={() => setCurrentTab('settings')} className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">Settings</button>
        </nav>

        {/* Zone 3: 1 primary action (User Profile) */}
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <span className="text-xs font-medium text-slate-700 hidden md:inline">
                  {user.name}
                </span>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-md object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold">
                    {user.name.charAt(0)}
                  </div>
                )}
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-xs">
                  <button onClick={logout} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700">Sign Out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
