import React, { useState } from 'react';
import {
  Folder,
  Image,
  Search,
  HardDrive,
  Settings,
  HelpCircle,
  Scale,
  PanelLeftClose,
  PanelLeft,
  UserPlus,
} from 'lucide-react';
import { useFileManager, NavigationTab } from '../context/FileManagerContext';

interface SidebarProps {
  onOpenAddAccount?: () => void;
  onOpenTour?: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenAddAccount }) => {
  const { currentTab, setCurrentTab, setCurrentFolderId, files } = useFileManager();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNav = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (tab === 'files') {
      setCurrentFolderId(null);
    }
  };

  const navSections: NavSection[] = [
    {
      title: 'Cloud File Manager',
      items: [
        {
          id: 'files' as NavigationTab,
          label: 'Files',
          icon: <Folder className="w-4 h-4 shrink-0 text-amber-500" />,
          count: files.filter((f) => !f.isTrashed).length,
        },
        {
          id: 'gallery' as NavigationTab,
          label: 'Gallery',
          icon: <Image className="w-4 h-4 shrink-0 text-blue-500" />,
        },
        {
          id: 'search' as NavigationTab,
          label: 'Search',
          icon: <Search className="w-4 h-4 shrink-0 text-indigo-500" />,
        },
        {
          id: 'quotas' as NavigationTab,
          label: 'Storage',
          icon: <HardDrive className="w-4 h-4 shrink-0 text-emerald-500" />,
        },
        {
          id: 'settings' as NavigationTab,
          label: 'More / Settings',
          icon: <Settings className="w-4 h-4 shrink-0 text-slate-400" />,
        },
      ],
    },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-60'
      } bg-slate-50/70 dark:bg-slate-900/70 border-r border-slate-200/80 dark:border-slate-800 hidden md:flex flex-col shrink-0 min-h-[calc(100vh-53px)] select-none transition-all duration-200`}
    >
      {/* Sidebar Header & Collapse Toggle */}
      <div className="p-3 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Menu
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Nav Items */}
      <div className="p-2 flex-1 overflow-y-auto space-y-4">
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {sec.title}
              </div>
            )}
            {sec.items.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <>
                      {item.count !== undefined && (
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Footer Section */}
      <div className="p-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1">
        {onOpenAddAccount && !isCollapsed && (
          <button
            onClick={onOpenAddAccount}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900/40 transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Connect Cloud Drive</span>
          </button>
        )}

        <button
          onClick={() => handleNav('legal')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentTab === 'legal'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          }`}
          title="Legal & Privacy Disclosures"
        >
          <Scale className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Legal & Privacy</span>}
        </button>

        <button
          onClick={() => handleNav('help')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentTab === 'help'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          }`}
          title="Help & Documentation"
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Help & Docs</span>}
        </button>
      </div>
    </aside>
  );
};
