import { describe, it, expect } from 'vitest';
import {
  createEntityId,
  createMonotonicIdAllocator,
  computeTransferProgress,
  wouldMoveCreateFolderCycle,
  collectDescendantFileKeys,
  cloneFolderHierarchyRecursively,
  isDuplicateProviderAccount,
} from '../../utils/fileManagerLogic';
import { cloudProviderService } from '../cloudProviderService';
import { QuotaGovernor } from '../../utils/quotaGovernor';
import { AccountRef, AccountState, CloudFile, cacheKey } from '../../types';

function makeFile(
  accountId: number,
  fileId: string,
  name: string,
  isFolder: boolean,
  parentFolderId: string | null = null,
  sizeBytes = 1024
): CloudFile {
  return {
    ref: { provider: 'GOOGLE_DRIVE', accountId, fileId },
    name,
    mimeType: isFolder ? 'application/vnd.google-apps.folder' : 'text/plain',
    sizeBytes: isFolder ? null : sizeBytes,
    modifiedTimeMillis: 1700000000000,
    parentFolderId,
    isFolder,
    isStarred: false,
    isTrashed: false,
    isShared: false,
    isOwnedByUser: true,
  };
}

describe('Phase 1 & Phase 3 File Manager Domain Logic', () => {
  it('generates collision-free UUID-backed entity IDs and strictly monotonic operation IDs without Date.now()', () => {
    const id1 = createEntityId('file_upload');
    const id2 = createEntityId('file_upload');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^file_upload_[0-9a-f-]{36}$/i);

    const nextOpId = createMonotonicIdAllocator(50);
    expect(nextOpId()).toBe(51);
    expect(nextOpId()).toBe(52);
    expect(nextOpId()).toBe(53);
  });

  it('handles 0-byte upload progress cleanly as 100% without NaN', () => {
    expect(computeTransferProgress(0, 0)).toBe(100);
    expect(Number.isNaN(computeTransferProgress(0, 0))).toBe(false);
    expect(computeTransferProgress(512, 1024)).toBe(50);
  });

  it('blocks moving a folder into itself or any of its descendants', () => {
    const rootFolder = makeFile(1, 'folder_root', 'Root', true, null);
    const childFolder = makeFile(1, 'folder_child', 'Child', true, 'folder_root');
    const grandChildFolder = makeFile(1, 'folder_grand', 'Grandchild', true, 'folder_child');
    const siblingFolder = makeFile(1, 'folder_sibling', 'Sibling', true, null);
    const allFiles = [rootFolder, childFolder, grandChildFolder, siblingFolder];

    // Moving into self
    expect(wouldMoveCreateFolderCycle('folder_root', 'folder_root', 1, allFiles)).toBe(true);
    // Moving into direct child
    expect(wouldMoveCreateFolderCycle('folder_root', 'folder_child', 1, allFiles)).toBe(true);
    // Moving into grandchild
    expect(wouldMoveCreateFolderCycle('folder_root', 'folder_grand', 1, allFiles)).toBe(true);
    // Moving into sibling is allowed
    expect(wouldMoveCreateFolderCycle('folder_root', 'folder_sibling', 1, allFiles)).toBe(false);
    // Moving to top-level root is allowed
    expect(wouldMoveCreateFolderCycle('folder_child', null, 1, allFiles)).toBe(false);
  });

  it('recursively collects all descendant files and folders for trash/restore/delete', () => {
    const rootFolder = makeFile(1, 'folder_root', 'Root', true, null);
    const childFolder = makeFile(1, 'folder_child', 'Child', true, 'folder_root');
    const nestedFile = makeFile(1, 'file_nested', 'Report.txt', false, 'folder_child', 4096);
    const unrelatedFile = makeFile(1, 'file_other', 'Other.txt', false, null, 2048);
    const allFiles = [rootFolder, childFolder, nestedFile, unrelatedFile];

    const keys = collectDescendantFileKeys(rootFolder, allFiles);
    expect(keys.has(cacheKey(rootFolder.ref))).toBe(true);
    expect(keys.has(cacheKey(childFolder.ref))).toBe(true);
    expect(keys.has(cacheKey(nestedFile.ref))).toBe(true);
    expect(keys.has(cacheKey(unrelatedFile.ref))).toBe(false);
  });

  it('recursively clones an entire folder hierarchy and sums byte usage', () => {
    const rootFolder = makeFile(1, 'folder_root', 'Project', true, null);
    const subFolder = makeFile(1, 'folder_sub', 'Docs', true, 'folder_root');
    const docA = makeFile(1, 'file_a', 'Spec.md', false, 'folder_root', 1000);
    const docB = makeFile(1, 'file_b', 'Notes.md', false, 'folder_sub', 2500);
    const allFiles = [rootFolder, subFolder, docA, docB];

    const { clones, totalCopiedBytes } = cloneFolderHierarchyRecursively(
      rootFolder,
      'dest_parent',
      allFiles
    );

    expect(clones.length).toBe(4);
    expect(totalCopiedBytes).toBe(3500);

    const clonedRoot = clones.find((f) => f.parentFolderId === 'dest_parent');
    expect(clonedRoot).toBeDefined();
    expect(clonedRoot?.name).toBe('Project (Copy)');

    const clonedSub = clones.find(
      (f) => f.isFolder && f.parentFolderId === clonedRoot?.ref.fileId
    );
    expect(clonedSub).toBeDefined();
    expect(clonedSub?.name).toBe('Docs');

    const clonedDocB = clones.find(
      (f) => !f.isFolder && f.parentFolderId === clonedSub?.ref.fileId
    );
    expect(clonedDocB?.name).toBe('Notes.md');
  });

  it('prevents connecting the same provider + email account twice', () => {
    const existing: AccountRef[] = [
      {
        localId: 1,
        provider: 'GOOGLE_DRIVE',
        providerAccountId: 'sub_1',
        displayEmail: 'User@Example.com',
        displayName: 'Drive',
        badgeLabel: 'Drive',
        color: '#2563EB',
        state: AccountState.CONNECTED,
        grantedScopes: ['read', 'write'],
        lastVerifiedAt: Date.now(),
      },
    ];

    expect(isDuplicateProviderAccount(existing, 'GOOGLE_DRIVE', 'user@example.com')).toBe(true);
    expect(isDuplicateProviderAccount(existing, 'DROPBOX', 'user@example.com')).toBe(false);
  });

  it('builds accurate provider-specific capabilities based on provider abilities and scopes', () => {
    const gdriveRw = cloudProviderService.getCapabilities('GOOGLE_DRIVE', ['https://www.googleapis.com/auth/drive.file']);
    expect(gdriveRw.canExport).toBe(true);
    expect(gdriveRw.canStar).toBe(true);
    expect(gdriveRw.canTrash).toBe(true);
    expect(gdriveRw.canWriteFiles).toBe(true);

    const gdriveRo = cloudProviderService.getCapabilities('GOOGLE_DRIVE', ['https://www.googleapis.com/auth/drive.readonly']);
    expect(gdriveRo.canWriteFiles).toBe(false);
    expect(gdriveRo.canTrash).toBe(false);
    expect(gdriveRo.canStar).toBe(false);

    const onedriveCaps = cloudProviderService.getCapabilities('ONE_DRIVE', ['Files.ReadWrite']);
    expect(onedriveCaps.canTrash).toBe(true);
    expect(onedriveCaps.canStar).toBe(false);
    expect(onedriveCaps.canExport).toBe(false);

    const dropboxCaps = cloudProviderService.getCapabilities('DROPBOX', ['files.content.write']);
    expect(dropboxCaps.canTrash).toBe(false);
    expect(dropboxCaps.canStar).toBe(false);
    expect(dropboxCaps.canExport).toBe(false);

    const boxCaps = cloudProviderService.getCapabilities('BOX', ['root_readwrite']);
    expect(boxCaps.canTrash).toBe(true);
    expect(boxCaps.canStar).toBe(false);
    expect(boxCaps.canExport).toBe(false);
  });

  it('queues multi-file requests in QuotaGovernor instead of failing immediately', async () => {
    const governor = new QuotaGovernor();
    const held = [
      governor.tryAcquire(99),
      governor.tryAcquire(99),
      governor.tryAcquire(99),
      governor.tryAcquire(99),
    ];
    expect(held.every((r) => r.granted)).toBe(true);
    expect(governor.tryAcquire(99).granted).toBe(false);

    setTimeout(() => {
      governor.release(99);
    }, 60);

    const fifth = await governor.acquireQueued(99, 2000);
    expect(fifth.granted).toBe(true);

    for (let i = 0; i < 4; i++) {
      governor.release(99);
    }
  });
});
