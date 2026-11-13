import React, { useState } from 'react';
import {
  Cloud,
  HardDrive,
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Upload,
  FolderPlus,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Star,
  Download,
  Trash2,
  Eye,
  Link2,
  Unlink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import {
  AccountState,
  CloudFile,
  ProviderId,
  PROVIDERS,
  cacheKey,
} from '../../types';
import { toast } from 'sonner';

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 10 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

interface MultiCloudDashboardViewProps {
  onOpenAddAccount?: () => void;
  onOpenUpload?: () => void;
  onOpenNewFolder?: () => void;
  onOpenDetails?: (file: CloudFile) => void;
}

const STORAGE_PROVIDER_IDS: ProviderId[] = [
  'GOOGLE_DRIVE',
  'ONE_DRIVE',
  'DROPBOX',
  'BOX',
];

export const MultiCloudDashboardView: React.FC<MultiCloudDashboardViewProps> = ({
  onOpenAddAccount,
  onOpenUpload,
  onOpenNewFolder,
  onOpenDetails,
}) => {
  const {
    accounts,
    files,
    quotas,
    syncStatuses,
    setCurrentTab,
    setActiveAccountId,
    setActiveProvider,
    setSearchQuery,
    syncAllAccounts,
    reconnectAccount,
    disconnectAccount,
    downloadFile,
    toggleStar,
    trashFile,
    loadSampleWorkspace,
  } = useFileManager();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const activeFiles = files.filter((f) => !f.isTrashed);
  const totalFolders = activeFiles.filter((f) => f.isFolder).length;
  const totalDocuments = activeFiles.filter((f) => !f.isFolder).length;
  const starredCount = activeFiles.filter((f) => f.isStarred).length;
  const connectedAccountsCount = accounts.filter(
    (a) => a.state === AccountState.CONNECTED
  ).length;
  const degradedAccountsCount = accounts.filter(
    (a) => a.state !== AccountState.CONNECTED
  ).length;

  const recentFiles = [...activeFiles]
    .sort((a, b) => b.modifiedTimeMillis - a.modifiedTimeMillis)
    .slice(0, 8);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await syncAllAccounts();
      toast.success('Cloud providers synchronized successfully');
    } catch {
      toast.error('Failed to refresh cloud providers');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(quickSearch.trim());
    setCurrentTab('search');
  };

  const renderFileIcon = (file: CloudFile) => {
    if (file.isFolder) return <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20" />;
    if (file.mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-pink-500" />;
    if (file.mimeType.startsWith('video/')) return <Film className="w-4 h-4 text-purple-500" />;
    if (file.mimeType.startsWith('audio/')) return <Music className="w-4 h-4 text-indigo-500" />;
    return <FileText className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* 1. Top Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Multi-Cloud Storage Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Per-Account Quota Isolation</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unified file browser, cross-account search, and independent storage management across Google Drive, Microsoft OneDrive, Dropbox, and Box.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenAddAccount?.()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Cloud Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (accounts.length === 0) {
                toast.info('Connect a cloud storage account first to upload files.');
                onOpenAddAccount?.();
                return;
              }
              onOpenUpload?.();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (accounts.length === 0) {
                toast.info('Connect a cloud storage account first to create folders.');
                onOpenAddAccount?.();
                return;
              }
              onOpenNewFolder?.();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
            <span>New Folder</span>
          </button>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefreshAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer shadow-2xs disabled:opacity-50"
            title="Refresh all connected cloud providers"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Cross-Cloud Search Bar */}
      <form
        onSubmit={handleQuickSearchSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-2xs"
      >
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Search files and folders across Google Drive, OneDrive, Dropbox & Box..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shrink-0"
          >
            Search All Clouds
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveProvider('ALL');
              setActiveAccountId('ALL');
              setCurrentTab('files');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shrink-0"
          >
            Open File Browser
          </button>
        </div>
      </form>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setCurrentTab('accounts')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-blue-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Connected Accounts</span>
            <Cloud className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {connectedAccountsCount}
            <span className="text-xs font-normal text-slate-400 ml-1.5">
              / {accounts.length} total
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {degradedAccountsCount > 0
              ? `${degradedAccountsCount} account requires re-auth`
              : accounts.length > 0
              ? 'All connected accounts healthy'
              : 'Ready to connect providers'}
          </p>
        </div>

        <div
          onClick={() => setCurrentTab('files')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-blue-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Indexed Files</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {totalDocuments}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across {totalFolders} folders in workspace
          </p>
        </div>

        <div
          onClick={() => setCurrentTab('starred')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-blue-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Starred Items</span>
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {starredCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Pinned for quick cross-cloud access
          </p>
        </div>

        <div
          onClick={() => setCurrentTab('quotas')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-blue-400 transition shadow-2xs"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Storage Governance</span>
            <HardDrive className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            4 Providers
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Drive, OneDrive, Dropbox & Box
          </p>
        </div>
      </div>

      {/* 4. Supported Cloud Storage Providers Grid (Google Drive, OneDrive, Dropbox, Box) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cloud Storage Providers (Google Drive · OneDrive · Dropbox · Box)
            </h2>
            <p className="text-[11px] text-slate-400">
              Each connected account is metered independently by its provider
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('accounts')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Accounts Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STORAGE_PROVIDER_IDS.map((providerId) => {
            const meta = PROVIDERS[providerId];
            const providerAccounts = accounts.filter((a) => a.provider === providerId);
            const providerFilesCount = activeFiles.filter(
              (f) => f.ref.provider === providerId
            ).length;

            return (
              <div
                key={providerId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-blue-400 dark:hover:border-blue-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs"
                        style={{ backgroundColor: meta.brandColor }}
                      >
                        {meta.shortName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {meta.name}
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          {providerAccounts.length === 0
                            ? 'Not connected'
                            : `${providerAccounts.length} account${
                                providerAccounts.length > 1 ? 's' : ''
                              } · ${providerFilesCount} items`}
                        </span>
                      </div>
                    </div>

                    {providerAccounts.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <span>Disconnected</span>
                      </span>
                    )}
                  </div>

                  {/* Per-account storage usage */}
                  {providerAccounts.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center my-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Connect your {meta.name} account to browse, search, and manage files.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 my-2">
                      {providerAccounts.map((acc) => {
                        const q = quotas[acc.localId];
                        const used = q?.usedBytes ?? 0;
                        const limit = q?.limitBytes ?? meta.defaultQuotaBytes;
                        const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
                        const syncState = syncStatuses[acc.localId];
                        const isHealthy = acc.state === AccountState.CONNECTED;

                        return (
                          <div
                            key={acc.localId}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {acc.displayName}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  isHealthy
                                    ? 'bg-emerald-100/80 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {isHealthy ? syncState?.status || 'CONNECTED' : acc.state}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {acc.displayEmail}
                            </p>

                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: pct > 85 ? '#f43f5e' : meta.brandColor,
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>{formatBytes(used)} used</span>
                              <span>{formatBytes(limit)} limit</span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProvider(providerId);
                                  setActiveAccountId(acc.localId);
                                  setCurrentTab('files');
                                }}
                                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                Browse Files
                              </button>

                              <div className="flex items-center gap-2">
                                {!isHealthy && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      reconnectAccount(acc.localId);
                                      toast.success(`Reconnected ${acc.displayName}`);
                                    }}
                                    className="text-[10px] font-semibold text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                    <span>Reconnect</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    disconnectAccount(acc.localId);
                                    toast.info(`Disconnected ${acc.displayName}`);
                                  }}
                                  className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  title="Disconnect account"
                                >
                                  <Unlink className="w-2.5 h-2.5" />
                                  <span>Disconnect</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAddAccount?.()}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {providerAccounts.length > 0 ? 'Add Another Account' : `Connect ${meta.shortName}`}
                    </span>
                  </button>

                  {providerAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProvider(providerId);
                        setActiveAccountId('ALL');
                        setCurrentTab('files');
                      }}
                      className="text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Connected Workspace Files OR Honest Setup Experience */}
      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
            <Cloud className="w-7 h-7" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Connect Your First Cloud Storage Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your workspace starts clean with zero pre-seeded files. Connect a Google Drive, Microsoft OneDrive, Dropbox, or Box account to start browsing, uploading, and organizing your files{import.meta.env.DEV ? ', or load a development sample workspace to test UI flows locally' : ''}.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAddAccount?.()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Cloud Provider</span>
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => {
                  loadSampleWorkspace();
                  toast.success('Loaded sample multi-cloud workspace across Google Drive, OneDrive, Dropbox & Box');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Load Sample Multi-Cloud Workspace</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Files & Folders Across Connected Clouds
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any item to inspect metadata, preview, download, star, or move
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentTab('files')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({activeFiles.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentFiles.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <Folder className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No files in connected accounts yet
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenUpload?.()}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Upload First File
                </button>
                <button
                  type="button"
                  onClick={() => onOpenNewFolder?.()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentFiles.map((file) => {
                const key = cacheKey(file.ref);
                const providerMeta = PROVIDERS[file.ref.provider];
                const account = accounts.find((a) => a.localId === file.ref.accountId);

                return (
                  <div
                    key={key}
                    onClick={() => {
                      if (file.isFolder) {
                        setActiveAccountId(file.ref.accountId);
                        setCurrentTab('files');
                      } else {
                        onOpenDetails?.(file);
                      }
                    }}
                    className="py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {renderFileIcon(file)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.2 rounded text-white shrink-0"
                            style={{ backgroundColor: providerMeta.brandColor }}
                          >
                            {account?.badgeLabel || providerMeta.shortName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {file.isFolder ? 'Folder' : formatBytes(file.sizeBytes)} ·{' '}
                          {account?.displayEmail || providerMeta.name}
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggleStar(file)}
                        className={`p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer ${
                          file.isStarred ? 'text-amber-500' : 'text-slate-400'
                        }`}
                        title={file.isStarred ? 'Unstar' : 'Star'}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      {!file.isFolder && (
                        <button
                          type="button"
                          onClick={() => void downloadFile(file)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenDetails?.(file)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          trashFile(file);
                          toast.info(`Moved "${file.name}" to Trash`);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
