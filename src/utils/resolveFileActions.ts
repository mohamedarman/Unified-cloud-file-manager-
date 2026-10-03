import {
  CloudFile,
  ProviderCapabilities,
  FileAction,
  ActionAvailability,
  Feature,
} from '../types';

export function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.');
}

/**
 * Pure decision function for action availability.
 * Exact port of ResolveFileActions.kt.
 */
export const ResolveFileActions = {
  resolve(file: CloudFile, capabilities: ProviderCapabilities): Map<FileAction, ActionAvailability> {
    const map = new Map<FileAction, ActionAvailability>();

    // 1. OPEN
    if (capabilities.canReadFiles !== true) {
      map.set(FileAction.OPEN, {
        action: FileAction.OPEN,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.READ, message: 'Account cannot read files' },
      });
    } else {
      map.set(FileAction.OPEN, { action: FileAction.OPEN, available: true });
    }

    // 2. DOWNLOAD
    if (file.isFolder) {
      map.set(FileAction.DOWNLOAD, {
        action: FileAction.DOWNLOAD,
        available: false,
        reason: { type: 'FileCannot', explanation: 'A folder has no content to download' },
      });
    } else if (isGoogleNative(file.mimeType)) {
      map.set(FileAction.DOWNLOAD, {
        action: FileAction.DOWNLOAD,
        available: false,
        reason: { type: 'FileCannot', explanation: 'This document has no downloadable form; export it instead' },
      });
    } else if (capabilities.canDownloadBytes !== true) {
      map.set(FileAction.DOWNLOAD, {
        action: FileAction.DOWNLOAD,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.DOWNLOAD, message: 'Scope does not permit file download' },
      });
    } else {
      map.set(FileAction.DOWNLOAD, { action: FileAction.DOWNLOAD, available: true });
    }

    // 3. EXPORT
    if (!isGoogleNative(file.mimeType)) {
      map.set(FileAction.EXPORT, {
        action: FileAction.EXPORT,
        available: false,
        reason: { type: 'FileCannot', explanation: 'Only Google documents can be exported' },
      });
    } else if (capabilities.canExport !== true) {
      map.set(FileAction.EXPORT, {
        action: FileAction.EXPORT,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.EXPORT, message: 'Scope does not permit document export' },
      });
    } else {
      map.set(FileAction.EXPORT, { action: FileAction.EXPORT, available: true });
    }

    // 4. RENAME
    if (!file.isOwnedByUser) {
      map.set(FileAction.RENAME, {
        action: FileAction.RENAME,
        available: false,
        reason: { type: 'FileCannot', explanation: 'Only the owner can rename this file' },
      });
    } else if (capabilities.canRename !== true) {
      map.set(FileAction.RENAME, {
        action: FileAction.RENAME,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.WRITE, message: 'Scope does not permit rename' },
      });
    } else {
      map.set(FileAction.RENAME, { action: FileAction.RENAME, available: true });
    }

    // 5. MOVE & 6. COPY
    const moveCopyReason = !file.isOwnedByUser
      ? { type: 'FileCannot' as const, explanation: 'Only the owner can move or copy this file' }
      : capabilities.canWriteFiles !== true
      ? { type: 'ScopeInsufficient' as const, feature: Feature.WRITE, message: 'Scope does not permit modifications' }
      : null;

    if (moveCopyReason) {
      map.set(FileAction.MOVE, { action: FileAction.MOVE, available: false, reason: moveCopyReason });
      map.set(FileAction.COPY, { action: FileAction.COPY, available: false, reason: moveCopyReason });
    } else {
      map.set(FileAction.MOVE, { action: FileAction.MOVE, available: true });
      map.set(FileAction.COPY, { action: FileAction.COPY, available: true });
    }

    // 7. TRASH
    if (file.isTrashed) {
      map.set(FileAction.TRASH, {
        action: FileAction.TRASH,
        available: false,
        reason: { type: 'FileCannot', explanation: 'This file is already in the trash' },
      });
    } else if (!file.isOwnedByUser) {
      map.set(FileAction.TRASH, {
        action: FileAction.TRASH,
        available: false,
        reason: { type: 'FileCannot', explanation: 'Only the owner can move this file to trash' },
      });
    } else if (capabilities.canTrash !== true) {
      map.set(FileAction.TRASH, {
        action: FileAction.TRASH,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.WRITE, message: 'Scope does not permit trashing files' },
      });
    } else {
      map.set(FileAction.TRASH, { action: FileAction.TRASH, available: true });
    }

    // 8. RESTORE
    if (!file.isTrashed) {
      map.set(FileAction.RESTORE, {
        action: FileAction.RESTORE,
        available: false,
        reason: { type: 'FileCannot', explanation: 'This file is not in the trash' },
      });
    } else if (capabilities.canTrash !== true) {
      map.set(FileAction.RESTORE, {
        action: FileAction.RESTORE,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.WRITE, message: 'Scope does not permit restoring files' },
      });
    } else {
      map.set(FileAction.RESTORE, { action: FileAction.RESTORE, available: true });
    }

    // 9. DELETE PERMANENTLY
    if (!file.isTrashed) {
      map.set(FileAction.DELETE_PERMANENTLY, {
        action: FileAction.DELETE_PERMANENTLY,
        available: false,
        reason: { type: 'FileCannot', explanation: 'Only a file in the trash can be deleted permanently' },
      });
    } else if (capabilities.canTrash !== true) {
      map.set(FileAction.DELETE_PERMANENTLY, {
        action: FileAction.DELETE_PERMANENTLY,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.WRITE, message: 'Scope does not permit permanent deletion' },
      });
    } else {
      map.set(FileAction.DELETE_PERMANENTLY, { action: FileAction.DELETE_PERMANENTLY, available: true });
    }

    // 10. SHARE
    if (file.isTrashed) {
      map.set(FileAction.SHARE, {
        action: FileAction.SHARE,
        available: false,
        reason: { type: 'FileInTrash' },
      });
    } else if (!file.isOwnedByUser) {
      map.set(FileAction.SHARE, {
        action: FileAction.SHARE,
        available: false,
        reason: { type: 'FileCannot', explanation: 'Only the owner can change who this file is shared with' },
      });
    } else if (capabilities.canWriteFiles !== true) {
      map.set(FileAction.SHARE, {
        action: FileAction.SHARE,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.WRITE, message: 'Scope does not permit sharing' },
      });
    } else {
      map.set(FileAction.SHARE, { action: FileAction.SHARE, available: true });
    }

    // 11. VIEW_REVISIONS
    if (file.isFolder) {
      map.set(FileAction.VIEW_REVISIONS, {
        action: FileAction.VIEW_REVISIONS,
        available: false,
        reason: { type: 'FileCannot', explanation: 'Folders do not have revisions' },
      });
    } else if (capabilities.canReadRevisions !== true) {
      map.set(FileAction.VIEW_REVISIONS, {
        action: FileAction.VIEW_REVISIONS,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.REVISIONS, message: 'Scope does not permit reading revisions' },
      });
    } else {
      map.set(FileAction.VIEW_REVISIONS, { action: FileAction.VIEW_REVISIONS, available: true });
    }

    // 12. STAR
    if (capabilities.canStar !== true) {
      map.set(FileAction.STAR, {
        action: FileAction.STAR,
        available: false,
        reason: { type: 'ScopeInsufficient', feature: Feature.STAR, message: 'Scope does not permit starring' },
      });
    } else {
      map.set(FileAction.STAR, { action: FileAction.STAR, available: true });
    }

    return map;
  },
};
