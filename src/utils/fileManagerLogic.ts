import { AccountRef, CloudFile, LocalAccountId, ProviderId, cacheKey } from '../types';

let fallbackIdCounter = 0;

function generateUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    fallbackIdCounter += 1;
    const seed = Date.now() ^ fallbackIdCounter;
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = (seed >> ((i % 4) * 8)) & 0xff;
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createEntityId(prefix: string): string {
  return `${prefix}_${generateUuid()}`;
}

export function createMonotonicIdAllocator(initialMaxId = 0): () => number {
  let current = Math.max(0, Math.floor(initialMaxId));
  return () => {
    current += 1;
    return current;
  };
}

/**
 * Computes upload/download progress percentage safely.
 * Zero-byte files (`totalBytes === 0`) return 100% rather than NaN.
 */
export function computeTransferProgress(bytesTransferred: number, totalBytes: number): number {
  if (totalBytes <= 0) {
    return 100;
  }
  const clamped = Math.max(0, Math.min(bytesTransferred, totalBytes));
  return Math.min(100, Math.round((clamped / totalBytes) * 100));
}

/**
 * Checks whether moving `movingFolderId` into `targetFolderId` within `accountId`
 * would move the folder into itself or any of its descendants.
 */
export function wouldMoveCreateFolderCycle(
  movingFolderId: string,
  targetFolderId: string | null,
  accountId: LocalAccountId,
  files: CloudFile[]
): boolean {
  if (!targetFolderId) return false;
  if (movingFolderId === targetFolderId) return true;

  const folderParentMap = new Map<string, string | null>();
  for (const f of files) {
    if (f.ref.accountId === accountId && f.isFolder) {
      folderParentMap.set(f.ref.fileId, f.parentFolderId);
    }
  }

  const visited = new Set<string>();
  let cursor: string | null | undefined = targetFolderId;
  let depth = 0;

  while (cursor && depth < 256) {
    if (cursor === movingFolderId) return true;
    if (visited.has(cursor)) break;
    visited.add(cursor);
    cursor = folderParentMap.get(cursor) ?? null;
    depth++;
  }

  return false;
}

/**
 * Returns the set of `cacheKey(f.ref)` for `rootFile` and all its recursive descendants
 * within the same account.
 */
export function collectDescendantFileKeys(rootFile: CloudFile, files: CloudFile[]): Set<string> {
  const result = new Set<string>([cacheKey(rootFile.ref)]);
  if (!rootFile.isFolder) {
    return result;
  }

  const accountId = rootFile.ref.accountId;
  const folderIds = new Set<string>([rootFile.ref.fileId]);
  let added = true;

  while (added) {
    added = false;
    for (const f of files) {
      if (f.ref.accountId !== accountId) continue;
      if (f.parentFolderId && folderIds.has(f.parentFolderId)) {
        const key = cacheKey(f.ref);
        if (!result.has(key)) {
          result.add(key);
          added = true;
          if (f.isFolder) {
            folderIds.add(f.ref.fileId);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Recursively clones a file or folder (including all nested child folders and files)
 * with fresh UUIDs and remapped parentFolderIds.
 */
export function cloneFolderHierarchyRecursively(
  rootFile: CloudFile,
  targetFolderId: string | null | undefined,
  files: CloudFile[],
  idFactory: (prefix: string) => string = createEntityId
): { clones: CloudFile[]; totalCopiedBytes: number } {
  const now = Date.now();
  const resolvedParentId =
    targetFolderId !== undefined ? targetFolderId : rootFile.parentFolderId;

  const dotIdx = rootFile.name.lastIndexOf('.');
  const rootCopyName =
    dotIdx > 0 && !rootFile.isFolder
      ? `${rootFile.name.slice(0, dotIdx)} (Copy)${rootFile.name.slice(dotIdx)}`
      : `${rootFile.name} (Copy)`;

  const newRootId = idFactory(rootFile.isFolder ? 'folder_copy' : 'file_copy');
  const rootClone: CloudFile = {
    ...rootFile,
    ref: {
      ...rootFile.ref,
      fileId: newRootId,
    },
    name: rootCopyName,
    parentFolderId: resolvedParentId,
    modifiedTimeMillis: now,
  };

  if (!rootFile.isFolder) {
    return {
      clones: [rootClone],
      totalCopiedBytes: rootClone.sizeBytes ?? 0,
    };
  }

  const clones: CloudFile[] = [rootClone];
  let totalCopiedBytes = 0;
  const accountId = rootFile.ref.accountId;
  const parentIdRemap = new Map<string, string>([[rootFile.ref.fileId, newRootId]]);
  const queue: string[] = [rootFile.ref.fileId];

  while (queue.length > 0) {
    const currentOldFolderId = queue.shift()!;
    const mappedNewParentId = parentIdRemap.get(currentOldFolderId)!;

    const directChildren = files.filter(
      (f) =>
        f.ref.accountId === accountId &&
        f.parentFolderId === currentOldFolderId &&
        !f.isTrashed &&
        f.ref.fileId !== newRootId
    );

    for (const child of directChildren) {
      const childNewId = idFactory(child.isFolder ? 'folder_copy' : 'file_copy');
      const childClone: CloudFile = {
        ...child,
        ref: {
          ...child.ref,
          fileId: childNewId,
        },
        parentFolderId: mappedNewParentId,
        modifiedTimeMillis: now,
      };
      clones.push(childClone);
      if (child.isFolder) {
        parentIdRemap.set(child.ref.fileId, childNewId);
        queue.push(child.ref.fileId);
      } else {
        totalCopiedBytes += child.sizeBytes ?? 0;
      }
    }
  }

  return { clones, totalCopiedBytes };
}

/**
 * Prevents connecting the same provider account twice (matched by provider + normalized email
 * or provider + providerAccountId).
 */
export function isDuplicateProviderAccount(
  existingAccounts: AccountRef[],
  provider: ProviderId,
  email: string,
  providerAccountId?: string
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return existingAccounts.some(
    (acc) =>
      acc.provider === provider &&
      (acc.displayEmail.trim().toLowerCase() === normalizedEmail ||
        (Boolean(providerAccountId) && acc.providerAccountId === providerAccountId))
  );
}
