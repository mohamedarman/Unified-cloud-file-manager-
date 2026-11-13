import { CloudFile, FileRef, LocalAccountId, cacheKey } from '../types';

export interface CachedBlobEntry {
  key: string;
  accountId: LocalAccountId;
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  cachedAt: number;
  bytes: ArrayBuffer;
}

export interface OfflineCacheStats {
  pinnedCount: number;
  totalBytes: number;
  entriesByKey: Record<string, { sizeBytes: number; cachedAt: number }>;
}

export interface AndroidNativeBridge {
  getBridgeCapabilitiesJson?: () => string;
  startExternalOAuthFlow?: (authUrl: string) => boolean;
  consumePendingOAuthCallbackJson?: () => string;
  exchangeOAuthCodeJson?: (
    provider: string,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ) => string;
  refreshOAuthTokenJson?: (provider: string, refreshToken: string) => string;
  storeEncryptedToken?: (
    accountId: number,
    accessToken: string,
    refreshToken: string | null,
    expiresAtMillis: number,
    scopesCsv: string
  ) => boolean;
  storeAccountToken?: (
    accountId: number,
    provider: string,
    providerAccountId: string,
    displayEmail: string | null,
    accessToken: string,
    refreshToken: string | null,
    expiresAtMillis: number,
    scopesCsv: string
  ) => boolean;
  getStoredTokenStatusJson?: (accountId: number) => string;
  revokeAndPurgeAccount?: (accountId: number) => boolean;
  enqueuePendingOperationJson?: (
    accountId: number,
    provider: string,
    operation: string,
    fileId: string | null,
    payloadJson: string | null
  ) => number;
  getPendingOperationsJson?: (accountId: number) => string;
  markPendingOperationState?: (operationId: number, state: string) => boolean;
  enqueueSyncWork?: (accountId: number) => boolean;
  saveDownloadedFileBase64?: (
    fileName: string,
    mimeType: string,
    base64Content: string
  ) => boolean;
  pinFileBytesBase64?: (accountId: number, fileId: string, base64Content: string) => number;
  unpinFileBytes?: (accountId: number, fileId: string) => boolean;
  clearOfflineCache?: () => boolean;
  getOfflineCacheStatsJson?: () => string;
}

declare global {
  interface Window {
    UnifiedCloudBridge?: AndroidNativeBridge;
  }
}

const IDB_NAME = 'ucfm_offline_blobs_v1';
const IDB_STORE = 'pinned_files';
const IDB_VERSION = 1;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

class OfflineCacheService {
  private memoryFallback = new Map<string, CachedBlobEntry>();

  private openDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async pinFileBytes(file: CloudFile, rawBytes: ArrayBuffer): Promise<number> {
    const key = cacheKey(file.ref);
    const entry: CachedBlobEntry = {
      key,
      accountId: file.ref.accountId,
      fileId: file.ref.fileId,
      fileName: file.name,
      mimeType: file.mimeType,
      sizeBytes: rawBytes.byteLength,
      cachedAt: Date.now(),
      bytes: rawBytes,
    };

    this.memoryFallback.set(key, entry);

    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.pinFileBytesBase64) {
      try {
        window.UnifiedCloudBridge.pinFileBytesBase64(
          file.ref.accountId,
          file.ref.fileId,
          arrayBufferToBase64(rawBytes)
        );
      } catch (e) {
        console.warn('Native offline cache write warning:', e);
      }
    }

    const db = await this.openDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(entry);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          db.close();
          resolve();
        }
      });
    }

    return entry.sizeBytes;
  }

  public async getPinnedBytes(ref: FileRef): Promise<ArrayBuffer | null> {
    const key = cacheKey(ref);
    const mem = this.memoryFallback.get(key);
    if (mem) return mem.bytes;

    const db = await this.openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => {
          const record = req.result as CachedBlobEntry | undefined;
          db.close();
          if (record?.bytes) {
            this.memoryFallback.set(key, record);
            resolve(record.bytes);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  }

  public async unpinFile(ref: FileRef): Promise<void> {
    const key = cacheKey(ref);
    this.memoryFallback.delete(key);

    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.unpinFileBytes) {
      try {
        window.UnifiedCloudBridge.unpinFileBytes(ref.accountId, ref.fileId);
      } catch {
        // ignore
      }
    }

    const db = await this.openDatabase();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  public async purgeAccountCache(accountId: LocalAccountId): Promise<void> {
    for (const [key, entry] of this.memoryFallback.entries()) {
      if (entry.accountId === accountId) {
        this.memoryFallback.delete(key);
      }
    }

    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.revokeAndPurgeAccount) {
      try {
        window.UnifiedCloudBridge.revokeAndPurgeAccount(accountId);
      } catch {
        // ignore
      }
    }

    const db = await this.openDatabase();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = (req.result as CachedBlobEntry[]) || [];
          rows.forEach((row) => {
            if (row.accountId === accountId) {
              store.delete(row.key);
            }
          });
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  public async clearAll(): Promise<void> {
    this.memoryFallback.clear();
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.clearOfflineCache) {
      try {
        window.UnifiedCloudBridge.clearOfflineCache();
      } catch {
        // ignore
      }
    }
    const db = await this.openDatabase();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  public async getStats(): Promise<OfflineCacheStats> {
    const db = await this.openDatabase();
    const entriesByKey: Record<string, { sizeBytes: number; cachedAt: number }> = {};
    let totalBytes = 0;
    let pinnedCount = 0;

    if (db) {
      const rows = await new Promise<CachedBlobEntry[]>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).getAll();
          req.onsuccess = () => {
            db.close();
            resolve((req.result as CachedBlobEntry[]) || []);
          };
          req.onerror = () => {
            db.close();
            resolve([]);
          };
        } catch {
          db.close();
          resolve([]);
        }
      });
      for (const row of rows) {
        this.memoryFallback.set(row.key, row);
      }
    }

    for (const [key, entry] of this.memoryFallback.entries()) {
      entriesByKey[key] = { sizeBytes: entry.sizeBytes, cachedAt: entry.cachedAt };
      totalBytes += entry.sizeBytes;
      pinnedCount++;
    }

    return { pinnedCount, totalBytes, entriesByKey };
  }

  public async saveBlobToDownloads(fileName: string, mimeType: string, blob: Blob): Promise<boolean> {
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.saveDownloadedFileBase64) {
      const buffer = await blob.arrayBuffer();
      const b64 = arrayBufferToBase64(buffer);
      return window.UnifiedCloudBridge.saveDownloadedFileBase64(
        fileName,
        mimeType || 'application/octet-stream',
        b64
      );
    }
    return false;
  }

  public enqueueNativeOperation(
    accountId: LocalAccountId,
    provider: string,
    operation: string,
    fileId: string | null,
    payloadJson: string | null
  ): number | null {
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.enqueuePendingOperationJson) {
      try {
        const id = window.UnifiedCloudBridge.enqueuePendingOperationJson(
          accountId,
          provider,
          operation,
          fileId,
          payloadJson
        );
        return id > 0 ? id : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  public markNativeOperationState(operationId: number, state: string): void {
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.markPendingOperationState) {
      try {
        window.UnifiedCloudBridge.markPendingOperationState(operationId, state);
      } catch {
        // ignore
      }
    }
  }
}

export const offlineCacheService = new OfflineCacheService();
