import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AccountRef,
  AccountState,
  CloudFile,
  FileRef,
  LocalAccountId,
  PendingOperation,
  ProviderCapabilities,
  ProviderId,
  PROVIDERS,
  QuotaSnapshot,
  QuotaUsage,
  TransferItem,
  AuditLogEntry,
  ProviderSyncStatus,
  SyncStatusState,
  cacheKey,
} from '../types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_CAPABILITIES,
  INITIAL_FILES,
  INITIAL_QUOTA,
} from '../data/mockData';
import { AccountStateMachine } from '../utils/accountStateMachine';
import { globalQuotaGovernor } from '../utils/quotaGovernor';
import { Redactor } from '../utils/redactor';

export type NavigationTab =
  // Command Center
  | 'dashboard'
  // Infrastructure
  | 'infra_overview'
  | 'infra_compute'
  | 'infra_storage'
  | 'infra_databases'
  | 'infra_networks'
  | 'infra_k8s'
  | 'infra_topology'
  // Cloud Providers
  | 'providers'
  | 'accounts'
  // Observability & Monitoring
  | 'monitoring_metrics'
  | 'monitoring_logs'
  | 'monitoring_alerts'
  | 'monitoring_events'
  // Governance & Security
  | 'security'
  | 'security_policies'
  // FinOps & Cost
  | 'cost_overview'
  | 'cost_optimization'
  // Automation
  | 'automation_workflows'
  // Storage & Files (Rich file subsystem)
  | 'files'
  | 'gallery'
  | 'search'
  | 'starred'
  | 'recent'
  | 'trash'
  | 'quotas'
  | 'operations'
  | 'offline'
  // Settings & System
  | 'settings'
  | 'legal'
  | 'help';

export type SortOption =
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc'
  | 'size_desc'
  | 'size_asc';

export type FilterOption =
  | 'all'
  | 'folders'
  | 'documents'
  | 'images'
  | 'videos'
  | 'audio'
  | 'media'
  | 'starred'
  | 'trashed';

interface FileManagerContextType {
  accounts: AccountRef[];
  activeAccountId: LocalAccountId | 'ALL';
  setActiveAccountId: (id: LocalAccountId | 'ALL') => void;
  activeProvider: ProviderId | 'ALL';
  setActiveProvider: (provider: ProviderId | 'ALL') => void;
  files: CloudFile[];
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  folderHistory: string[];
  navigateToFolder: (folderId: string | null) => void;
  navigateBack: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  filterOption: FilterOption;
  setFilterOption: (filter: FilterOption) => void;
  selectedFileKeys: Set<string>;
  toggleSelectFile: (key: string) => void;
  selectAllFiles: (keys: string[]) => void;
  clearSelection: () => void;

  // Selected file for detail inspect
  inspectedFile: CloudFile | null;
  setInspectedFile: (file: CloudFile | null) => void;

  // Mobile Device Frame view simulation toggle
  isMobilePreview: boolean;
  setIsMobilePreview: (val: boolean) => void;

  // Account operations
  connectAccount: (
    provider: ProviderId,
    email: string,
    displayName: string,
    badgeLabel: string,
    scopes: string[]
  ) => void;
  disconnectAccount: (accountId: LocalAccountId) => void;
  reconnectAccount: (accountId: LocalAccountId) => void;

  // File mutations
  uploadFile: (accountId: LocalAccountId, folderId: string | null, file: File) => Promise<void>;
  downloadFile: (file: CloudFile) => Promise<void>;
  renameFile: (file: CloudFile, newName: string) => void;
  moveFile: (file: CloudFile, targetFolderId: string | null) => void;
  trashFile: (file: CloudFile) => void;
  restoreFile: (file: CloudFile) => void;
  deletePermanently: (file: CloudFile) => void;
  toggleStar: (file: CloudFile) => void;
  createFolder: (accountId: LocalAccountId, name: string, parentFolderId: string | null) => void;

  // Capabilities & Quotas
  capabilities: Record<number, ProviderCapabilities>;
  quotas: Record<number, QuotaUsage>;
  quotaSnapshot: QuotaSnapshot;
  refreshQuotaSnapshot: () => void;

  // Pending ops & transfers
  pendingOperations: PendingOperation[];
  reconcileOperation: (id: number) => void;
  retryOperation: (id: number) => void;
  clearCompletedOperations: () => void;
  transfers: TransferItem[];
  cancelTransfer: (id: string) => void;
  clearCompletedTransfers: () => void;
  retryTransfer: (id: string) => void;
  pauseResumeTransfer: (id: string) => void;

  // Background sync and connection status
  syncStatuses: Record<LocalAccountId, ProviderSyncStatus>;
  syncAccount: (accountId: LocalAccountId) => Promise<void>;
  syncAllAccounts: () => Promise<void>;
  simulateProviderIssue: (
    accountId: LocalAccountId,
    issueType: 'none' | 'error' | 'warning'
  ) => void;

  // Audit logs
  auditLogs: AuditLogEntry[];
  addAuditLog: (
    accountId: LocalAccountId,
    action: string,
    rawMessage: string,
    fileId?: string,
    severity?: 'INFO' | 'WARN' | 'ERROR'
  ) => void;
  clearAuditLogs: () => void;
  resetAllData: () => void;
}

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

export const FileManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from localStorage or defaults
  const [accounts, setAccounts] = useState<AccountRef[]>(() => {
    const saved = localStorage.getItem('ucfm_accounts_v2');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });

  const [files, setFiles] = useState<CloudFile[]>(() => {
    const saved = localStorage.getItem('ucfm_files_v2');
    return saved ? JSON.parse(saved) : INITIAL_FILES;
  });

  const [capabilities, setCapabilities] = useState<Record<number, ProviderCapabilities>>(() => {
    const saved = localStorage.getItem('ucfm_capabilities_v2');
    return saved ? JSON.parse(saved) : INITIAL_CAPABILITIES;
  });

  const [quotas, setQuotas] = useState<Record<number, QuotaUsage>>(() => {
    const saved = localStorage.getItem('ucfm_quotas_v2');
    return saved ? JSON.parse(saved) : INITIAL_QUOTA;
  });

  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>(() => {
    const saved = localStorage.getItem('ucfm_pending_ops_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem('ucfm_audit_logs_v2');
    return saved ? JSON.parse(saved) : [];
  });

  // Navigation and UI state
  const [activeAccountId, setActiveAccountId] = useState<LocalAccountId | 'ALL'>('ALL');
  const [activeProvider, setActiveProvider] = useState<ProviderId | 'ALL'>('ALL');
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [selectedFileKeys, setSelectedFileKeys] = useState<Set<string>>(new Set());
  const [inspectedFile, setInspectedFile] = useState<CloudFile | null>(null);
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  // Quota snapshot
  const [quotaSnapshot, setQuotaSnapshot] = useState<QuotaSnapshot>(() =>
    globalQuotaGovernor.snapshot()
  );

  const refreshQuotaSnapshot = () => {
    setQuotaSnapshot(globalQuotaGovernor.snapshot());
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('ucfm_accounts_v2', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('ucfm_files_v2', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('ucfm_capabilities_v2', JSON.stringify(capabilities));
  }, [capabilities]);

  useEffect(() => {
    localStorage.setItem('ucfm_quotas_v2', JSON.stringify(quotas));
  }, [quotas]);

  useEffect(() => {
    localStorage.setItem('ucfm_pending_ops_v2', JSON.stringify(pendingOperations));
  }, [pendingOperations]);

  useEffect(() => {
    localStorage.setItem('ucfm_audit_logs_v2', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const [syncStatuses, setSyncStatuses] = useState<Record<LocalAccountId, ProviderSyncStatus>>(() => {
    const saved = localStorage.getItem('ucfm_sync_statuses_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }

    const now = Date.now();
    return {
      1: {
        provider: 'GOOGLE_DRIVE',
        accountId: 1,
        status: 'synced',
        lastSyncedAt: now - 110_000,
        latencyMs: 38,
        itemsSynced: 42,
        autoSyncIntervalMinutes: 5,
      },
      2: {
        provider: 'GOOGLE_DRIVE',
        accountId: 2,
        status: 'synced',
        lastSyncedAt: now - 190_000,
        latencyMs: 44,
        itemsSynced: 12,
        autoSyncIntervalMinutes: 5,
      },
      3: {
        provider: 'ONE_DRIVE',
        accountId: 3,
        status: 'synced',
        lastSyncedAt: now - 240_000,
        latencyMs: 52,
        itemsSynced: 28,
        autoSyncIntervalMinutes: 5,
      },
      4: {
        provider: 'DROPBOX',
        accountId: 4,
        status: 'synced',
        lastSyncedAt: now - 75_000,
        latencyMs: 31,
        itemsSynced: 19,
        autoSyncIntervalMinutes: 5,
      },
      5: {
        provider: 'BOX',
        accountId: 5,
        status: 'synced',
        lastSyncedAt: now - 320_000,
        latencyMs: 65,
        itemsSynced: 15,
        autoSyncIntervalMinutes: 10,
      },
    };
  });

  useEffect(() => {
    localStorage.setItem('ucfm_sync_statuses_v2', JSON.stringify(syncStatuses));
  }, [syncStatuses]);

  // Logging with Redactor
  const addAuditLog = (
    accountId: LocalAccountId,
    action: string,
    rawMessage: string,
    fileId?: string,
    severity: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
  ) => {
    const redacted = Redactor.scrub(rawMessage);
    const correlationTag = fileId ? Redactor.fileRefTag(accountId, fileId) : '000000000000';

    const entry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      accountId,
      action,
      rawMessage,
      redactedMessage: redacted,
      correlationTag,
      severity,
    };

    setAuditLogs((prev) => [entry, ...prev.slice(0, 99)]);
  };

  // Folder navigation
  const navigateToFolder = (folderId: string | null) => {
    setFolderHistory((prev) => [...prev, currentFolderId ?? '__ROOT__']);
    setCurrentFolderId(folderId);
    setSelectedFileKeys(new Set());
  };

  const navigateBack = () => {
    if (folderHistory.length === 0) {
      setCurrentFolderId(null);
      return;
    }
    const previous = folderHistory[folderHistory.length - 1];
    setFolderHistory((prev) => prev.slice(0, -1));
    setCurrentFolderId(previous === '__ROOT__' ? null : previous);
    setSelectedFileKeys(new Set());
  };

  // Selection
  const toggleSelectFile = (key: string) => {
    setSelectedFileKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllFiles = (keys: string[]) => {
    setSelectedFileKeys(new Set(keys));
  };

  const clearSelection = () => {
    setSelectedFileKeys(new Set());
  };

  // Account operations
  const connectAccount = (
    provider: ProviderId,
    email: string,
    displayName: string,
    badgeLabel: string,
    scopes: string[]
  ) => {
    const newId = (accounts.reduce((max, a) => Math.max(max, a.localId), 0) + 1) as LocalAccountId;
    const providerMeta = PROVIDERS[provider];

    const mockToken = `ya29.a0AfH6SM${Math.random().toString(36).substring(2, 14)}`;
    addAuditLog(
      newId,
      'ACCOUNT_CONNECT_START',
      `Connecting ${providerMeta.name} account ${Redactor.maskEmail(email)} with token ${mockToken}`
    );

    const newAccount: AccountRef = {
      localId: newId,
      provider,
      providerAccountId: `${provider.toLowerCase()}_user_${Math.random().toString(36).substring(2, 8)}`,
      displayEmail: email,
      displayName,
      color: providerMeta.brandColor,
      badgeLabel: badgeLabel || providerMeta.shortName,
      state: AccountState.CONNECTED,
      grantedScopes: scopes,
      lastVerifiedAt: Date.now(),
    };

    setAccounts((prev) => [...prev, newAccount]);

    setCapabilities((prev) => ({
      ...prev,
      [newId]: {
        canReadFiles: true,
        canWriteFiles: true,
        canCreateFolders: true,
        canRename: true,
        canTrash: true,
        canSearch: true,
        canReadRevisions: true,
        canStar: true,
        canDownloadBytes: true,
        grantsOfflineAccess: true,
        canExport: provider === 'GOOGLE_DRIVE',
      },
    }));

    setQuotas((prev) => ({
      ...prev,
      [newId]: {
        providerId: provider,
        accountId: newId,
        usedBytes: 100 * 1024 * 1024,
        limitBytes: providerMeta.defaultQuotaBytes,
        manageUrl: providerMeta.manageUrl,
      },
    }));

    addAuditLog(
      newId,
      'ACCOUNT_CONNECTED',
      `Account verified for ${providerMeta.name}. State: CONNECTED.`
    );
  };

  const disconnectAccount = (accountId: LocalAccountId) => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) return;

    addAuditLog(
      accountId,
      'ACCOUNT_DISCONNECTED',
      `Disconnect requested for ${Redactor.maskEmail(account.displayEmail)}. Purging cached files and tokens.`
    );

    setFiles((prev) => prev.filter((f) => f.ref.accountId !== accountId));
    setCapabilities((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    setQuotas((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    setAccounts((prev) => prev.filter((a) => a.localId !== accountId));

    if (activeAccountId === accountId) {
      setActiveAccountId('ALL');
    }
  };

  const reconnectAccount = (accountId: LocalAccountId) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.localId === accountId
          ? { ...a, state: AccountState.CONNECTED, lastVerifiedAt: Date.now() }
          : a
      )
    );
    addAuditLog(accountId, 'ACCOUNT_REAUTH', `Reauthorization successful. State: CONNECTED.`);
  };

  // Upload file with actual browser preview / file reader
  const uploadFile = async (
    accountId: LocalAccountId,
    folderId: string | null,
    file: File
  ): Promise<void> => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) throw new Error('Account not found');

    const transferId = `xfer_up_${Date.now()}`;
    const fileId = `file_upload_${Date.now()}`;
    const fileRef: FileRef = {
      provider: account.provider,
      accountId,
      fileId,
    };

    const admission = globalQuotaGovernor.tryAcquire(accountId);
    refreshQuotaSnapshot();

    if (!admission.granted) {
      addAuditLog(
        accountId,
        'QUOTA_GOVERNOR_REFUSED',
        `Quota Governor refused upload request for ${file.name}. Reason: ${admission.reason}`,
        fileId,
        'WARN'
      );
      throw new Error(`Upload throttled by Quota Governor (${admission.reason}). Please retry.`);
    }

    const opId = Date.now();
    const newOp: PendingOperation = {
      id: opId,
      accountId,
      operation: 'UPLOAD',
      fileId,
      fileName: file.name,
      payload: JSON.stringify({ size: file.size, folderId }),
      state: 'RUNNING',
      createdAt: Date.now(),
      lastAttemptAt: Date.now(),
      attemptCount: 1,
      outcomeUncertain: false,
    };

    setPendingOperations((prev) => [newOp, ...prev]);

    const transferItem: TransferItem = {
      id: transferId,
      ref: fileRef,
      fileName: file.name,
      direction: 'UPLOAD',
      bytesTransferred: 0,
      totalBytes: file.size,
      status: { status: 'Running', progress: 0, speedBytesPerSec: 1024 * 1024 * 4 },
      startedAt: Date.now(),
    };
    setTransfers((prev) => [transferItem, ...prev]);

    // Read real file for thumbnail and preview text if possible
    let thumbnailLink: string | undefined = undefined;
    let previewText: string | undefined = undefined;

    if (file.type.startsWith('image/')) {
      thumbnailLink = URL.createObjectURL(file);
    } else if (file.type.includes('text') || file.type.includes('json') || file.type.includes('csv')) {
      try {
        const textSlice = await file.slice(0, 2000).text();
        previewText = textSlice;
      } catch (e) {
        // ignore
      }
    }

    return new Promise((resolve) => {
      let transferred = 0;
      const total = file.size;
      const interval = setInterval(() => {
        transferred += Math.min(total / 4, 1024 * 1024 * 4);
        const progress = Math.min(100, Math.round((transferred / total) * 100));

        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? {
                  ...t,
                  bytesTransferred: Math.min(transferred, total),
                  status:
                    progress >= 100
                      ? { status: 'Completed' }
                      : { status: 'Running', progress, speedBytesPerSec: 1024 * 1024 * 3.5 },
                }
              : t
          )
        );

        if (transferred >= total) {
          clearInterval(interval);
          globalQuotaGovernor.release(accountId);
          refreshQuotaSnapshot();

          const newCloudFile: CloudFile = {
            ref: fileRef,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            modifiedTimeMillis: Date.now(),
            isFolder: false,
            parentFolderId: folderId,
            isShared: false,
            isOwnedByUser: true,
            isStarred: false,
            isTrashed: false,
            thumbnailLink,
            previewText,
          };

          setFiles((prev) => [newCloudFile, ...prev]);
          setPendingOperations((prev) =>
            prev.map((op) => (op.id === opId ? { ...op, state: 'COMPLETED' } : op))
          );

          setQuotas((prev) => {
            const current = prev[accountId];
            if (!current) return prev;
            return {
              ...prev,
              [accountId]: {
                ...current,
                usedBytes: current.usedBytes + file.size,
              },
            };
          });

          addAuditLog(
            accountId,
            'UPLOAD_COMPLETED',
            `Direct upload completed: ${file.name} (${file.size} bytes) to ${account.badgeLabel}.`,
            fileId
          );

          resolve();
        }
      }, 250);
    });
  };

  // Real download triggering browser file download
  const downloadFile = async (file: CloudFile): Promise<void> => {
    const transferId = `xfer_down_${Date.now()}`;
    const admission = globalQuotaGovernor.tryAcquire(file.ref.accountId);
    refreshQuotaSnapshot();

    if (!admission.granted) {
      addAuditLog(
        file.ref.accountId,
        'QUOTA_GOVERNOR_REFUSED',
        `Download refused by Governor: ${file.name}. Reason: ${admission.reason}`,
        file.ref.fileId,
        'WARN'
      );
      throw new Error(`Download throttled by Quota Governor (${admission.reason})`);
    }

    const totalBytes = file.sizeBytes || 1024 * 1024 * 3;
    const transferItem: TransferItem = {
      id: transferId,
      ref: file.ref,
      fileName: file.name,
      direction: 'DOWNLOAD',
      bytesTransferred: 0,
      totalBytes,
      status: { status: 'Running', progress: 0, speedBytesPerSec: 1024 * 1024 * 5 },
      startedAt: Date.now(),
    };
    setTransfers((prev) => [transferItem, ...prev]);

    return new Promise((resolve) => {
      let transferred = 0;
      const interval = setInterval(() => {
        transferred += Math.min(totalBytes / 3, 1024 * 1024 * 4);
        const progress = Math.min(100, Math.round((transferred / totalBytes) * 100));

        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? {
                  ...t,
                  bytesTransferred: Math.min(transferred, totalBytes),
                  status:
                    progress >= 100
                      ? { status: 'Completed' }
                      : { status: 'Running', progress, speedBytesPerSec: 1024 * 1024 * 5 },
                }
              : t
          )
        );

        if (transferred >= totalBytes) {
          clearInterval(interval);
          globalQuotaGovernor.release(file.ref.accountId);
          refreshQuotaSnapshot();

          // Trigger real browser file download
          try {
            const content = file.previewText || `Content of ${file.name}\nGenerated from Unified Cloud File Manager\nProvider Account ID: ${file.ref.accountId}\nTimestamp: ${new Date().toISOString()}`;
            const blob = new Blob([content], { type: file.mimeType || 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            console.error('Trigger download error', e);
          }

          addAuditLog(
            file.ref.accountId,
            'DOWNLOAD_COMPLETED',
            `Downloaded ${file.name} directly to device via streaming response.`,
            file.ref.fileId
          );
          resolve();
        }
      }, 250);
    });
  };

  const renameFile = (file: CloudFile, newName: string) => {
    const opId = Date.now();
    setPendingOperations((prev) => [
      {
        id: opId,
        accountId: file.ref.accountId,
        operation: 'RENAME',
        fileId: file.ref.fileId,
        fileName: newName,
        payload: JSON.stringify({ old: file.name, new: newName }),
        state: 'COMPLETED',
        createdAt: Date.now(),
        lastAttemptAt: Date.now(),
        attemptCount: 1,
        outcomeUncertain: false,
      },
      ...prev,
    ]);

    setFiles((prev) =>
      prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? { ...f, name: newName } : f))
    );

    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile({ ...inspectedFile, name: newName });
    }

    addAuditLog(file.ref.accountId, 'RENAME_FILE', `Renamed file to ${newName}`, file.ref.fileId);
  };

  const moveFile = (file: CloudFile, targetFolderId: string | null) => {
    setFiles((prev) =>
      prev.map((f) =>
        cacheKey(f.ref) === cacheKey(file.ref) ? { ...f, parentFolderId: targetFolderId } : f
      )
    );

    addAuditLog(
      file.ref.accountId,
      'MOVE_FILE',
      `Moved file to folder ${targetFolderId || 'ROOT'}`,
      file.ref.fileId
    );
  };

  const trashFile = (file: CloudFile) => {
    setFiles((prev) =>
      prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? { ...f, isTrashed: true } : f))
    );
    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile({ ...inspectedFile, isTrashed: true });
    }
    addAuditLog(file.ref.accountId, 'TRASH_FILE', `Moved file to Trash`, file.ref.fileId);
  };

  const restoreFile = (file: CloudFile) => {
    setFiles((prev) =>
      prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? { ...f, isTrashed: false } : f))
    );
    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile({ ...inspectedFile, isTrashed: false });
    }
    addAuditLog(file.ref.accountId, 'RESTORE_FILE', `Restored file from Trash`, file.ref.fileId);
  };

  const deletePermanently = (file: CloudFile) => {
    setFiles((prev) => prev.filter((f) => cacheKey(f.ref) !== cacheKey(file.ref)));
    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile(null);
    }
    addAuditLog(
      file.ref.accountId,
      'PERMANENT_DELETE',
      `Permanently deleted file from cloud provider`,
      file.ref.fileId,
      'WARN'
    );
  };

  const toggleStar = (file: CloudFile) => {
    const nextStarred = !file.isStarred;
    setFiles((prev) =>
      prev.map((f) =>
        cacheKey(f.ref) === cacheKey(file.ref) ? { ...f, isStarred: nextStarred } : f
      )
    );
    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile({ ...inspectedFile, isStarred: nextStarred });
    }
    addAuditLog(
      file.ref.accountId,
      'STAR_FILE',
      `${nextStarred ? 'Starred' : 'Unstarred'} file`,
      file.ref.fileId
    );
  };

  const createFolder = (accountId: LocalAccountId, name: string, parentFolderId: string | null) => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) return;

    const folderId = `folder_${Date.now()}`;
    const newFolder: CloudFile = {
      ref: { provider: account.provider, accountId, fileId: folderId },
      name,
      mimeType: 'application/vnd.google-apps.folder',
      sizeBytes: null,
      modifiedTimeMillis: Date.now(),
      isFolder: true,
      parentFolderId,
      isShared: false,
      isOwnedByUser: true,
      isStarred: false,
      isTrashed: false,
    };

    setFiles((prev) => [newFolder, ...prev]);
    addAuditLog(accountId, 'CREATE_FOLDER', `Created folder "${name}" in ${account.badgeLabel}`, folderId);
  };

  const reconcileOperation = (id: number) => {
    setPendingOperations((prev) =>
      prev.map((op) =>
        op.id === id ? { ...op, state: 'COMPLETED', outcomeUncertain: false } : op
      )
    );
  };

  const retryOperation = (id: number) => {
    setPendingOperations((prev) =>
      prev.map((op) =>
        op.id === id ? { ...op, attemptCount: op.attemptCount + 1, lastAttemptAt: Date.now() } : op
      )
    );
  };

  const clearCompletedOperations = () => {
    setPendingOperations((prev) => prev.filter((op) => op.state !== 'COMPLETED'));
  };

  const cancelTransfer = (id: string) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: { status: 'Cancelled' } } : t))
    );
  };

  const clearCompletedTransfers = () => {
    setTransfers((prev) =>
      prev.filter((t) => t.status.status !== 'Completed' && t.status.status !== 'Cancelled')
    );
  };

  const retryTransfer = (id: string) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          bytesTransferred: 0,
          status: { status: 'Running', progress: 5, speedBytesPerSec: 1024 * 1024 * 3.5 },
        };
      })
    );
  };

  const pauseResumeTransfer = (id: string) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.status.status === 'Running') {
          return { ...t, status: { status: 'Paused' } };
        }
        if (t.status.status === 'Paused') {
          const prog = t.totalBytes ? Math.round((t.bytesTransferred / t.totalBytes) * 100) : 50;
          return {
            ...t,
            status: { status: 'Running', progress: prog, speedBytesPerSec: 1024 * 1024 * 4 },
          };
        }
        return t;
      })
    );
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
  };

  const resetAllData = () => {
    localStorage.clear();
    setAccounts(INITIAL_ACCOUNTS);
    setFiles(INITIAL_FILES);
    setCapabilities(INITIAL_CAPABILITIES);
    setQuotas(INITIAL_QUOTA);
    setPendingOperations([]);
    setTransfers([]);
    setAuditLogs([]);
    setCurrentFolderId(null);
    setFolderHistory([]);
    setSelectedFileKeys(new Set());
    setInspectedFile(null);
  };

  const syncAccount = async (accountId: LocalAccountId) => {
    setSyncStatuses((prev) => {
      if (!prev[accountId]) return prev;
      return {
        ...prev,
        [accountId]: {
          ...prev[accountId],
          status: 'syncing',
          errorMessage: undefined,
        },
      };
    });

    await new Promise((res) => setTimeout(res, 850));

    const simulatedLatency = Math.floor(Math.random() * 25) + 28;
    const accFilesCount = files.filter(
      (f) => f.ref.accountId === accountId && !f.isTrashed
    ).length;

    setSyncStatuses((prev) => {
      if (!prev[accountId]) return prev;
      return {
        ...prev,
        [accountId]: {
          ...prev[accountId],
          status: 'synced',
          lastSyncedAt: Date.now(),
          latencyMs: simulatedLatency,
          itemsSynced: accFilesCount,
          errorMessage: undefined,
        },
      };
    });

    addAuditLog(
      accountId,
      'BACKGROUND_SYNC_SUCCESS',
      `Synchronized delta change-tokens (${simulatedLatency}ms latency, ${accFilesCount} items verified)`
    );
  };

  const syncAllAccounts = async () => {
    setSyncStatuses((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        next[id] = { ...next[id], status: 'syncing', errorMessage: undefined };
      });
      return next;
    });

    await new Promise((res) => setTimeout(res, 1100));

    const now = Date.now();
    setSyncStatuses((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        const count = files.filter(
          (f) => f.ref.accountId === id && !f.isTrashed
        ).length;
        next[id] = {
          ...next[id],
          status: 'synced',
          lastSyncedAt: now,
          latencyMs: Math.floor(Math.random() * 30) + 25,
          itemsSynced: count,
          errorMessage: undefined,
        };
      });
      return next;
    });

    addAuditLog(
      1,
      'GLOBAL_SYNC_SUCCESS',
      'Completed parallel background delta synchronization across all connected cloud providers.'
    );
  };

  const simulateProviderIssue = (
    accountId: LocalAccountId,
    issueType: 'none' | 'error' | 'warning'
  ) => {
    setSyncStatuses((prev) => {
      if (!prev[accountId]) return prev;
      if (issueType === 'none') {
        return {
          ...prev,
          [accountId]: {
            ...prev[accountId],
            status: 'synced',
            errorMessage: undefined,
          },
        };
      } else if (issueType === 'warning') {
        return {
          ...prev,
          [accountId]: {
            ...prev[accountId],
            status: 'warning',
            errorMessage: 'Rate limit ceiling approached (429 Backoff Active)',
          },
        };
      } else {
        return {
          ...prev,
          [accountId]: {
            ...prev[accountId],
            status: 'error',
            errorMessage: 'OAuth token refresh expired or remote endpoint unreachable',
          },
        };
      }
    });

    addAuditLog(
      accountId,
      issueType === 'none' ? 'CONNECTION_RESTORED' : 'CONNECTION_ALERT',
      issueType === 'none'
        ? 'Connection restored to healthy state.'
        : `Diagnostic simulation: provider status marked as ${issueType}`,
      undefined,
      issueType === 'error' ? 'ERROR' : issueType === 'warning' ? 'WARN' : 'INFO'
    );
  };

  return (
    <FileManagerContext.Provider
      value={{
        accounts,
        activeAccountId,
        setActiveAccountId,
        activeProvider,
        setActiveProvider,
        files,
        currentTab,
        setCurrentTab,
        currentFolderId,
        setCurrentFolderId,
        folderHistory,
        navigateToFolder,
        navigateBack,
        searchQuery,
        setSearchQuery,
        viewMode,
        setViewMode,
        sortBy,
        setSortBy,
        filterOption,
        setFilterOption,
        selectedFileKeys,
        toggleSelectFile,
        selectAllFiles,
        clearSelection,
        inspectedFile,
        setInspectedFile,
        isMobilePreview,
        setIsMobilePreview,
        connectAccount,
        disconnectAccount,
        reconnectAccount,
        uploadFile,
        downloadFile,
        renameFile,
        moveFile,
        trashFile,
        restoreFile,
        deletePermanently,
        toggleStar,
        createFolder,
        capabilities,
        quotas,
        quotaSnapshot,
        refreshQuotaSnapshot,
        pendingOperations,
        reconcileOperation,
        retryOperation,
        clearCompletedOperations,
        transfers,
        cancelTransfer,
        clearCompletedTransfers,
        retryTransfer,
        pauseResumeTransfer,
        syncStatuses,
        syncAccount,
        syncAllAccounts,
        simulateProviderIssue,
        auditLogs,
        addAuditLog,
        clearAuditLogs,
        resetAllData,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};

export const useFileManager = () => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error('useFileManager must be used within a FileManagerProvider');
  }
  return context;
};
