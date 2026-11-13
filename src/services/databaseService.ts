import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  AccountRef,
  AuditLogEntry,
  CloudFile,
  PendingOperation,
  ProviderCapabilities,
  QuotaUsage,
  cacheKey,
} from '../types';
import { AuthUser } from './authService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Sanitize an object before writing to Firestore by stripping undefined fields
 * and skipping blob: URLs that are only valid in the current browser tab.
 */
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) return null;
      if (typeof value === 'string' && value.startsWith('blob:')) return null;
      return value;
    })
  ) as T;
}

function getActiveFirestoreUid(logIfMissing = false, subPath = 'users/<unauthenticated>'): string | null {
  const uid = auth.currentUser?.uid ?? null;
  if (!uid && logIfMissing) {
    handleFirestoreError(
      new Error('Firestore operation rejected: no active Firebase Auth uid.'),
      OperationType.WRITE,
      subPath
    );
  }
  return uid;
}

function requireActiveFirestoreUid(subPath: string): string {
  const uid = getActiveFirestoreUid(true, subPath);
  if (!uid) {
    throw new Error(`Firestore write rejected for ${subPath}: user is not authenticated with Firebase.`);
  }
  return uid;
}

function encodeDocId(rawKey: string): string {
  return rawKey.replace(/[/:.#$[\]]/g, '_');
}

export const databaseService = {
  async testConnection(): Promise<boolean> {
    try {
      await getDocFromServer(doc(db, 'connection_test', 'check'));
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore client is currently operating in offline/local mode.');
      }
      return false;
    }
  },

  async syncUserProfile(user: AuthUser): Promise<void> {
    const uid = requireActiveFirestoreUid('users/<unauthenticated>');
    const path = `users/${uid}`;
    try {
      await setDoc(
        doc(db, 'users', uid),
        sanitizeForFirestore({
          uid,
          localUserId: user.id,
          email: user.email,
          displayName: user.name,
          provider: user.provider,
          createdAt: new Date(user.createdAt).toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async loadUserWorkspace(): Promise<{
    accounts?: AccountRef[];
    files?: CloudFile[];
    quotas?: Record<number, QuotaUsage>;
    capabilities?: Record<number, ProviderCapabilities>;
    operations?: PendingOperation[];
    auditLogs?: AuditLogEntry[];
  } | null> {
    const uid = getActiveFirestoreUid();
    if (!uid) return null;

    try {
      const [accountsSnap, filesSnap, quotasSnap, opsSnap, logsSnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'accounts')),
        getDocs(collection(db, 'users', uid, 'files')),
        getDocs(collection(db, 'users', uid, 'quotas')),
        getDocs(collection(db, 'users', uid, 'operations')),
        getDocs(collection(db, 'users', uid, 'auditLogs')),
      ]);

      const result: {
        accounts?: AccountRef[];
        files?: CloudFile[];
        quotas?: Record<number, QuotaUsage>;
        operations?: PendingOperation[];
        auditLogs?: AuditLogEntry[];
      } = {};

      if (!accountsSnap.empty) {
        result.accounts = accountsSnap.docs
          .map((d) => d.data() as AccountRef)
          .sort((a, b) => a.localId - b.localId);
      }

      if (!filesSnap.empty) {
        result.files = filesSnap.docs
          .map((d) => d.data() as CloudFile)
          .sort((a, b) => b.modifiedTimeMillis - a.modifiedTimeMillis);
      }

      if (!quotasSnap.empty) {
        const quotasMap: Record<number, QuotaUsage> = {};
        quotasSnap.docs.forEach((d) => {
          const data = d.data() as QuotaUsage;
          if (typeof data.accountId === 'number') {
            quotasMap[data.accountId] = data;
          }
        });
        result.quotas = quotasMap;
      }

      if (!opsSnap.empty) {
        result.operations = opsSnap.docs
          .map((d) => d.data() as PendingOperation)
          .sort((a, b) => b.createdAt - a.createdAt);
      }

      if (!logsSnap.empty) {
        result.auditLogs = logsSnap.docs
          .map((d) => d.data() as AuditLogEntry)
          .sort((a, b) => b.timestamp - a.timestamp);
      }

      return result;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}`);
      return null;
    }
  },

  async saveAccount(account: AccountRef, quota?: QuotaUsage): Promise<void> {
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/accounts/${account.localId}`);
    const accountPath = `users/${uid}/accounts/${account.localId}`;
    try {
      await setDoc(
        doc(db, 'users', uid, 'accounts', String(account.localId)),
        sanitizeForFirestore(account)
      );
      if (quota) {
        await setDoc(
          doc(db, 'users', uid, 'quotas', String(account.localId)),
          sanitizeForFirestore(quota)
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, accountPath);
      throw error;
    }
  },

  async removeAccount(accountId: number): Promise<void> {
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/accounts/${accountId}`);
    const accountPath = `users/${uid}/accounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'accounts', String(accountId)));
      await deleteDoc(doc(db, 'users', uid, 'quotas', String(accountId)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, accountPath);
      throw error;
    }
  },

  async saveFile(file: CloudFile): Promise<void> {
    const docId = encodeDocId(cacheKey(file.ref));
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/files/${docId}`);
    const path = `users/${uid}/files/${docId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'files', docId), sanitizeForFirestore(file));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async removeFile(file: CloudFile): Promise<void> {
    const docId = encodeDocId(cacheKey(file.ref));
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/files/${docId}`);
    const path = `users/${uid}/files/${docId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'files', docId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  async saveQuota(quota: QuotaUsage): Promise<void> {
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/quotas/${quota.accountId}`);
    const path = `users/${uid}/quotas/${quota.accountId}`;
    try {
      await setDoc(
        doc(db, 'users', uid, 'quotas', String(quota.accountId)),
        sanitizeForFirestore(quota)
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async saveOperation(op: PendingOperation): Promise<void> {
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/operations/${op.id}`);
    const path = `users/${uid}/operations/${op.id}`;
    try {
      const normalized: PendingOperation = {
        ...op,
        fileId: op.fileId ?? '',
      };
      await setDoc(
        doc(db, 'users', uid, 'operations', String(op.id)),
        sanitizeForFirestore(normalized)
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    const uid = requireActiveFirestoreUid(`users/<unauthenticated>/auditLogs/${entry.id}`);
    const path = `users/${uid}/auditLogs/${entry.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'auditLogs', entry.id), sanitizeForFirestore(entry));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async seedWorkspaceIfEmpty(
    accounts: AccountRef[],
    files: CloudFile[],
    quotas: Record<number, QuotaUsage>
  ): Promise<void> {
    const uid = requireActiveFirestoreUid('users/<unauthenticated>/seedWorkspace');
    try {
      const existingAccounts = await getDocs(collection(db, 'users', uid, 'accounts'));
      if (!existingAccounts.empty) return;

      const batch = writeBatch(db);
      accounts.forEach((acc) => {
        batch.set(
          doc(db, 'users', uid, 'accounts', String(acc.localId)),
          sanitizeForFirestore(acc)
        );
      });
      Object.values(quotas).forEach((q) => {
        batch.set(
          doc(db, 'users', uid, 'quotas', String(q.accountId)),
          sanitizeForFirestore(q)
        );
      });
      files.slice(0, 50).forEach((f) => {
        const docId = encodeDocId(cacheKey(f.ref));
        batch.set(doc(db, 'users', uid, 'files', docId), sanitizeForFirestore(f));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      throw error;
    }
  },
};
