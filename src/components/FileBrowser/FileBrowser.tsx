import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronRight,
  Home,
  ArrowLeft,
  Trash2,
  Download,
  CheckSquare,
  FileQuestion,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Folder,
  Layers,
  X,
  Filter,
  Eye,
  SlidersHorizontal,
  CloudUpload,
  Sparkles,
} from 'lucide-react';
import { useFileManager, SortOption, FilterOption } from '../../context/FileManagerContext';
import { CloudFile, ProviderId, PROVIDERS, cacheKey } from '../../types';
import { FileItemCard } from './FileItemCard';
import { FileItemRow } from './FileItemRow';
import { toast } from 'sonner';

interface FileBrowserProps {
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
  onOpenDetails: (file: CloudFile) => void;
  onOpenQuickLook?: (file: CloudFile) => void;
  onOpenMove?: (file: CloudFile) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  onOpenUpload,
  onOpenNewFolder,
  onOpenDetails,
  onOpenQuickLook,
}) => {
  const {
    files,
    accounts,
    activeAccountId,
    activeProvider,
    setActiveProvider,
    currentTab,
    currentFolderId,
    navigateToFolder,
    navigateBack,
    folderHistory,
    searchQuery,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    filterOption,
    setFilterOption,
    selectedFileKeys,
    selectAllFiles,
    clearSelection,
    downloadFile,
    trashFile,
    uploadFile,
  } = useFileManager();

  // Density control (comfortable vs compact)
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('ucfm_view_density') as 'comfortable' | 'compact') || 'comfortable';
  });

  const toggleDensity = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    localStorage.setItem('ucfm_view_density', next);
    toast.success(`View density set to ${next}`);
  };

  // Drag and drop overlay state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDraggingOver(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    // Pick target account: active account or first available
    const targetAccountId =
      activeAccountId !== 'ALL'
        ? activeAccountId
        : accounts[0]?.localId;

    if (!targetAccountId) {
      toast.error('Please connect or select a cloud account before uploading');
      return;
    }

    const acc = accounts.find((a) => a.localId === targetAccountId);

    toast.info(`Uploading ${droppedFiles.length} file(s) to ${acc?.badgeLabel || 'Drive'}...`);

    for (const f of droppedFiles) {
      try {
        await uploadFile(targetAccountId, currentFolderId, f);
        toast.success(`Uploaded "${f.name}" successfully`);
      } catch (err: any) {
        toast.error(`Failed to upload "${f.name}": ${err.message}`);
      }
    }
  };

  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return files.find((f) => f.ref.fileId === currentFolderId) || null;
  }, [files, currentFolderId]);

  const activeAccount =
    activeAccountId === 'ALL'
      ? null
      : accounts.find((a) => a.localId === activeAccountId);

  // Base list of files in current scope
  const scopedBaseFiles = useMemo(() => {
    return files.filter((file) => {
      // Account filter
      if (activeAccountId !== 'ALL' && file.ref.accountId !== activeAccountId) {
        return false;
      }

      // Provider filter
      if (activeProvider !== 'ALL' && file.ref.provider !== activeProvider) {
        return false;
      }

      // Tab context
      if (currentTab === 'trash') {
        return file.isTrashed;
      }
      if (file.isTrashed) {
        return false;
      }

      if (currentTab === 'starred') {
        return file.isStarred;
      }

      // Search mode
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          file.name.toLowerCase().includes(q) ||
          file.mimeType.toLowerCase().includes(q) ||
          (file.previewText && file.previewText.toLowerCase().includes(q))
        );
      }

      // Normal folder navigation
      if (currentTab === 'files') {
        return file.parentFolderId === currentFolderId;
      }

      return true;
    });
  }, [files, activeAccountId, activeProvider, currentTab, currentFolderId, searchQuery]);

  // Dynamic counts for each filter category
  const categoryCounts = useMemo(() => {
    return {
      all: scopedBaseFiles.length,
      documents: scopedBaseFiles.filter(
        (f) =>
          !f.isFolder &&
          (f.mimeType.includes('document') ||
            f.mimeType.includes('sheet') ||
            f.mimeType.includes('pdf') ||
            f.mimeType.includes('presentation') ||
            f.mimeType.includes('text/') ||
            f.mimeType.includes('csv') ||
            f.mimeType.includes('json') ||
            f.mimeType.includes('officedocument'))
      ).length,
      images: scopedBaseFiles.filter(
        (f) => !f.isFolder && f.mimeType.startsWith('image/')
      ).length,
      videos: scopedBaseFiles.filter(
        (f) => !f.isFolder && f.mimeType.startsWith('video/')
      ).length,
      audio: scopedBaseFiles.filter(
        (f) =>
          !f.isFolder &&
          (f.mimeType.startsWith('audio/') ||
            f.mimeType.includes('audio') ||
            f.mimeType.includes('mpeg') ||
            f.mimeType.includes('wav'))
      ).length,
      folders: scopedBaseFiles.filter((f) => f.isFolder).length,
    };
  }, [scopedBaseFiles]);

  // Filter and Sort Pipeline
  const displayedFiles = useMemo(() => {
    return scopedBaseFiles
      .filter((file) => {
        if (filterOption === 'folders') return file.isFolder;
        if (filterOption === 'documents') {
          return (
            !file.isFolder &&
            (file.mimeType.includes('document') ||
              file.mimeType.includes('sheet') ||
              file.mimeType.includes('pdf') ||
              file.mimeType.includes('presentation') ||
              file.mimeType.includes('text/') ||
              file.mimeType.includes('csv') ||
              file.mimeType.includes('json') ||
              file.mimeType.includes('officedocument'))
          );
        }
        if (filterOption === 'images') {
          return !file.isFolder && file.mimeType.startsWith('image/');
        }
        if (filterOption === 'videos') {
          return !file.isFolder && file.mimeType.startsWith('video/');
        }
        if (filterOption === 'audio') {
          return (
            !file.isFolder &&
            (file.mimeType.startsWith('audio/') ||
              file.mimeType.includes('audio') ||
              file.mimeType.includes('mpeg') ||
              file.mimeType.includes('wav'))
          );
        }
        if (filterOption === 'media') {
          return (
            !file.isFolder &&
            (file.mimeType.startsWith('image/') ||
              file.mimeType.startsWith('video/') ||
              file.mimeType.startsWith('audio/'))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy !== 'size_desc' && sortBy !== 'size_asc') {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
        }

        switch (sortBy) {
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'date_desc':
            return b.modifiedTimeMillis - a.modifiedTimeMillis;
          case 'date_asc':
            return a.modifiedTimeMillis - b.modifiedTimeMillis;
          case 'size_desc':
            return (b.sizeBytes || 0) - (a.sizeBytes || 0);
          case 'size_asc':
            return (a.sizeBytes || 0) - (b.sizeBytes || 0);
          default:
            return 0;
        }
      });
  }, [scopedBaseFiles, filterOption, sortBy]);

  const handleDoubleClick = (file: CloudFile) => {
    if (file.isFolder) {
      navigateToFolder(file.ref.fileId);
    } else {
      onOpenDetails(file);
    }
  };

  // Keyboard shortcut listener for spacebar Quick Look
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user presses Spacebar and isn't typing in an input
      if (
        e.code === 'Space' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        if (selectedFileKeys.size === 1 && onOpenQuickLook) {
          const selectedKey = Array.from(selectedFileKeys)[0];
          const found = displayedFiles.find((f) => cacheKey(f.ref) === selectedKey);
          if (found) {
            e.preventDefault();
            onOpenQuickLook(found);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileKeys, displayedFiles, onOpenQuickLook]);

  const allVisibleKeys = useMemo(
    () => displayedFiles.map((f) => cacheKey(f.ref)),
    [displayedFiles]
  );
  const isAllSelected =
    allVisibleKeys.length > 0 &&
    allVisibleKeys.every((k) => selectedFileKeys.has(k));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAllFiles(allVisibleKeys);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 transition-colors relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-blue-600/90 dark:bg-blue-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white border-4 border-dashed border-white/60 m-3 rounded-3xl animate-in zoom-in-95 duration-150">
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mb-4 shadow-lg animate-bounce">
            <CloudUpload className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Drop files to upload</h3>
          <p className="text-sm text-blue-100 mt-1.5 max-w-sm text-center">
            Files will upload to{' '}
            <strong>
              {activeAccountId === 'ALL'
                ? accounts[0]?.badgeLabel || 'Active Drive'
                : activeAccount?.badgeLabel}
            </strong>{' '}
            {currentFolder ? `in folder "${currentFolder.name}"` : 'in Root directory'}
          </p>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 transition-colors">
        {/* Left: Breadcrumbs / Back navigation */}
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
          {folderHistory.length > 0 && (
            <button
              onClick={navigateBack}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 mr-0.5 cursor-pointer transition"
              title="Go back up"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => navigateToFolder(null)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
              !currentFolderId ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>
              {activeAccountId === 'ALL'
                ? 'All Clouds'
                : activeAccount?.badgeLabel || 'Drive'}
            </span>
          </button>

          {currentFolder && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-xs">
                {currentFolder.name}
              </span>
            </>
          )}

          {searchQuery && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                "{searchQuery}"
              </span>
            </>
          )}
        </div>

        {/* Right: Actions & View Modes */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Provider Filter Segmented (Multi-Cloud) */}
          <div className="hidden xl:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveProvider('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                activeProvider === 'ALL'
                  ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Providers
            </button>
            {(Object.keys(PROVIDERS) as ProviderId[]).map((pId) => {
              const p = PROVIDERS[pId];
              return (
                <button
                  key={pId}
                  onClick={() => setActiveProvider(pId)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer ${
                    activeProvider === pId
                      ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.brandColor }} />
                  <span>{p.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition shadow-2xs"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="size_desc">Largest first</option>
              <option value="size_asc">Smallest first</option>
            </select>
          </div>

          {/* Density Toggle Button */}
          <button
            onClick={toggleDensity}
            className={`p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shadow-2xs cursor-pointer ${
              density === 'compact' ? 'text-blue-600 dark:text-blue-400' : ''
            }`}
            title={`Density: ${density} (Click to toggle)`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Grid / List Switch */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New Folder & Upload */}
          <button
            onClick={onOpenNewFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Folder</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Bar with Zero-Pill count styling */}
      <div className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shadow-2xs transition-colors">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden sm:flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filter:</span>
          </span>

          {/* 1. All */}
          <button
            onClick={() => setFilterOption('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              filterOption === 'all'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${filterOption === 'all' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>All</span>
            <span className={`text-[11px] font-mono tabular-nums ${filterOption === 'all' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
              ({categoryCounts.all})
            </span>
          </button>

          {/* 2. Documents */}
          <button
            onClick={() => setFilterOption(filterOption === 'documents' ? 'all' : 'documents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              filterOption === 'documents'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${filterOption === 'documents' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            <span>Documents</span>
            <span className={`text-[11px] font-mono tabular-nums ${filterOption === 'documents' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
              ({categoryCounts.documents})
            </span>
          </button>

          {/* 3. Images */}
          <button
            onClick={() => setFilterOption(filterOption === 'images' ? 'all' : 'images')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              filterOption === 'images'
                ? 'bg-rose-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ImageIcon className={`w-3.5 h-3.5 ${filterOption === 'images' ? 'text-white' : 'text-rose-500'}`} />
            <span>Images</span>
            <span className={`text-[11px] font-mono tabular-nums ${filterOption === 'images' ? 'text-rose-100' : 'text-slate-400 dark:text-slate-500'}`}>
              ({categoryCounts.images})
            </span>
          </button>

          {/* 4. Videos */}
          <button
            onClick={() => setFilterOption(filterOption === 'videos' ? 'all' : 'videos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              filterOption === 'videos'
                ? 'bg-purple-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Video className={`w-3.5 h-3.5 ${filterOption === 'videos' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
            <span>Videos</span>
            <span className={`text-[11px] font-mono tabular-nums ${filterOption === 'videos' ? 'text-purple-100' : 'text-slate-400 dark:text-slate-500'}`}>
              ({categoryCounts.videos})
            </span>
          </button>

          {/* 5. Audio */}
          <button
            onClick={() => setFilterOption(filterOption === 'audio' ? 'all' : 'audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              filterOption === 'audio'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Music className={`w-3.5 h-3.5 ${filterOption === 'audio' ? 'text-white' : 'text-amber-500'}`} />
            <span>Audio</span>
            <span className={`text-[11px] font-mono tabular-nums ${filterOption === 'audio' ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'}`}>
              ({categoryCounts.audio})
            </span>
          </button>

          {/* 6. Folders */}
          <button
            onClick={() => setFilterOption(filterOption === 'folders' ? 'all' : 'folders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              filterOption === 'folders'
                ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Folder className={`w-3.5 h-3.5 ${filterOption === 'folders' ? 'text-white' : 'text-amber-500'}`} />
            <span>Folders</span>
            <span className={`text-[11px] font-mono tabular-nums ${filterOption === 'folders' ? 'text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
              ({categoryCounts.folders})
            </span>
          </button>
        </div>

        {/* Clear Filter button if active */}
        {filterOption !== 'all' && (
          <button
            onClick={() => setFilterOption('all')}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 font-medium"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset filter</span>
          </button>
        )}
      </div>

      {/* Floating Batch Selection Dock */}
      {selectedFileKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3.5 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-semibold font-mono tabular-nums">{selectedFileKeys.size} selected</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 dark:hover:bg-slate-700/80 rounded-lg transition font-medium cursor-pointer"
            >
              {isAllSelected ? 'Deselect all' : 'Select all'}
            </button>

            {selectedFileKeys.size === 1 && onOpenQuickLook && (
              <button
                onClick={() => {
                  const selectedKey = Array.from(selectedFileKeys)[0];
                  const found = displayedFiles.find((f) => cacheKey(f.ref) === selectedKey);
                  if (found) onOpenQuickLook(found);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-600 transition cursor-pointer"
                title="Preview file (Space)"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Quick Look</span>
              </button>
            )}

            <button
              onClick={() => {
                const selected = files.filter((f) => selectedFileKeys.has(cacheKey(f.ref)));
                selected.forEach((f) => {
                  if (!f.isFolder) downloadFile(f);
                });
                clearSelection();
                toast.success(`Downloading ${selected.length} file(s)`);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={() => {
                const selected = files.filter((f) => selectedFileKeys.has(cacheKey(f.ref)));
                selected.forEach((f) => trashFile(f));
                clearSelection();
                toast.success(`Moved ${selected.length} file(s) to trash`);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-medium shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash</span>
            </button>

            <button
              onClick={clearSelection}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer ml-1"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Files View */}
      <div className={`flex-1 overflow-y-auto ${density === 'compact' ? 'p-2 sm:p-3' : 'p-3 sm:p-4'}`}>
        {displayedFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center">
            <FileQuestion className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              {filterOption !== 'all' ? `No ${filterOption} found` : 'No files in view'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? 'No matching files found across connected cloud accounts.'
                : filterOption !== 'all'
                ? `There are no ${filterOption} in this view. Try selecting "All" or uploading a file.`
                : currentTab === 'trash'
                ? 'Trash is empty.'
                : currentTab === 'starred'
                ? 'No starred files yet.'
                : 'This folder is empty. Drag and drop files here, or use the Upload button.'}
            </p>
            {filterOption !== 'all' ? (
              <button
                onClick={() => setFilterOption('all')}
                className="mt-3 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl transition font-medium cursor-pointer"
              >
                Show All Files
              </button>
            ) : (
              <button
                onClick={onOpenUpload}
                className="mt-3 flex items-center gap-1.5 px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-medium cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload First File</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div
            className={`grid ${
              density === 'compact'
                ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3'
            }`}
          >
            {displayedFiles.map((file) => (
              <FileItemCard
                key={cacheKey(file.ref)}
                file={file}
                onOpenDetails={onOpenDetails}
                onDoubleClick={handleDoubleClick}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="w-10 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Cloud Account</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Last Modified</th>
                  <th className="px-3 py-2 hidden md:table-cell">Size</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedFiles.map((file) => (
                  <FileItemRow
                    key={cacheKey(file.ref)}
                    file={file}
                    onOpenDetails={onOpenDetails}
                    onDoubleClick={handleDoubleClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
