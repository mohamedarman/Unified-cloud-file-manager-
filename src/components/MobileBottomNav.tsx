import React from 'react';
import {
  Folder,
  Image,
  Search,
  HardDrive,
  Menu,
  Shield,
  ListRestart,
  Star,
  Trash2,
} from 'lucide-react';
import { useFileManager, NavigationTab } from '../context/FileManagerContext';

interface MobileBottomNavProps {
  onOpenMoreMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMoreMenu }) => {
  const { currentTab, setCurrentTab, setCurrentFolderId, pendingOperations } = useFileManager();

  const handleTabClick = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (tab === 'files') {
      setCurrentFolderId(null);
    }
  };

  const pendingOpsCount = pendingOperations.filter(
    (op) => op.state === 'QUEUED' || op.state === 'RUNNING' || op.outcomeUncertain
  ).length;

  return (
    <nav className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-1 flex items-center justify-around z-30 select-none shadow-lg">
      {/* 1. Files */}
      <button
        onClick={() => handleTabClick('files')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[56px] min-h-[44px] cursor-pointer ${
          currentTab === 'files'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Folder className={`w-5 h-5 ${currentTab === 'files' ? 'fill-blue-100 dark:fill-blue-950 stroke-blue-600 dark:stroke-blue-400' : ''}`} />
        <span className="text-[10px] mt-0.5">Files</span>
      </button>

      {/* 2. Gallery */}
      <button
        onClick={() => handleTabClick('gallery')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[56px] min-h-[44px] cursor-pointer ${
          currentTab === 'gallery'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Image className={`w-5 h-5 ${currentTab === 'gallery' ? 'fill-blue-100 dark:fill-blue-950 stroke-blue-600 dark:stroke-blue-400' : ''}`} />
        <span className="text-[10px] mt-0.5">Gallery</span>
      </button>

      {/* 3. Search */}
      <button
        onClick={() => handleTabClick('search')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[56px] min-h-[44px] cursor-pointer ${
          currentTab === 'search'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Search className={`w-5 h-5 ${currentTab === 'search' ? 'stroke-[2.5px]' : ''}`} />
        <span className="text-[10px] mt-0.5">Search</span>
      </button>

      {/* 4. Storage */}
      <button
        onClick={() => handleTabClick('quotas')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[56px] min-h-[44px] cursor-pointer ${
          currentTab === 'quotas'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <HardDrive className={`w-5 h-5 ${currentTab === 'quotas' ? 'fill-blue-100 dark:fill-blue-950 stroke-blue-600 dark:stroke-blue-400' : ''}`} />
        <span className="text-[10px] mt-0.5">Storage</span>
      </button>

      {/* 5. More Menu */}
      <button
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[56px] min-h-[44px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white relative cursor-pointer"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">More</span>
        {pendingOpsCount > 0 && (
          <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-amber-500" />
        )}
      </button>
    </nav>
  );
};
