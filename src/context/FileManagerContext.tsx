import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { auth as firebaseAuth } from '../firebase';
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
  cacheKey,
} from '../types';
import { globalQuotaGovernor } from '../utils/quotaGovernor';
import { Redactor } from '../utils/redactor';
import {
  cloneFolderHierarchyRecursively,
  collectDescendantFileKeys,
  computeTransferProgress,
  createEntityId,
  createMonotonicIdAllocator,
  isDuplicateProviderAccount,
  wouldMoveCreateFolderCycle,
} from '../utils/fileManagerLogic';
import {
  buildCapabilitiesForProvider,
  cloudProviderService,
  VerifiedProviderAccount,
} from '../services/cloudProviderService';
import { offlineCacheService, OfflineCacheStats } from '../services/offlineCacheService';
import { useAuth } from './AuthContext';
import { databaseService } from '../services/databaseService';

export type NavigationTab =
  | 'dashboard'
  | 'accounts'
  | 'security'
  | 'security_policies'
  | 'files'
  | 'gallery'
  | 'search'
  | 'starred'
  | 'recent'
  | 'trash'
  | 'quotas'
  | 'operations'
  | 'offline'
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

interface TransferJobSource {
  direction: 'UPLOAD' | 'DOWNLOAD';
  accountId: LocalAccountId;
  folderId: string | null;
  uploadFileObj?: File;
  cloudFile?: CloudFile;
}

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

  inspectedFile: CloudFile | null;
  setInspectedFile: (file: CloudFile | null) => void;

  isMobilePreview: boolean;
  setIsMobilePreview: (val: boolean) => void;

  connectAccount: (
    provider: ProviderId,
    email: string,
    displayName: string,
    badgeLabel: string,
    scopes: string[],
    verifiedAccount?: VerifiedProviderAccount
  ) => void;
  connectAccountWithOAuth: (
    provider: ProviderId,
    badgeLabel: string,
    scopes: string[],
    explicitAccessToken?: string
  ) => Promise<AccountRef>;
  disconnectAccount: (accountId: LocalAccountId) => void;
  reconnectAccount: (accountId: LocalAccountId) => void;

  uploadFile: (accountId: LocalAccountId, folderId: string | null, file: File) => Promise<void>;
  downloadFile: (file: CloudFile) => Promise<void>;
  renameFile: (file: CloudFile, newName: string) => void;
  moveFile: (file: CloudFile, targetFolderId: string | null) => void;
  trashFile: (file: CloudFile) => void;
  restoreFile: (file: CloudFile) => void;
  deletePermanently: (file: CloudFile) => void;
  toggleStar: (file: CloudFile) => void;
  toggleOffline: (file: CloudFile) => void;
  copyFile: (file: CloudFile, targetFolderId?: string | null) => void;
  createFolder: (accountId: LocalAccountId, name: string, parentFolderId: string | null) => void;

  offlineCacheStats: OfflineCacheStats;
  evictOfflineCache: () => Promise<void>;

  capabilities: Record<number, ProviderCapabilities>;
  quotas: Record<number, QuotaUsage>;
  quotaSnapshot: QuotaSnapshot;
  refreshQuotaSnapshot: () => void;

  pendingOperations: PendingOperation[];
  reconcileOperation: (id: number) => void;
  retryOperation: (id: number) => void;
  clearCompletedOperations: () => void;
  transfers: TransferItem[];
  cancelTransfer: (id: string) => void;
  clearCompletedTransfers: () => void;
  retryTransfer: (id: string) => void;
  pauseResumeTransfer: (id: string) => void;

  syncStatuses: Record<LocalAccountId, ProviderSyncStatus>;
  syncAccount: (accountId: LocalAccountId) => Promise<void>;
  syncAllAccounts: () => Promise<void>;

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
  loadSampleWorkspace: () => void;
}

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

function safePersistFirestore(fn: () => Promise<void>, label: string): void {
  if (!firebaseAuth.currentUser?.uid) return;
  void fn().catch((err) => {
    console.warn(`Firestore ${label} warning:`, err);
  });
}

export const FileManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  function safeGetItem<T>(key: string, fallback: T): T {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return fallback;
      return JSON.parse(saved) as T;
    } catch (e) {
      console.warn(`Failed to parse ${key} from storage, falling back to default:`, e);
      return fallback;
    }
  }

  function safeSetItem(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to sync ${key} to localStorage:`, e);
    }
  }

  const auth = useAuth();
  const userId = auth?.user?.id || 'guest_user';

  const accountsKey = `ucfm_accounts_v2_${userId}`;
  const filesKey = `ucfm_files_v2_${userId}`;
  const capabilitiesKey = `ucfm_capabilities_v2_${userId}`;
  const quotasKey = `ucfm_quotas_v2_${userId}`;
  const pendingOpsKey = `ucfm_pending_ops_v2_${userId}`;
  const auditLogsKey = `ucfm_audit_logs_v2_${userId}`;

  const defaultAccounts: AccountRef[] = [];
  const defaultFiles: CloudFile[] = [];
  const defaultCapabilities: Record<number, ProviderCapabilities> = {};
  const defaultQuotas: Record<number, QuotaUsage> = {};

  const [accounts, setAccounts] = useState<AccountRef[]>(() =>
    safeGetItem(accountsKey, defaultAccounts)
  );
  const [files, setFiles] = useState<CloudFile[]>(() => safeGetItem(filesKey, defaultFiles));
  const [capabilities, setCapabilities] = useState<Record<number, ProviderCapabilities>>(() =>
    safeGetItem(capabilitiesKey, defaultCapabilities)
  );
  const [quotas, setQuotas] = useState<Record<number, QuotaUsage>>(() =>
    safeGetItem(quotasKey, defaultQuotas)
  );
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>(() =>
    safeGetItem(pendingOpsKey, [])
  );
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    safeGetItem(auditLogsKey, [])
  );
  const [offlineCacheStats, setOfflineCacheStats] = useState<OfflineCacheStats>({
    pinnedCount: 0,
    totalBytes: 0,
    entriesByKey: {},
  });

  const transferAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const transferSourcesRef = useRef<Map<string, TransferJobSource>>(new Map());
  const opAllocatorRef = useRef<() => number>(
    createMonotonicIdAllocator(
      pendingOperations.reduce((max, op) => Math.max(max, op.id), 0)
    )
  );

  const allocateOpId = useCallback((): number => {
    return opAllocatorRef.current();
  }, []);

  const refreshOfflineStats = async () => {
    const stats = await offlineCacheService.getStats();
    setOfflineCacheStats(stats);
  };

  useEffect(() => {
    void refreshOfflineStats();
  }, []);

  useEffect(() => {
    const localAccs = safeGetItem(accountsKey, defaultAccounts);
    const localFiles = safeGetItem(filesKey, defaultFiles);
    const localQuotas = safeGetItem(quotasKey, defaultQuotas);
    const localOps = safeGetItem<PendingOperation[]>(pendingOpsKey, []);

    opAllocatorRef.current = createMonotonicIdAllocator(
      localOps.reduce((max, op) => Math.max(max, op.id), 0)
    );

    setAccounts(localAccs);
    setFiles(localFiles);
    setCapabilities(safeGetItem(capabilitiesKey, defaultCapabilities));
    setQuotas(localQuotas);
    setPendingOperations(localOps);
    setAuditLogs(safeGetItem(auditLogsKey, []));
    setCurrentFolderId(null);
    setFolderHistory([]);
    setSelectedFileKeys(new Set());
    setInspectedFile(null);

    if (userId !== 'guest_user' && firebaseAuth.currentUser?.uid === userId) {
      void (async () => {
        const remote = await databaseService.loadUserWorkspace();
        if (remote) {
          if (remote.accounts && remote.accounts.length > 0) setAccounts(remote.accounts);
          if (remote.files && remote.files.length > 0) setFiles(remote.files);
          if (remote.quotas && Object.keys(remote.quotas).length > 0) setQuotas(remote.quotas);
          if (remote.operations && remote.operations.length > 0) {
            opAllocatorRef.current = createMonotonicIdAllocator(
              remote.operations.reduce((max, op) => Math.max(max, op.id), 0)
            );
            setPendingOperations(remote.operations);
          }
          if (remote.auditLogs && remote.auditLogs.length > 0) setAuditLogs(remote.auditLogs);
          if (!remote.accounts && localAccs.length > 0) {
            safePersistFirestore(
              () => databaseService.seedWorkspaceIfEmpty(localAccs, localFiles, localQuotas),
              'seedWorkspaceIfEmpty'
            );
          }
        }
      })();
    }
  }, [userId]);

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

  const [quotaSnapshot, setQuotaSnapshot] = useState<QuotaSnapshot>(() =>
    globalQuotaGovernor.snapshot()
  );

  const refreshQuotaSnapshot = () => {
    setQuotaSnapshot(globalQuotaGovernor.snapshot());
  };

  useEffect(() => {
    safeSetItem(accountsKey, accounts);
  }, [accounts, accountsKey]);

  useEffect(() => {
    safeSetItem(filesKey, files);
  }, [files, filesKey]);

  useEffect(() => {
    safeSetItem(capabilitiesKey, capabilities);
  }, [capabilities, capabilitiesKey]);

  useEffect(() => {
    safeSetItem(quotasKey, quotas);
  }, [quotas, quotasKey]);

  useEffect(() => {
    safeSetItem(pendingOpsKey, pendingOperations);
  }, [pendingOperations, pendingOpsKey]);

  useEffect(() => {
    safeSetItem(auditLogsKey, auditLogs);
  }, [auditLogs, auditLogsKey]);

  const [syncStatuses, setSyncStatuses] = useState<Record<LocalAccountId, ProviderSyncStatus>>(
    () => {
      const saved = localStorage.getItem('ucfm_sync_statuses_v2');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
      return {};
    }
  );

  useEffect(() => {
    localStorage.setItem('ucfm_sync_statuses_v2', JSON.stringify(syncStatuses));
  }, [syncStatuses]);

  const addAuditLog = useCallback(
    (
      accountId: LocalAccountId,
      action: string,
      rawMessage: string,
      fileId?: string,
      severity: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
    ) => {
      const redacted = Redactor.scrub(rawMessage);
      const correlationTag = fileId ? Redactor.fileRefTag(accountId, fileId) : '000000000000';

      const entry: AuditLogEntry = {
        id: createEntityId('log'),
        timestamp: Date.now(),
        accountId,
        action,
        rawMessage,
        redactedMessage: redacted,
        correlationTag,
        severity,
      };

      setAuditLogs((prev) => [entry, ...prev.slice(0, 99)]);
      safePersistFirestore(() => databaseService.saveAuditLog(entry), 'saveAuditLog');
    },
    []
  );

  const refreshLiveQuotaForAccount = useCallback(async (account: AccountRef) => {
    if (!cloudProviderService.hasLiveToken(account.localId)) return;
    try {
      const liveQuota = await cloudProviderService.fetchLiveQuota(account);
      if (liveQuota) {
        setQuotas((prev) => ({ ...prev, [account.localId]: liveQuota }));
        safePersistFirestore(() => databaseService.saveQuota(liveQuota), 'saveQuota');
      }
    } catch (err) {
      console.warn('Live quota refresh warning:', err);
    }
  }, []);

  const executeQueuedRemoteOperation = useCallback(
    async (op: PendingOperation) => {
      const account = accounts.find((a) => a.localId === op.accountId);
      if (!account) {
        setPendingOperations((prev) =>
          prev.map((item) =>
            item.id === op.id
              ? { ...item, state: 'FAILED', error: 'Connected account no longer exists.' }
              : item
          )
        );
        return;
      }

      setPendingOperations((prev) =>
        prev.map((item) =>
          item.id === op.id
            ? {
                ...item,
                state: 'RUNNING',
                attemptCount: item.attemptCount + 1,
                lastAttemptAt: Date.now(),
                error: undefined,
              }
            : item
        )
      );

      let parsedPayload: Record<string, unknown> = {};
      if (op.payload) {
        try {
          parsedPayload = JSON.parse(op.payload) as Record<string, unknown>;
        } catch {
          parsedPayload = {};
        }
      }

      try {
        if (op.operation === 'UPLOAD') {
          const matchingTransfer = Array.from(transferSourcesRef.current.entries()).find(
            ([, src]) =>
              src.direction === 'UPLOAD' &&
              src.accountId === op.accountId &&
              src.uploadFileObj &&
              (!op.fileName || src.uploadFileObj.name === op.fileName)
          );
          if (!matchingTransfer?.[1].uploadFileObj) {
            throw new Error('Original local file handle unavailable after restart; select file to re-upload.');
          }
          await cloudProviderService.streamUploadBytes(
            account,
            matchingTransfer[1].folderId,
            matchingTransfer[1].uploadFileObj,
            new AbortController().signal,
            () => {}
          );
        } else if (op.operation === 'DELETE_PERMANENTLY') {
          const target = files.find(
            (f) => f.ref.accountId === op.accountId && f.ref.fileId === op.fileId
          ) || {
            ref: {
              provider: account.provider,
              accountId: account.localId,
              fileId: op.fileId || '',
            },
            name: op.fileName || 'item',
            mimeType: 'application/octet-stream',
            sizeBytes: null,
            modifiedTimeMillis: Date.now(),
            isFolder: false,
            parentFolderId: null,
            isShared: false,
            isOwnedByUser: true,
            isStarred: false,
            isTrashed: true,
          };
          await cloudProviderService.deleteRemotePermanently(account, target);
        } else {
          await cloudProviderService.executeRemoteMutation(account, {
            operation: op.operation,
            fileId: op.fileId,
            name:
              typeof parsedPayload.new === 'string'
                ? parsedPayload.new
                : typeof parsedPayload.name === 'string'
                ? parsedPayload.name
                : op.fileName,
            targetFolderId:
              typeof parsedPayload.targetFolderId === 'string'
                ? parsedPayload.targetFolderId
                : typeof parsedPayload.folderId === 'string'
                ? parsedPayload.folderId
                : null,
          });
        }

        const completed: PendingOperation = {
          ...op,
          state: 'COMPLETED',
          attemptCount: op.attemptCount + 1,
          lastAttemptAt: Date.now(),
          outcomeUncertain: false,
          error: undefined,
        };
        setPendingOperations((prev) =>
          prev.map((item) => (item.id === op.id ? completed : item))
        );
        offlineCacheService.markNativeOperationState(op.id, 'COMPLETED');
        safePersistFirestore(() => databaseService.saveOperation(completed), 'saveOperation');
        addAuditLog(
          op.accountId,
          'OPERATION_COMPLETED',
          `Executed remote operation ${op.operation} for ${op.fileName || op.fileId || 'item'}.`,
          op.fileId || undefined
        );
        void refreshLiveQuotaForAccount(account);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Remote operation failed';
        const failed: PendingOperation = {
          ...op,
          state: 'FAILED',
          attemptCount: op.attemptCount + 1,
          lastAttemptAt: Date.now(),
          outcomeUncertain: true,
          error: msg,
        };
        setPendingOperations((prev) => prev.map((item) => (item.id === op.id ? failed : item)));
        offlineCacheService.markNativeOperationState(op.id, 'FAILED');
        safePersistFirestore(() => databaseService.saveOperation(failed), 'saveOperation');
        addAuditLog(
          op.accountId,
          'OPERATION_FAILED',
          `Operation ${op.operation} failed: ${msg}`,
          op.fileId || undefined,
          'ERROR'
        );
      }
    },
    [accounts, files, addAuditLog, refreshLiveQuotaForAccount]
  );

  // Replay queued offline operations when network reconnects
  useEffect(() => {
    const handleOnline = () => {
      const queued = pendingOperations.filter((op) => op.state === 'QUEUED');
      queued.forEach((op) => {
        void executeQueuedRemoteOperation(op);
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [pendingOperations, executeQueuedRemoteOperation]);

  // Complete Chrome Custom Tabs / OAuth redirect callback if returning to app
  useEffect(() => {
    const checkCallback = async () => {
      try {
        const completed = await cloudProviderService.completePendingOAuthCallback();
        if (!completed) return;
        const { account: verified, badgeLabel } = completed;
        setAccounts((prev) => {
          if (
            isDuplicateProviderAccount(
              prev,
              verified.provider,
              verified.displayEmail,
              verified.providerAccountId
            )
          ) {
            return prev;
          }
          const newId = (prev.reduce((max, a) => Math.max(max, a.localId), 0) + 1) as LocalAccountId;
          const providerMeta = PROVIDERS[verified.provider];
          const newAccount: AccountRef = {
            localId: newId,
            provider: verified.provider,
            providerAccountId: verified.providerAccountId,
            displayEmail: verified.displayEmail,
            displayName: verified.displayName,
            color: providerMeta.brandColor,
            badgeLabel: badgeLabel || providerMeta.shortName,
            state: AccountState.CONNECTED,
            grantedScopes: verified.grantedScopes,
            lastVerifiedAt: Date.now(),
          };
          cloudProviderService.storeTokenForAccount(newId, {
            accessToken: verified.accessToken,
            refreshToken: verified.refreshToken,
            expiresAtMillis: verified.expiresAtMillis,
            grantedScopes: verified.grantedScopes,
            provider: verified.provider,
            providerAccountId: verified.providerAccountId,
            displayEmail: verified.displayEmail,
          });
          const newQuota: QuotaUsage = {
            providerId: verified.provider,
            accountId: newId,
            usedBytes: verified.quota.usedBytes,
            limitBytes: verified.quota.limitBytes ?? providerMeta.defaultQuotaBytes,
            manageUrl: providerMeta.manageUrl,
          };
          setCapabilities((cPrev) => ({
            ...cPrev,
            [newId]: buildCapabilitiesForProvider(verified.provider, verified.grantedScopes),
          }));
          setQuotas((qPrev) => ({ ...qPrev, [newId]: newQuota }));
          safePersistFirestore(() => databaseService.saveAccount(newAccount, newQuota), 'saveAccount');
          return [...prev, newAccount];
        });
      } catch (err) {
        console.warn('Pending OAuth callback handling warning:', err);
      }
    };

    void checkCallback();
    const onFocus = () => void checkCallback();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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

  const connectAccount = (
    provider: ProviderId,
    email: string,
    displayName: string,
    badgeLabel: string,
    scopes: string[],
    verifiedAccount?: VerifiedProviderAccount
  ) => {
    const resolvedEmail = (verifiedAccount?.displayEmail || email || '').trim();
    if (!resolvedEmail) {
      throw new Error('A verified account email is required to connect a cloud provider.');
    }

    if (
      isDuplicateProviderAccount(
        accounts,
        provider,
        resolvedEmail,
        verifiedAccount?.providerAccountId
      )
    ) {
      throw new Error(
        `This ${PROVIDERS[provider].name} account (${resolvedEmail}) is already connected.`
      );
    }

    const newId = (accounts.reduce((max, a) => Math.max(max, a.localId), 0) + 1) as LocalAccountId;
    const providerMeta = PROVIDERS[provider];
    const traceId = createEntityId('pkce_trace');

    addAuditLog(
      newId,
      'ACCOUNT_CONNECT_START',
      `Connecting ${providerMeta.name} account ${Redactor.maskEmail(resolvedEmail)} (trace: ${traceId})`
    );

    const newAccount: AccountRef = {
      localId: newId,
      provider,
      providerAccountId:
        verifiedAccount?.providerAccountId || createEntityId(`${provider.toLowerCase()}_acct`),
      displayEmail: resolvedEmail,
      displayName: verifiedAccount?.displayName || displayName || resolvedEmail.split('@')[0],
      color: providerMeta.brandColor,
      badgeLabel: badgeLabel || providerMeta.shortName,
      state: AccountState.CONNECTED,
      grantedScopes: verifiedAccount?.grantedScopes || scopes,
      lastVerifiedAt: Date.now(),
    };

    if (verifiedAccount?.accessToken) {
      cloudProviderService.storeTokenForAccount(newId, {
        accessToken: verifiedAccount.accessToken,
        refreshToken: verifiedAccount.refreshToken,
        expiresAtMillis: verifiedAccount.expiresAtMillis,
        grantedScopes: newAccount.grantedScopes,
        provider,
        providerAccountId: newAccount.providerAccountId,
        displayEmail: newAccount.displayEmail,
      });
    }

    const newQuota: QuotaUsage = {
      providerId: provider,
      accountId: newId,
      usedBytes: verifiedAccount ? verifiedAccount.quota.usedBytes : 0,
      limitBytes: verifiedAccount
        ? verifiedAccount.quota.limitBytes
        : providerMeta.defaultQuotaBytes,
      manageUrl: providerMeta.manageUrl,
    };

    const computedCapabilities = buildCapabilitiesForProvider(provider, newAccount.grantedScopes);

    setAccounts((prev) => [...prev, newAccount]);
    setCapabilities((prev) => ({
      ...prev,
      [newId]: computedCapabilities,
    }));
    setQuotas((prev) => ({
      ...prev,
      [newId]: newQuota,
    }));
    setSyncStatuses((prev) => ({
      ...prev,
      [newId]: {
        provider,
        accountId: newId,
        status: 'synced',
        lastSyncedAt: Date.now(),
        latencyMs: 0,
        itemsSynced: 0,
        autoSyncIntervalMinutes: 5,
      },
    }));

    safePersistFirestore(() => databaseService.saveAccount(newAccount, newQuota), 'saveAccount');

    addAuditLog(
      newId,
      'ACCOUNT_CONNECTED',
      `Account verified for ${providerMeta.name}. State: CONNECTED.`
    );
  };

  const connectAccountWithOAuth = async (
    provider: ProviderId,
    badgeLabel: string,
    scopes: string[],
    explicitAccessToken?: string
  ): Promise<AccountRef> => {
    const verified = await cloudProviderService.authorizeAndVerifyAccount(
      provider,
      scopes,
      explicitAccessToken,
      badgeLabel
    );

    if (
      isDuplicateProviderAccount(
        accounts,
        provider,
        verified.displayEmail,
        verified.providerAccountId
      )
    ) {
      throw new Error(
        `This ${PROVIDERS[provider].name} account (${verified.displayEmail}) is already connected.`
      );
    }

    const newId = (accounts.reduce((max, a) => Math.max(max, a.localId), 0) + 1) as LocalAccountId;
    const providerMeta = PROVIDERS[provider];
    const newAccount: AccountRef = {
      localId: newId,
      provider,
      providerAccountId: verified.providerAccountId,
      displayEmail: verified.displayEmail,
      displayName: verified.displayName,
      color: providerMeta.brandColor,
      badgeLabel: badgeLabel || providerMeta.shortName,
      state: AccountState.CONNECTED,
      grantedScopes: verified.grantedScopes,
      lastVerifiedAt: Date.now(),
    };

    cloudProviderService.storeTokenForAccount(newId, {
      accessToken: verified.accessToken,
      refreshToken: verified.refreshToken,
      expiresAtMillis: verified.expiresAtMillis,
      grantedScopes: verified.grantedScopes,
      provider,
      providerAccountId: verified.providerAccountId,
      displayEmail: verified.displayEmail,
    });

    const newQuota: QuotaUsage = {
      providerId: provider,
      accountId: newId,
      usedBytes: verified.quota.usedBytes,
      limitBytes: verified.quota.limitBytes ?? providerMeta.defaultQuotaBytes,
      manageUrl: providerMeta.manageUrl,
    };

    const computedCapabilities = buildCapabilitiesForProvider(provider, verified.grantedScopes);

    setAccounts((prev) => [...prev, newAccount]);
    setCapabilities((prev) => ({ ...prev, [newId]: computedCapabilities }));
    setQuotas((prev) => ({ ...prev, [newId]: newQuota }));

    try {
      const remoteFiles = await cloudProviderService.listRemoteFiles(newAccount, null);
      if (remoteFiles && remoteFiles.length > 0) {
        setFiles((prev) => [
          ...remoteFiles,
          ...prev.filter((f) => f.ref.accountId !== newId),
        ]);
        remoteFiles.forEach((f) =>
          safePersistFirestore(() => databaseService.saveFile(f), 'saveFile')
        );
      }
      setSyncStatuses((prev) => ({
        ...prev,
        [newId]: {
          provider,
          accountId: newId,
          status: 'synced',
          lastSyncedAt: Date.now(),
          latencyMs: 1,
          itemsSynced: remoteFiles?.length ?? 0,
          autoSyncIntervalMinutes: 5,
        },
      }));
    } catch (listErr) {
      console.warn('Initial file listing warning:', listErr);
    }

    safePersistFirestore(() => databaseService.saveAccount(newAccount, newQuota), 'saveAccount');
    addAuditLog(
      newId,
      'ACCOUNT_CONNECTED',
      `Live OAuth 2.0 verification succeeded for ${providerMeta.name} (${Redactor.maskEmail(
        verified.displayEmail
      )}).`
    );

    return newAccount;
  };

  const disconnectAccount = (accountId: LocalAccountId) => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) return;

    addAuditLog(
      accountId,
      'ACCOUNT_DISCONNECTED',
      `Disconnect requested for ${Redactor.maskEmail(
        account.displayEmail
      )}. Cancelling active transfers, revoking OAuth tokens, and purging cached files.`
    );

    setTransfers((prev) => {
      prev.forEach((t) => {
        if (t.ref.accountId === accountId) {
          const controller = transferAbortControllersRef.current.get(t.id);
          controller?.abort();
          transferAbortControllersRef.current.delete(t.id);
          transferSourcesRef.current.delete(t.id);
        }
      });
      return prev.filter((t) => t.ref.accountId !== accountId);
    });

    setPendingOperations((prev) => prev.filter((op) => op.accountId !== accountId));

    void offlineCacheService.purgeAccountCache(accountId).then(() => refreshOfflineStats());
    void cloudProviderService.revokeAccountToken(account);

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
    setSyncStatuses((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    setAccounts((prev) => prev.filter((a) => a.localId !== accountId));
    safePersistFirestore(() => databaseService.removeAccount(accountId), 'removeAccount');

    if (inspectedFile?.ref.accountId === accountId) {
      setInspectedFile(null);
    }
    if (activeAccountId === accountId) {
      setActiveAccountId('ALL');
    }
  };

  const reconnectAccount = (accountId: LocalAccountId) => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) return;
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.localId !== accountId) return a;
        const updated = { ...a, state: AccountState.CONNECTED, lastVerifiedAt: Date.now() };
        safePersistFirestore(() => databaseService.saveAccount(updated), 'saveAccount');
        return updated;
      })
    );
    void syncAccount(accountId);
    addAuditLog(accountId, 'ACCOUNT_REAUTH', `Reauthorization verified. State: CONNECTED.`);
  };

  const executeUploadTransfer = async (
    transferId: string,
    opId: number,
    account: AccountRef,
    folderId: string | null,
    file: File,
    existingFileRef?: FileRef
  ): Promise<void> => {
    const accountId = account.localId;
    const fileId = existingFileRef?.fileId || createEntityId('file_upload');
    const fileRef: FileRef = existingFileRef || {
      provider: account.provider,
      accountId,
      fileId,
    };

    const controller = new AbortController();
    transferAbortControllersRef.current.set(transferId, controller);
    transferSourcesRef.current.set(transferId, {
      direction: 'UPLOAD',
      accountId,
      folderId,
      uploadFileObj: file,
    });

    const admission = await globalQuotaGovernor.acquireQueued(accountId);
    refreshQuotaSnapshot();

    if (!admission.granted) {
      const errMsg = `Upload throttled by Quota Governor (${admission.reason}).`;
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId ? { ...t, status: { status: 'Failed', error: errMsg } } : t
        )
      );
      setPendingOperations((prev) =>
        prev.map((op) => (op.id === opId ? { ...op, state: 'FAILED', error: errMsg } : op))
      );
      addAuditLog(accountId, 'QUOTA_GOVERNOR_REFUSED', errMsg, fileId, 'WARN');
      throw new Error(errMsg);
    }

    try {
      let thumbnailLink: string | undefined;
      let previewText: string | undefined;

      if (file.type.startsWith('image/')) {
        thumbnailLink = URL.createObjectURL(file);
      } else if (
        file.type.includes('text') ||
        file.type.includes('json') ||
        file.type.includes('csv')
      ) {
        try {
          previewText = await file.slice(0, 2000).text();
        } catch {
          // ignore
        }
      }

      const uploadRes = await cloudProviderService.streamUploadBytes(
        account,
        folderId,
        file,
        controller.signal,
        (transferred, total, speed) => {
          const progress = computeTransferProgress(transferred, total);
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === transferId
                ? {
                    ...t,
                    bytesTransferred: transferred,
                    status:
                      progress >= 100
                        ? { status: 'Completed' }
                        : { status: 'Running', progress, speedBytesPerSec: speed },
                  }
                : t
            )
          );
        }
      );

      const finalFileId = uploadRes.remoteId || fileId;
      const finalRef: FileRef = {
        provider: account.provider,
        accountId,
        fileId: finalFileId,
      };

      const newCloudFile: CloudFile = {
        ref: finalRef,
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
        webViewLink: uploadRes.webViewLink,
        thumbnailLink,
        previewText,
      };

      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? {
                ...t,
                ref: finalRef,
                bytesTransferred: file.size,
                status: { status: 'Completed' },
              }
            : t
        )
      );

      const completedOp: PendingOperation = {
        id: opId,
        accountId,
        operation: 'UPLOAD',
        fileId: finalFileId,
        fileName: file.name,
        payload: JSON.stringify({ size: file.size, folderId }),
        state: 'COMPLETED',
        createdAt: Date.now(),
        lastAttemptAt: Date.now(),
        attemptCount: 1,
        outcomeUncertain: false,
      };

      setFiles((prev) => [newCloudFile, ...prev]);
      setPendingOperations((prev) => prev.map((op) => (op.id === opId ? completedOp : op)));

      safePersistFirestore(() => databaseService.saveFile(newCloudFile), 'saveFile');
      safePersistFirestore(() => databaseService.saveOperation(completedOp), 'saveOperation');
      offlineCacheService.markNativeOperationState(opId, 'COMPLETED');

      void refreshLiveQuotaForAccount(account);

      addAuditLog(
        accountId,
        'UPLOAD_COMPLETED',
        `Direct upload completed: ${file.name} (${file.size} bytes) to ${account.badgeLabel}.`,
        finalFileId
      );
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'Upload failed';
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId ? { ...t, status: { status: 'Failed', error: errMsg } } : t
        )
      );
      setPendingOperations((prev) =>
        prev.map((op) => (op.id === opId ? { ...op, state: 'FAILED', error: errMsg } : op))
      );
      offlineCacheService.markNativeOperationState(opId, 'FAILED');
      addAuditLog(accountId, 'UPLOAD_FAILED', `Upload failed for ${file.name}: ${errMsg}`, fileId, 'ERROR');
      throw err;
    } finally {
      transferAbortControllersRef.current.delete(transferId);
      globalQuotaGovernor.release(accountId);
      refreshQuotaSnapshot();
    }
  };

  const uploadFile = async (
    accountId: LocalAccountId,
    folderId: string | null,
    file: File
  ): Promise<void> => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) throw new Error('Account not found');

    const transferId = createEntityId('xfer_up');
    const fileId = createEntityId('file_upload');
    const fileRef: FileRef = {
      provider: account.provider,
      accountId,
      fileId,
    };

    const opId = allocateOpId();
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const newOp: PendingOperation = {
      id: opId,
      accountId,
      operation: 'UPLOAD',
      fileId,
      fileName: file.name,
      payload: JSON.stringify({ size: file.size, folderId }),
      state: isOffline ? 'QUEUED' : 'RUNNING',
      createdAt: Date.now(),
      lastAttemptAt: Date.now(),
      attemptCount: 1,
      outcomeUncertain: false,
    };

    setPendingOperations((prev) => [newOp, ...prev]);

    const initialProgress = computeTransferProgress(0, file.size);
    const transferItem: TransferItem = {
      id: transferId,
      ref: fileRef,
      fileName: file.name,
      direction: 'UPLOAD',
      bytesTransferred: 0,
      totalBytes: file.size,
      status: {
        status: file.size === 0 ? 'Completed' : 'Running',
        progress: initialProgress,
        speedBytesPerSec: 0,
      },
      startedAt: Date.now(),
    };
    setTransfers((prev) => [transferItem, ...prev]);

    if (isOffline) {
      transferSourcesRef.current.set(transferId, {
        direction: 'UPLOAD',
        accountId,
        folderId,
        uploadFileObj: file,
      });
      offlineCacheService.enqueueNativeOperation(
        accountId,
        account.provider,
        'UPLOAD',
        fileId,
        newOp.payload
      );
      safePersistFirestore(() => databaseService.saveOperation(newOp), 'saveOperation');
      addAuditLog(
        accountId,
        'UPLOAD_QUEUED',
        `Network offline; queued upload ${file.name} for replay on reconnect.`,
        fileId,
        'WARN'
      );
      return;
    }

    await executeUploadTransfer(transferId, opId, account, folderId, file, fileRef);
  };

  const downloadFile = async (file: CloudFile): Promise<void> => {
    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const transferId = createEntityId('xfer_down');
    const controller = new AbortController();
    transferAbortControllersRef.current.set(transferId, controller);
    transferSourcesRef.current.set(transferId, {
      direction: 'DOWNLOAD',
      accountId: file.ref.accountId,
      folderId: file.parentFolderId,
      cloudFile: file,
    });

    const totalBytes = file.sizeBytes ?? 0;
    const transferItem: TransferItem = {
      id: transferId,
      ref: file.ref,
      fileName: file.name,
      direction: 'DOWNLOAD',
      bytesTransferred: 0,
      totalBytes,
      status: { status: 'Running', progress: 0, speedBytesPerSec: 0 },
      startedAt: Date.now(),
    };
    setTransfers((prev) => [transferItem, ...prev]);

    const admission = await globalQuotaGovernor.acquireQueued(file.ref.accountId);
    refreshQuotaSnapshot();

    if (!admission.granted) {
      const errMsg = `Download throttled by Quota Governor (${admission.reason})`;
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId ? { ...t, status: { status: 'Failed', error: errMsg } } : t
        )
      );
      addAuditLog(file.ref.accountId, 'QUOTA_GOVERNOR_REFUSED', errMsg, file.ref.fileId, 'WARN');
      throw new Error(errMsg);
    }

    try {
      let blob: Blob;
      const pinnedBytes = await offlineCacheService.getPinnedBytes(file.ref);
      if (pinnedBytes) {
        blob = new Blob([pinnedBytes], { type: file.mimeType || 'application/octet-stream' });
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? {
                  ...t,
                  bytesTransferred: pinnedBytes.byteLength,
                  totalBytes: pinnedBytes.byteLength,
                  status: { status: 'Completed' },
                }
              : t
          )
        );
      } else {
        blob = await cloudProviderService.streamDownloadBytes(
          account,
          file,
          controller.signal,
          (received, total, speed) => {
            const progress = computeTransferProgress(received, total);
            setTransfers((prev) =>
              prev.map((t) =>
                t.id === transferId
                  ? {
                      ...t,
                      bytesTransferred: received,
                      totalBytes: total,
                      status:
                        progress >= 100
                          ? { status: 'Completed' }
                          : { status: 'Running', progress, speedBytesPerSec: speed },
                    }
                  : t
              )
            );
          }
        );
      }

      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? {
                ...t,
                bytesTransferred: blob.size,
                totalBytes: blob.size,
                status: { status: 'Completed' },
              }
            : t
        )
      );

      const savedNatively = await offlineCacheService.saveBlobToDownloads(
        file.name,
        file.mimeType,
        blob
      );
      if (!savedNatively) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      addAuditLog(
        file.ref.accountId,
        'DOWNLOAD_COMPLETED',
        `Downloaded ${file.name} (${blob.size} bytes).`,
        file.ref.fileId
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'Download failed';
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId ? { ...t, status: { status: 'Failed', error: errMsg } } : t
        )
      );
      addAuditLog(
        file.ref.accountId,
        'DOWNLOAD_FAILED',
        `Download failed for ${file.name}: ${errMsg}`,
        file.ref.fileId,
        'ERROR'
      );
      throw err;
    } finally {
      transferAbortControllersRef.current.delete(transferId);
      globalQuotaGovernor.release(file.ref.accountId);
      refreshQuotaSnapshot();
    }
  };

  const dispatchMutationOperation = (
    account: AccountRef | undefined,
    operation: PendingOperation['operation'],
    fileId: string | null,
    fileName: string,
    payloadObj: Record<string, unknown>,
    remoteCall: () => Promise<void>
  ) => {
    const opId = allocateOpId();
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const payload = JSON.stringify(payloadObj);

    const hasLiveToken = account ? cloudProviderService.hasLiveToken(account.localId) : false;
    const initialOp: PendingOperation = {
      id: opId,
      accountId: account?.localId ?? 0,
      operation,
      fileId,
      fileName,
      payload,
      state: isOffline ? 'QUEUED' : hasLiveToken ? 'RUNNING' : 'FAILED',
      createdAt: Date.now(),
      lastAttemptAt: Date.now(),
      attemptCount: 1,
      outcomeUncertain: false,
      error:
        !isOffline && !hasLiveToken
          ? `Active OAuth token required for ${operation} sync.`
          : undefined,
    };

    setPendingOperations((prev) => [initialOp, ...prev]);
    if (account) {
      offlineCacheService.enqueueNativeOperation(
        account.localId,
        account.provider,
        operation,
        fileId,
        payload
      );
    }
    safePersistFirestore(() => databaseService.saveOperation(initialOp), 'saveOperation');

    if (isOffline || !account || !hasLiveToken) {
      return;
    }

    void (async () => {
      try {
        await remoteCall();
        const completed: PendingOperation = { ...initialOp, state: 'COMPLETED' };
        setPendingOperations((prev) => prev.map((o) => (o.id === opId ? completed : o)));
        offlineCacheService.markNativeOperationState(opId, 'COMPLETED');
        safePersistFirestore(() => databaseService.saveOperation(completed), 'saveOperation');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `${operation} failed remotely`;
        const failed: PendingOperation = {
          ...initialOp,
          state: 'FAILED',
          outcomeUncertain: true,
          error: msg,
        };
        setPendingOperations((prev) => prev.map((o) => (o.id === opId ? failed : o)));
        offlineCacheService.markNativeOperationState(opId, 'FAILED');
        safePersistFirestore(() => databaseService.saveOperation(failed), 'saveOperation');
        addAuditLog(account.localId, `${operation}_FAILED`, msg, fileId || undefined, 'ERROR');
      }
    })();
  };

  const renameFile = (file: CloudFile, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const updatedFile: CloudFile = {
      ...file,
      name: trimmed,
      modifiedTimeMillis: Date.now(),
    };
    setFiles((prev) =>
      prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? updatedFile : f))
    );
    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile(updatedFile);
    }
    safePersistFirestore(() => databaseService.saveFile(updatedFile), 'saveFile');

    dispatchMutationOperation(
      account,
      'RENAME',
      file.ref.fileId,
      trimmed,
      { old: file.name, new: trimmed },
      async () => {
        if (account) {
          await cloudProviderService.executeRemoteMutation(account, {
            operation: 'RENAME',
            fileId: file.ref.fileId,
            name: trimmed,
          });
        }
      }
    );
    addAuditLog(file.ref.accountId, 'RENAME_FILE', `Renamed file to ${trimmed}`, file.ref.fileId);
  };

  const moveFile = (file: CloudFile, targetFolderId: string | null) => {
    if (
      file.isFolder &&
      wouldMoveCreateFolderCycle(file.ref.fileId, targetFolderId, file.ref.accountId, files)
    ) {
      addAuditLog(
        file.ref.accountId,
        'MOVE_BLOCKED_CYCLE',
        `Blocked moving folder "${file.name}" into itself or one of its descendants.`,
        file.ref.fileId,
        'ERROR'
      );
      throw new Error('Cannot move a folder into itself or one of its descendants.');
    }

    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const updatedFile: CloudFile = {
      ...file,
      parentFolderId: targetFolderId,
      modifiedTimeMillis: Date.now(),
    };
    setFiles((prev) =>
      prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? updatedFile : f))
    );
    safePersistFirestore(() => databaseService.saveFile(updatedFile), 'saveFile');

    dispatchMutationOperation(
      account,
      'MOVE',
      file.ref.fileId,
      file.name,
      { targetFolderId },
      async () => {
        if (account) {
          await cloudProviderService.executeRemoteMutation(account, {
            operation: 'MOVE',
            fileId: file.ref.fileId,
            targetFolderId,
            name: file.name,
          });
        }
      }
    );

    addAuditLog(
      file.ref.accountId,
      'MOVE_FILE',
      `Moved ${file.isFolder ? 'folder' : 'file'} to ${targetFolderId || 'ROOT'}`,
      file.ref.fileId
    );
  };

  const trashFile = (file: CloudFile) => {
    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const affectedKeys = collectDescendantFileKeys(file, files);
    setFiles((prev) =>
      prev.map((f) => {
        if (!affectedKeys.has(cacheKey(f.ref))) return f;
        const updated = { ...f, isTrashed: true, modifiedTimeMillis: Date.now() };
        safePersistFirestore(() => databaseService.saveFile(updated), 'saveFile');
        return updated;
      })
    );
    if (inspectedFile && affectedKeys.has(cacheKey(inspectedFile.ref))) {
      setInspectedFile({ ...inspectedFile, isTrashed: true });
    }
    dispatchMutationOperation(
      account,
      'TRASH',
      file.ref.fileId,
      file.name,
      {},
      async () => {
        if (account) {
          await cloudProviderService.executeRemoteMutation(account, {
            operation: 'TRASH',
            fileId: file.ref.fileId,
          });
        }
      }
    );
    addAuditLog(
      file.ref.accountId,
      'TRASH_FILE',
      `Moved ${affectedKeys.size > 1 ? `folder and ${affectedKeys.size - 1} child items` : 'item'} to Trash`,
      file.ref.fileId
    );
  };

  const restoreFile = (file: CloudFile) => {
    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const affectedKeys = collectDescendantFileKeys(file, files);
    setFiles((prev) =>
      prev.map((f) => {
        if (!affectedKeys.has(cacheKey(f.ref))) return f;
        const updated = { ...f, isTrashed: false, modifiedTimeMillis: Date.now() };
        safePersistFirestore(() => databaseService.saveFile(updated), 'saveFile');
        return updated;
      })
    );
    if (inspectedFile && affectedKeys.has(cacheKey(inspectedFile.ref))) {
      setInspectedFile({ ...inspectedFile, isTrashed: false });
    }
    dispatchMutationOperation(
      account,
      'RESTORE',
      file.ref.fileId,
      file.name,
      {},
      async () => {
        if (account) {
          await cloudProviderService.executeRemoteMutation(account, {
            operation: 'RESTORE',
            fileId: file.ref.fileId,
          });
        }
      }
    );
    addAuditLog(
      file.ref.accountId,
      'RESTORE_FILE',
      `Restored ${affectedKeys.size > 1 ? `folder and ${affectedKeys.size - 1} child items` : 'item'} from Trash`,
      file.ref.fileId
    );
  };

  const deletePermanently = (file: CloudFile) => {
    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const affectedKeys = collectDescendantFileKeys(file, files);
    const deletedFiles = files.filter((f) => affectedKeys.has(cacheKey(f.ref)));
    const freedBytes = deletedFiles.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);

    setFiles((prev) => prev.filter((f) => !affectedKeys.has(cacheKey(f.ref))));
    if (inspectedFile && affectedKeys.has(cacheKey(inspectedFile.ref))) {
      setInspectedFile(null);
    }

    deletedFiles.forEach((f) => {
      safePersistFirestore(() => databaseService.removeFile(f), 'removeFile');
      if (f.isOfflineAvailable) {
        void offlineCacheService.unpinFile(f.ref).then(() => refreshOfflineStats());
      }
    });

    if (account) {
      dispatchMutationOperation(
        account,
        'DELETE_PERMANENTLY',
        file.ref.fileId,
        file.name,
        { freedBytes },
        async () => {
          for (const target of deletedFiles) {
            await cloudProviderService.deleteRemotePermanently(account, target);
          }
          await refreshLiveQuotaForAccount(account);
        }
      );
    }

    if (freedBytes > 0) {
      setQuotas((prev) => {
        const current = prev[file.ref.accountId];
        if (!current) return prev;
        const updatedQuota: QuotaUsage = {
          ...current,
          usedBytes: Math.max(0, current.usedBytes - freedBytes),
        };
        safePersistFirestore(() => databaseService.saveQuota(updatedQuota), 'saveQuota');
        return {
          ...prev,
          [file.ref.accountId]: updatedQuota,
        };
      });
    }

    addAuditLog(
      file.ref.accountId,
      'PERMANENT_DELETE',
      `Permanently deleted ${deletedFiles.length} item(s) (${freedBytes} bytes freed).`,
      file.ref.fileId,
      'WARN'
    );
  };

  const toggleStar = (file: CloudFile) => {
    const accountCaps = capabilities[file.ref.accountId];
    if (accountCaps && accountCaps.canStar === false) {
      addAuditLog(
        file.ref.accountId,
        'STAR_UNSUPPORTED',
        `Starring is not supported by ${PROVIDERS[file.ref.provider].name}.`,
        file.ref.fileId,
        'WARN'
      );
      return;
    }

    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const nextStarred = !file.isStarred;
    const updatedFile: CloudFile = { ...file, isStarred: nextStarred };
    setFiles((prev) =>
      prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? updatedFile : f))
    );
    if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
      setInspectedFile(updatedFile);
    }
    safePersistFirestore(() => databaseService.saveFile(updatedFile), 'saveFile');

    if (account && cloudProviderService.hasLiveToken(account.localId)) {
      void cloudProviderService
        .executeRemoteMutation(account, {
          operation: 'STAR',
          fileId: file.ref.fileId,
          starred: nextStarred,
        })
        .catch((err: unknown) => {
          addAuditLog(
            file.ref.accountId,
            'STAR_SYNC_ERROR',
            err instanceof Error ? err.message : 'Failed to update star status remotely.',
            file.ref.fileId,
            'ERROR'
          );
        });
    }

    addAuditLog(
      file.ref.accountId,
      'STAR_FILE',
      `${nextStarred ? 'Starred' : 'Unstarred'} file`,
      file.ref.fileId
    );
  };

  const toggleOffline = (file: CloudFile) => {
    if (file.isFolder) return;
    const nextOffline = !file.isOfflineAvailable;
    const account = accounts.find((a) => a.localId === file.ref.accountId);

    if (!nextOffline) {
      const updatedFile: CloudFile = { ...file, isOfflineAvailable: false };
      setFiles((prev) =>
        prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? updatedFile : f))
      );
      if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
        setInspectedFile(updatedFile);
      }
      safePersistFirestore(() => databaseService.saveFile(updatedFile), 'saveFile');
      void offlineCacheService.unpinFile(file.ref).then(() => refreshOfflineStats());
      addAuditLog(
        file.ref.accountId,
        'OFFLINE_EVICT',
        `Evicted ${file.name} from local offline byte cache`,
        file.ref.fileId
      );
      return;
    }

    void (async () => {
      try {
        const blob = await cloudProviderService.streamDownloadBytes(
          account,
          file,
          new AbortController().signal,
          () => {}
        );
        const bytes = await blob.arrayBuffer();
        const updatedFile: CloudFile = { ...file, isOfflineAvailable: true };
        await offlineCacheService.pinFileBytes(updatedFile, bytes);
        setFiles((prev) =>
          prev.map((f) => (cacheKey(f.ref) === cacheKey(file.ref) ? updatedFile : f))
        );
        if (inspectedFile && cacheKey(inspectedFile.ref) === cacheKey(file.ref)) {
          setInspectedFile(updatedFile);
        }
        safePersistFirestore(() => databaseService.saveFile(updatedFile), 'saveFile');
        await refreshOfflineStats();
        addAuditLog(
          file.ref.accountId,
          'OFFLINE_PIN',
          `Pinned ${file.name} (${bytes.byteLength} bytes) in local offline byte cache`,
          file.ref.fileId
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Unable to fetch file bytes for offline pin.';
        addAuditLog(
          file.ref.accountId,
          'OFFLINE_PIN_FAILED',
          `Offline pin failed for ${file.name}: ${msg}`,
          file.ref.fileId,
          'ERROR'
        );
      }
    })();
  };

  const evictOfflineCache = async () => {
    await offlineCacheService.clearAll();
    setFiles((prev) =>
      prev.map((f) => (f.isOfflineAvailable ? { ...f, isOfflineAvailable: false } : f))
    );
    await refreshOfflineStats();
    addAuditLog(1, 'OFFLINE_CACHE_CLEARED', 'Evicted all locally pinned offline file bytes.');
  };

  const copyFile = (file: CloudFile, targetFolderId?: string | null) => {
    const account = accounts.find((a) => a.localId === file.ref.accountId);
    const { clones, totalCopiedBytes } = cloneFolderHierarchyRecursively(
      file,
      targetFolderId,
      files
    );

    setFiles((prev) => [...clones, ...prev]);
    clones.forEach((clone) => safePersistFirestore(() => databaseService.saveFile(clone), 'saveFile'));

    if (account) {
      dispatchMutationOperation(
        account,
        'COPY',
        file.ref.fileId,
        clones[0].name,
        { targetFolderId: targetFolderId ?? file.parentFolderId ?? null },
        async () => {
          await cloudProviderService.executeRemoteMutation(account, {
            operation: 'COPY',
            fileId: file.ref.fileId,
            name: clones[0].name,
            targetFolderId: targetFolderId ?? file.parentFolderId ?? null,
          });
          await refreshLiveQuotaForAccount(account);
        }
      );
    }

    if (totalCopiedBytes > 0) {
      setQuotas((prev) => {
        const current = prev[file.ref.accountId];
        if (!current) return prev;
        const updatedQuota: QuotaUsage = {
          ...current,
          usedBytes: current.usedBytes + totalCopiedBytes,
        };
        safePersistFirestore(() => databaseService.saveQuota(updatedQuota), 'saveQuota');
        return {
          ...prev,
          [file.ref.accountId]: updatedQuota,
        };
      });
    }

    addAuditLog(
      file.ref.accountId,
      'COPY_FILE',
      `Created copy "${clones[0].name}" (${clones.length} item(s), ${totalCopiedBytes} bytes)`,
      clones[0].ref.fileId
    );
  };

  const createFolder = (accountId: LocalAccountId, name: string, parentFolderId: string | null) => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) return;

    const folderName = name.trim() || 'New Folder';
    const folderId = createEntityId('folder');
    const newFolder: CloudFile = {
      ref: { provider: account.provider, accountId, fileId: folderId },
      name: folderName,
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
    safePersistFirestore(() => databaseService.saveFile(newFolder), 'saveFile');

    dispatchMutationOperation(
      account,
      'CREATE_FOLDER',
      folderId,
      folderName,
      { targetFolderId: parentFolderId },
      async () => {
        const remote = await cloudProviderService.executeRemoteMutation(account, {
          operation: 'CREATE_FOLDER',
          fileId: null,
          name: folderName,
          targetFolderId: parentFolderId,
        });
        if (remote.remoteId && remote.remoteId !== folderId) {
          const updatedRemoteFolder: CloudFile = {
            ...newFolder,
            ref: { ...newFolder.ref, fileId: remote.remoteId },
          };
          setFiles((prev) =>
            prev.map((f) => (f.ref.fileId === folderId ? updatedRemoteFolder : f))
          );
          safePersistFirestore(() => databaseService.saveFile(updatedRemoteFolder), 'saveFile');
        }
      }
    );

    addAuditLog(accountId, 'CREATE_FOLDER', `Created folder "${folderName}" in ${account.badgeLabel}`, folderId);
  };

  const reconcileOperation = (id: number) => {
    const target = pendingOperations.find((op) => op.id === id);
    if (!target) return;
    const account = accounts.find((a) => a.localId === target.accountId);
    if (!account) return;

    void (async () => {
      try {
        const remoteFiles = await cloudProviderService.listRemoteFiles(account, null);
        const confirmed =
          Boolean(target.fileId) &&
          Boolean(remoteFiles?.some((f) => f.ref.fileId === target.fileId || f.name === target.fileName));
        if (confirmed) {
          const resolved: PendingOperation = {
            ...target,
            state: 'COMPLETED',
            outcomeUncertain: false,
            error: undefined,
          };
          setPendingOperations((prev) => prev.map((op) => (op.id === id ? resolved : op)));
          offlineCacheService.markNativeOperationState(id, 'COMPLETED');
        } else {
          await executeQueuedRemoteOperation(target);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Reconciliation check failed.';
        setPendingOperations((prev) =>
          prev.map((op) => (op.id === id ? { ...op, state: 'FAILED', error: msg } : op))
        );
      }
    })();
  };

  const retryOperation = (id: number) => {
    const targetOp = pendingOperations.find((op) => op.id === id);
    if (!targetOp) return;
    void executeQueuedRemoteOperation(targetOp);
  };

  const clearCompletedOperations = () => {
    setPendingOperations((prev) => prev.filter((op) => op.state !== 'COMPLETED'));
  };

  const cancelTransfer = (id: string) => {
    const controller = transferAbortControllersRef.current.get(id);
    controller?.abort();
    transferAbortControllersRef.current.delete(id);
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
    const source = transferSourcesRef.current.get(id);
    const existing = transfers.find((t) => t.id === id);
    if (!existing) return;

    if (source?.direction === 'UPLOAD' && source.uploadFileObj) {
      const account = accounts.find((a) => a.localId === source.accountId);
      if (account) {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  bytesTransferred: 0,
                  status: { status: 'Running', progress: 0, speedBytesPerSec: 0 },
                }
              : t
          )
        );
        void executeUploadTransfer(
          id,
          allocateOpId(),
          account,
          source.folderId,
          source.uploadFileObj,
          existing.ref
        );
        return;
      }
    }

    if (source?.direction === 'DOWNLOAD' && source.cloudFile) {
      setTransfers((prev) => prev.filter((t) => t.id !== id));
      void downloadFile(source.cloudFile);
      return;
    }

    setTransfers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: {
                status: 'Failed',
                error: 'Transfer source unavailable; re-initiate upload or download.',
              },
            }
          : t
      )
    );
  };

  const pauseResumeTransfer = (id: string) => {
    const current = transfers.find((t) => t.id === id);
    if (!current) return;

    if (current.status.status === 'Running') {
      const controller = transferAbortControllersRef.current.get(id);
      controller?.abort();
      transferAbortControllersRef.current.delete(id);
      setTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: { status: 'Paused' } } : t))
      );
      return;
    }

    if (current.status.status === 'Paused') {
      retryTransfer(id);
    }
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
  };

  const resetAllData = () => {
    try {
      localStorage.removeItem(accountsKey);
      localStorage.removeItem(filesKey);
      localStorage.removeItem(capabilitiesKey);
      localStorage.removeItem(quotasKey);
      localStorage.removeItem(pendingOpsKey);
      localStorage.removeItem(auditLogsKey);
    } catch (e) {
      console.warn('Failed to clear scoped storage on reset:', e);
    }
    void offlineCacheService.clearAll().then(() => refreshOfflineStats());
    setAccounts(defaultAccounts);
    setFiles(defaultFiles);
    setCapabilities(defaultCapabilities);
    setQuotas(defaultQuotas);
    setPendingOperations([]);
    setTransfers([]);
    setAuditLogs([]);
    setCurrentFolderId(null);
    setFolderHistory([]);
    setSelectedFileKeys(new Set());
    setInspectedFile(null);
  };

  const loadSampleWorkspace = () => {
    const isDev = Boolean(
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
    );
    if (!isDev) {
      console.warn('Sample workspace seeding is disabled in production builds.');
      return;
    }
    void import('../data/mockData').then((mod) => {
      setAccounts(mod.INITIAL_ACCOUNTS);
      setFiles(mod.INITIAL_FILES);
      setCapabilities(mod.INITIAL_CAPABILITIES);
      setQuotas(mod.INITIAL_QUOTA);
      safePersistFirestore(
        () =>
          databaseService.seedWorkspaceIfEmpty(
            mod.INITIAL_ACCOUNTS,
            mod.INITIAL_FILES,
            mod.INITIAL_QUOTA
          ),
        'seedWorkspaceIfEmpty'
      );
    });
  };

  const syncAccount = async (accountId: LocalAccountId) => {
    const account = accounts.find((a) => a.localId === accountId);
    if (!account) return;

    setSyncStatuses((prev) => ({
      ...prev,
      [accountId]: {
        provider: account.provider,
        accountId,
        status: 'syncing',
        lastSyncedAt: prev[accountId]?.lastSyncedAt || Date.now(),
        latencyMs: prev[accountId]?.latencyMs || 0,
        itemsSynced: prev[accountId]?.itemsSynced || 0,
        autoSyncIntervalMinutes: prev[accountId]?.autoSyncIntervalMinutes || 5,
        errorMessage: undefined,
      },
    }));

    try {
      const { latencyMs, files: remoteFiles, quota: liveQuota } =
        await cloudProviderService.syncAccountDelta(account);

      if (remoteFiles && remoteFiles.length > 0) {
        setFiles((prev) => [
          ...remoteFiles,
          ...prev.filter((f) => f.ref.accountId !== accountId),
        ]);
      }

      if (liveQuota) {
        setQuotas((prev) => ({ ...prev, [accountId]: liveQuota }));
        safePersistFirestore(() => databaseService.saveQuota(liveQuota), 'saveQuota');
      }

      const accFilesCount =
        remoteFiles?.length ??
        files.filter((f) => f.ref.accountId === accountId && !f.isTrashed).length;

      setSyncStatuses((prev) => ({
        ...prev,
        [accountId]: {
          provider: account.provider,
          accountId,
          status: 'synced',
          lastSyncedAt: Date.now(),
          latencyMs,
          itemsSynced: accFilesCount,
          autoSyncIntervalMinutes: prev[accountId]?.autoSyncIntervalMinutes || 5,
          errorMessage: undefined,
        },
      }));

      addAuditLog(
        accountId,
        'BACKGROUND_SYNC_SUCCESS',
        `Synchronized delta state (${latencyMs}ms elapsed, ${accFilesCount} items verified)`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncStatuses((prev) => ({
        ...prev,
        [accountId]: {
          provider: account.provider,
          accountId,
          status: 'error',
          lastSyncedAt: Date.now(),
          latencyMs: 0,
          itemsSynced: 0,
          autoSyncIntervalMinutes: 5,
          errorMessage: msg,
        },
      }));
      addAuditLog(accountId, 'BACKGROUND_SYNC_ERROR', `Delta sync failed: ${msg}`, undefined, 'ERROR');
    }
  };

  const syncAllAccounts = async () => {
    await Promise.all(accounts.map((acc) => syncAccount(acc.localId)));
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
        connectAccountWithOAuth,
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
        toggleOffline,
        copyFile,
        createFolder,
        offlineCacheStats,
        evictOfflineCache,
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
        auditLogs,
        addAuditLog,
        clearAuditLogs,
        resetAllData,
        loadSampleWorkspace,
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
