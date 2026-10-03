// Multi-Cloud Domain Types supporting Google Drive, Microsoft OneDrive, Dropbox, and Box

export type ProviderId = 'GOOGLE_DRIVE' | 'ONE_DRIVE' | 'DROPBOX' | 'BOX';

export type LocalAccountId = number;

export type ProviderFileId = string;

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  shortName: string;
  brandColor: string;
  defaultQuotaBytes: number;
  manageUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  GOOGLE_DRIVE: {
    id: 'GOOGLE_DRIVE',
    name: 'Google Drive',
    shortName: 'Drive',
    brandColor: '#1a73e8',
    defaultQuotaBytes: 15 * 1024 * 1024 * 1024, // 15 GB
    manageUrl: 'https://one.google.com/storage',
  },
  ONE_DRIVE: {
    id: 'ONE_DRIVE',
    name: 'Microsoft OneDrive',
    shortName: 'OneDrive',
    brandColor: '#0078d4',
    defaultQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    manageUrl: 'https://onedrive.live.com/?v=managestorage',
  },
  DROPBOX: {
    id: 'DROPBOX',
    name: 'Dropbox',
    shortName: 'Dropbox',
    brandColor: '#0061ff',
    defaultQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    manageUrl: 'https://www.dropbox.com/account/plan',
  },
  BOX: {
    id: 'BOX',
    name: 'Box Cloud',
    shortName: 'Box',
    brandColor: '#0061d5',
    defaultQuotaBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    manageUrl: 'https://app.box.com/account',
  },
};

export interface AccountRef {
  localId: LocalAccountId;
  provider: ProviderId;
  providerAccountId: string;
  displayEmail: string;
  displayName: string;
  avatarUrl?: string;
  color: string;
  badgeLabel: string;
  state: AccountState;
  grantedScopes: string[];
  lastVerifiedAt: number;
}

export interface FileRef {
  provider: ProviderId;
  accountId: LocalAccountId;
  fileId: ProviderFileId;
}

export function cacheKey(ref: FileRef): string {
  return `${ref.provider}:${ref.accountId}:${ref.fileId}`;
}

export interface CloudFile {
  ref: FileRef;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  modifiedTimeMillis: number;
  isFolder: boolean;
  parentFolderId: ProviderFileId | null;
  isShared: boolean;
  isOwnedByUser: boolean;
  isStarred: boolean;
  isOfflineAvailable?: boolean;
  isTrashed: boolean;
  webViewLink?: string;
  thumbnailLink?: string;
  contentDataUrl?: string; // Stored data/blob url for user-uploaded or sample files
  previewText?: string; // Text preview snippet for documents/code/notes
  dimensions?: { width: number; height: number };
  durationSeconds?: number;
  revisions?: FileRevision[];
}

export interface FileRevision {
  id: string;
  modifiedTimeMillis: number;
  sizeBytes: number;
  modifiedBy: string;
  label?: string;
}

export enum Freshness {
  NONE = 'NONE',
  FRESH = 'FRESH',
  STALE = 'STALE',
}

export type SyncStatusState = 'synced' | 'syncing' | 'warning' | 'error';

export interface ProviderSyncStatus {
  provider: ProviderId;
  accountId: LocalAccountId;
  status: SyncStatusState;
  lastSyncedAt: number;
  latencyMs: number;
  itemsSynced: number;
  errorMessage?: string;
  autoSyncIntervalMinutes: number;
}

export enum AccountState {
  DISCONNECTED = 'DISCONNECTED',
  AUTHORIZING = 'AUTHORIZING',
  CONNECTED = 'CONNECTED',
  REFRESHING = 'REFRESHING',
  REAUTH_REQUIRED = 'REAUTH_REQUIRED',
}

export type AccountEventType =
  | 'AddAccountRequested'
  | 'ConsentAbandoned'
  | 'TokensStored'
  | 'AccessTokenExpired'
  | 'RefreshSucceeded'
  | 'RefreshRejected'
  | 'ProviderRejectedCredential'
  | 'ReconnectRequested'
  | 'DisconnectRequested'
  | 'OperationCancelled';

export interface AccountEvent {
  type: AccountEventType;
  verifiedByLiveCall?: boolean;
}

export enum TransitionRefusal {
  NOT_PERMITTED_FROM_STATE = 'NOT_PERMITTED_FROM_STATE',
  LIVE_VERIFICATION_REQUIRED = 'LIVE_VERIFICATION_REQUIRED',
}

export type Transition =
  | { type: 'Allowed'; from: AccountState; to: AccountState; event: AccountEvent }
  | { type: 'Refused'; state: AccountState; event: AccountEvent; refusal: TransitionRefusal };

export enum Feature {
  READ = 'READ',
  SEARCH = 'SEARCH',
  WRITE = 'WRITE',
  REVISIONS = 'REVISIONS',
  DOWNLOAD = 'DOWNLOAD',
  STAR = 'STAR',
  EXPORT = 'EXPORT',
  OFFLINE = 'OFFLINE',
}

export interface ProviderCapabilities {
  canReadFiles: boolean | null;
  canWriteFiles: boolean | null;
  canCreateFolders: boolean | null;
  canRename: boolean | null;
  canTrash: boolean | null;
  canSearch: boolean | null;
  canReadRevisions: boolean | null;
  canStar: boolean | null;
  canDownloadBytes: boolean | null;
  grantsOfflineAccess: boolean | null;
  canExport: boolean | null;
}

export enum FileAction {
  OPEN = 'OPEN',
  DOWNLOAD = 'DOWNLOAD',
  EXPORT = 'EXPORT',
  RENAME = 'RENAME',
  MOVE = 'MOVE',
  COPY = 'COPY',
  TRASH = 'TRASH',
  RESTORE = 'RESTORE',
  DELETE_PERMANENTLY = 'DELETE_PERMANENTLY',
  STAR = 'STAR',
  VIEW_REVISIONS = 'VIEW_REVISIONS',
  SHARE = 'SHARE',
}

export type UnavailableReason =
  | { type: 'ScopeInsufficient'; feature: Feature; message?: string }
  | { type: 'FileCannot'; explanation: string }
  | { type: 'FileInTrash' };

export interface ActionAvailability {
  action: FileAction;
  available: boolean;
  reason?: UnavailableReason;
}

export interface QuotaUsage {
  providerId: ProviderId;
  accountId: LocalAccountId;
  usedBytes: number;
  limitBytes: number | null;
  manageUrl: string | null;
}

export interface QuotaSnapshot {
  inFlightTotal: number;
  inFlightByAccount: Record<number, number>;
  requestsInWindow: number;
  perAccountLimit: number;
  globalLimit: number;
  requestsPerWindow: number;
  millisUntilRefresh: number;
}

export type OperationType =
  | 'RENAME'
  | 'MOVE'
  | 'COPY'
  | 'TRASH'
  | 'RESTORE'
  | 'CREATE_FOLDER'
  | 'UPLOAD'
  | 'DELETE_PERMANENTLY';

export type OperationState = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RECONCILING';

export interface PendingOperation {
  id: number;
  accountId: LocalAccountId;
  operation: OperationType;
  fileId: ProviderFileId | null;
  fileName?: string;
  payload: string | null;
  state: OperationState;
  createdAt: number;
  lastAttemptAt: number | null;
  attemptCount: number;
  outcomeUncertain: boolean;
  error?: string;
}

export type TransferDirection = 'DOWNLOAD' | 'UPLOAD';

export type TransferStatus =
  | { status: 'Queued' }
  | { status: 'Running'; progress: number; speedBytesPerSec: number }
  | { status: 'Paused' }
  | { status: 'Completed' }
  | { status: 'Failed'; error: string }
  | { status: 'Cancelled' };

export interface TransferItem {
  id: string;
  ref: FileRef;
  fileName: string;
  direction: TransferDirection;
  bytesTransferred: number;
  totalBytes: number | null;
  status: TransferStatus;
  startedAt: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  accountId: LocalAccountId;
  action: string;
  rawMessage: string;
  redactedMessage: string;
  correlationTag: string; // 12-char FNV-1a hash
  severity: 'INFO' | 'WARN' | 'ERROR';
}
