import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Command,
  Cloud,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Folder,
  Archive,
  HardDrive,
  Upload,
  FolderPlus,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  LayoutGrid,
  List,
  Shield,
  HelpCircle,
  Settings,
  Scale,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Keyboard,
  X,
  Layers,
  Workflow,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useTheme } from '../../context/ThemeContext';
import { CloudFile, PROVIDERS, ProviderId, cacheKey } from '../../types';
import { CloudResource } from '../../types/infrastructure';
import { humanReadableBytes, formatDate } from '../../utils/formatters';
import { getFileTypeDetails } from '../FileBrowser/FileIcon';
import { toast } from 'sonner';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
  onOpenShortcuts: () => void;
}

interface PaletteAction {
  id: string;
  category: 'Actions' | 'Navigation' | 'Accounts' | 'System';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenUpload,
  onOpenNewFolder,
  onOpenShortcuts,
}) => {
  const {
    files,
    accounts,
    activeAccountId,
    setActiveAccountId,
    currentTab,
    setCurrentTab,
    viewMode,
    setViewMode,
    syncAllAccounts,
    setInspectedFile,
    navigateToFolder,
  } = useFileManager();

  const { resources, setSelectedResource } = useInfrastructure();
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut handler when palette is closed: Cmd+K / Ctrl+K or '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If palette open, handle navigation
      if (isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Actions list
  const systemActions: PaletteAction[] = useMemo(() => {
    return [
      {
        id: 'action-upload',
        category: 'Actions',
        title: 'Upload files',
        subtitle: 'Upload local files to active cloud drive',
        icon: <Upload className="w-4 h-4 text-blue-500" />,
        shortcut: '⌘U',
        action: () => {
          onClose();
          onOpenUpload();
        },
      },
      {
        id: 'action-new-folder',
        category: 'Actions',
        title: 'New folder',
        subtitle: 'Create a new directory in current location',
        icon: <FolderPlus className="w-4 h-4 text-amber-500" />,
        shortcut: '⌘⇧N',
        action: () => {
          onClose();
          onOpenNewFolder();
        },
      },
      {
        id: 'action-sync-all',
        category: 'Actions',
        title: 'Sync all cloud accounts',
        subtitle: 'Trigger background synchronization across all providers',
        icon: <RefreshCw className="w-4 h-4 text-emerald-500" />,
        shortcut: '⌘R',
        action: () => {
          onClose();
          syncAllAccounts();
          toast.success('Sync triggered for all authorized cloud accounts');
        },
      },
      {
        id: 'nav-dashboard',
        category: 'Navigation',
        title: 'Command Center Dashboard',
        subtitle: 'Executive overview, health SLA, and hyperscaler spend',
        icon: <Cloud className="w-4 h-4 text-blue-500" />,
        shortcut: 'G D',
        action: () => {
          onClose();
          setCurrentTab('dashboard');
        },
      },
      {
        id: 'nav-topology',
        category: 'Navigation',
        title: 'Multi-Cloud Topology Map',
        subtitle: 'Interactive dependency graph across AWS, Azure, GCP',
        icon: <Layers className="w-4 h-4 text-indigo-500" />,
        shortcut: 'G T',
        action: () => {
          onClose();
          setCurrentTab('infra_topology');
        },
      },
      {
        id: 'nav-infra',
        category: 'Navigation',
        title: 'Infrastructure Fleet Overview',
        subtitle: 'Compute VMs, K8s, databases, and networks',
        icon: <HardDrive className="w-4 h-4 text-emerald-500" />,
        shortcut: 'G I',
        action: () => {
          onClose();
          setCurrentTab('infra_overview');
        },
      },
      {
        id: 'nav-providers',
        category: 'Navigation',
        title: 'Cloud Providers & Tenants',
        subtitle: 'AWS accounts, Azure subscriptions, GCP projects',
        icon: <Cloud className="w-4 h-4 text-amber-500" />,
        shortcut: 'G P',
        action: () => {
          onClose();
          setCurrentTab('providers');
        },
      },
      {
        id: 'nav-metrics',
        category: 'Navigation',
        title: 'Live Metrics & Observability',
        subtitle: 'P95 latency percentiles and network throughput',
        icon: <Sparkles className="w-4 h-4 text-sky-500" />,
        action: () => {
          onClose();
          setCurrentTab('monitoring_metrics');
        },
      },
      {
        id: 'nav-logs',
        category: 'Navigation',
        title: 'Live Multi-Cloud Syslog',
        subtitle: 'Streaming events, debug traces, and audit logs',
        icon: <FileText className="w-4 h-4 text-slate-400" />,
        shortcut: 'G L',
        action: () => {
          onClose();
          setCurrentTab('monitoring_logs');
        },
      },
      {
        id: 'nav-cost',
        category: 'Navigation',
        title: 'FinOps Cost Governance',
        subtitle: 'Spend optimization and budget tracking',
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        shortcut: 'G C',
        action: () => {
          onClose();
          setCurrentTab('cost_overview');
        },
      },
      {
        id: 'nav-automation',
        category: 'Navigation',
        title: 'Automation Runbooks',
        subtitle: 'Cross-cloud replication and power schedulers',
        icon: <Workflow className="w-4 h-4 text-purple-500" />,
        shortcut: 'G R',
        action: () => {
          onClose();
          setCurrentTab('automation_workflows');
        },
      },
      {
        id: 'nav-files',
        category: 'Navigation',
        title: 'Cloud Storage Files',
        subtitle: 'Explore cloud files, uploads and folder tree',
        icon: <Folder className="w-4 h-4 text-blue-500" />,
        shortcut: 'G F',
        action: () => {
          onClose();
          setCurrentTab('files');
        },
      },
      {
        id: 'nav-gallery',
        category: 'Navigation',
        title: 'Media Gallery',
        subtitle: 'High-res photos, videos, and visual assets',
        icon: <ImageIcon className="w-4 h-4 text-rose-500" />,
        shortcut: 'G G',
        action: () => {
          onClose();
          setCurrentTab('gallery');
        },
      },
      {
        id: 'nav-quotas',
        category: 'Navigation',
        title: 'Storage & Quota Governor',
        subtitle: 'Interactive charts and capacity breakdown',
        icon: <HardDrive className="w-4 h-4 text-indigo-500" />,
        shortcut: 'G Q',
        action: () => {
          onClose();
          setCurrentTab('quotas');
        },
      },
      {
        id: 'nav-accounts',
        category: 'Navigation',
        title: 'Accounts Center',
        subtitle: 'Manage connected Google, Microsoft, Dropbox & Box accounts',
        icon: <Cloud className="w-4 h-4 text-sky-500" />,
        shortcut: 'G A',
        action: () => {
          onClose();
          setCurrentTab('accounts');
        },
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Settings',
        subtitle: 'Preferences, themes, bandwidth and storage limits',
        icon: <Settings className="w-4 h-4 text-slate-500" />,
        shortcut: 'G S',
        action: () => {
          onClose();
          setCurrentTab('settings');
        },
      },
      {
        id: 'nav-security',
        category: 'Navigation',
        title: 'Security & Audit Log',
        subtitle: 'Immutable record of cloud file transfers and access events',
        icon: <Shield className="w-4 h-4 text-emerald-500" />,
        action: () => {
          onClose();
          setCurrentTab('security');
        },
      },
      {
        id: 'theme-sun',
        category: 'System',
        title: 'Switch to Sun (Light) Theme',
        subtitle: 'High-contrast bright daylight theme',
        icon: <Sun className="w-4 h-4 text-amber-500" />,
        action: () => {
          onClose();
          setThemeMode('light');
          toast.success('Theme updated: Sun (Light)');
        },
      },
      {
        id: 'theme-dark',
        category: 'System',
        title: 'Switch to Dark Theme',
        subtitle: 'Deep slate dark color palette',
        icon: <Moon className="w-4 h-4 text-indigo-400" />,
        action: () => {
          onClose();
          setThemeMode('dark');
          toast.success('Theme updated: Dark');
        },
      },
      {
        id: 'theme-system',
        category: 'System',
        title: 'Switch to System Theme',
        subtitle: 'Sync automatically with OS dark/light mode',
        icon: <Monitor className="w-4 h-4 text-slate-400" />,
        action: () => {
          onClose();
          setThemeMode('system');
          toast.success('Theme updated: System Default');
        },
      },
      {
        id: 'view-grid',
        category: 'System',
        title: 'Switch to Grid View',
        subtitle: 'Card preview layout with thumbnail inspection',
        icon: <LayoutGrid className="w-4 h-4 text-slate-500" />,
        shortcut: '1',
        action: () => {
          onClose();
          setViewMode('grid');
        },
      },
      {
        id: 'view-list',
        category: 'System',
        title: 'Switch to List View',
        subtitle: 'Dense tabular grid with dates and sizes',
        icon: <List className="w-4 h-4 text-slate-500" />,
        shortcut: '2',
        action: () => {
          onClose();
          setViewMode('list');
        },
      },
      {
        id: 'shortcuts-modal',
        category: 'System',
        title: 'Keyboard Shortcuts Legend',
        subtitle: 'View full list of keyboard commands',
        icon: <Keyboard className="w-4 h-4 text-purple-500" />,
        shortcut: '?',
        action: () => {
          onClose();
          onOpenShortcuts();
        },
      },
    ];
  }, [
    onClose,
    onOpenUpload,
    onOpenNewFolder,
    onOpenShortcuts,
    syncAllAccounts,
    setCurrentTab,
    setThemeMode,
    setViewMode,
  ]);

  // Account switch actions
  const accountActions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [
      {
        id: 'acc-all',
        category: 'Accounts',
        title: 'All Connected Clouds',
        subtitle: `Aggregated view across ${accounts.length} authorized accounts`,
        icon: <Cloud className="w-4 h-4 text-blue-500" />,
        action: () => {
          onClose();
          setActiveAccountId('ALL');
          setCurrentTab('files');
          toast.success('Switched scope to All Cloud Accounts');
        },
      },
    ];

    accounts.forEach((acc) => {
      const p = PROVIDERS[acc.provider];
      list.push({
        id: `acc-${acc.localId}`,
        category: 'Accounts',
        title: acc.badgeLabel,
        subtitle: `${p?.name || 'Cloud'} · ${acc.displayEmail}`,
        icon: (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: acc.color }}
          />
        ),
        action: () => {
          onClose();
          setActiveAccountId(acc.localId);
          setCurrentTab('files');
          toast.success(`Switched active account to ${acc.badgeLabel}`);
        },
      });
    });

    return list;
  }, [accounts, onClose, setActiveAccountId, setCurrentTab]);

  // Filtered files matching query
  const matchingFiles = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return files
      .filter((file) => {
        if (file.isTrashed) return false;
        return (
          file.name.toLowerCase().includes(q) ||
          file.mimeType.toLowerCase().includes(q) ||
          (file.previewText && file.previewText.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [files, query]);

  // Filtered actions matching query
  const filteredActions = useMemo(() => {
    const all = [...systemActions, ...accountActions];
    if (!query.trim()) {
      return all;
    }
    const q = query.toLowerCase();
    return all.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q)) ||
        a.category.toLowerCase().includes(q)
    );
  }, [systemActions, accountActions, query]);

  // Combined selectable items list
  interface ItemDescriptor {
    type: 'file' | 'action';
    data: CloudFile | PaletteAction;
  }

  const combinedItems: ItemDescriptor[] = useMemo(() => {
    const list: ItemDescriptor[] = [];
    matchingFiles.forEach((f) => list.push({ type: 'file', data: f }));
    filteredActions.forEach((a) => list.push({ type: 'action', data: a }));
    return list;
  }, [matchingFiles, filteredActions]);

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (combinedItems.length === 0) return 0;
      if (prev >= combinedItems.length) return combinedItems.length - 1;
      return prev;
    });
  }, [combinedItems.length]);

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, combinedItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? combinedItems.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = combinedItems[selectedIndex];
      if (!current) return;
      if (current.type === 'action') {
        (current.data as PaletteAction).action();
      } else {
        const file = current.data as CloudFile;
        onClose();
        if (file.isFolder) {
          navigateToFolder(file.ref.fileId);
          setCurrentTab('files');
        } else {
          setInspectedFile(file);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[82vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search all files, accounts, and views..."
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-4">
          {combinedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Command className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No commands or files match "{query}"
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Try searching for a file name, cloud provider, or action like "upload" or "theme".
              </p>
            </div>
          ) : (
            <>
              {/* Files section */}
              {matchingFiles.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Files ({matchingFiles.length})
                  </div>
                  <div className="space-y-0.5">
                    {matchingFiles.map((file, idx) => {
                      const isSelected = selectedIndex === idx;
                      const meta = getFileTypeDetails(
                        file.mimeType,
                        file.name,
                        file.isFolder
                      );
                      const acc = accounts.find((a) => a.localId === file.ref.accountId);

                      return (
                        <div
                          key={cacheKey(file.ref)}
                          onClick={() => {
                            onClose();
                            if (file.isFolder) {
                              navigateToFolder(file.ref.fileId);
                              setCurrentTab('files');
                            } else {
                              setInspectedFile(file);
                            }
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-blue-500/40 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {file.isFolder ? (
                                <Folder className="w-4 h-4 text-amber-500" />
                              ) : file.mimeType.startsWith('image/') ? (
                                <ImageIcon className="w-4 h-4 text-rose-500" />
                              ) : file.mimeType.startsWith('video/') ? (
                                <Video className="w-4 h-4 text-purple-500" />
                              ) : (
                                <FileText className="w-4 h-4 text-blue-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{file.name}</p>
                              <div
                                className={`flex items-center gap-1.5 text-[11px] truncate ${
                                  isSelected
                                    ? 'text-blue-100'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                <span>{acc?.badgeLabel || 'Cloud'}</span>
                                <span>·</span>
                                <span>{meta.label}</span>
                                {!file.isFolder && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono tabular-nums">
                                      {humanReadableBytes(file.sizeBytes)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span
                              className={`text-[10px] font-mono ${
                                isSelected ? 'text-blue-200' : 'text-slate-400'
                              }`}
                            >
                              {formatDate(file.modifiedTimeMillis)}
                            </span>
                            <ArrowRight
                              className={`w-3.5 h-3.5 ${
                                isSelected ? 'text-white' : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Commands & Actions sections */}
              {['Actions', 'Navigation', 'Accounts', 'System'].map((cat) => {
                const catActions = filteredActions.filter((a) => a.category === cat);
                if (catActions.length === 0) return null;

                return (
                  <div key={cat}>
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {cat}
                    </div>
                    <div className="space-y-0.5">
                      {catActions.map((act) => {
                        const globalIndex = combinedItems.findIndex(
                          (item) => item.type === 'action' && item.data === act
                        );
                        const isSelected = selectedIndex === globalIndex;

                        return (
                          <div
                            key={act.id}
                            onClick={() => act.action()}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-500/40 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800'
                                }`}
                              >
                                {act.icon}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{act.title}</p>
                                {act.subtitle && (
                                  <p
                                    className={`text-[11px] truncate ${
                                      isSelected
                                        ? 'text-blue-100'
                                        : 'text-slate-400 dark:text-slate-500'
                                    }`}
                                  >
                                    {act.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>

                            {act.shortcut && (
                              <kbd
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                  isSelected
                                    ? 'border-blue-400 bg-blue-500 text-white'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {act.shortcut}
                              </kbd>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">
                ↵
              </kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">
                esc
              </kbd>
              <span>dismiss</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            <span>Active theme:</span>
            <strong className="text-slate-700 dark:text-slate-300 capitalize">
              {themeMode}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
