import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseService } from '../databaseService';
import { cloudProviderService } from '../cloudProviderService';
import { AccountRef, AccountState, CloudFile, PendingOperation } from '../../types';

const memoryStore: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => memoryStore[k] ?? null,
    setItem: (k: string, v: string) => {
      memoryStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete memoryStore[k];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    },
  },
  writable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: (k: string) => memoryStore[`ss:${k}`] ?? null,
    setItem: (k: string, v: string) => {
      memoryStore[`ss:${k}`] = String(v);
    },
    removeItem: (k: string) => {
      delete memoryStore[`ss:${k}`];
    },
    clear: () => {
      Object.keys(memoryStore)
        .filter((k) => k.startsWith('ss:'))
        .forEach((k) => delete memoryStore[k]);
    },
  },
  writable: true,
});

function makeAccount(provider: AccountRef['provider'], localId = 1): AccountRef {
  return {
    localId,
    provider,
    providerAccountId: `${provider}_sub_1`,
    displayEmail: 'tester@example.com',
    displayName: `${provider} Tester`,
    badgeLabel: provider,
    color: '#2563EB',
    state: AccountState.CONNECTED,
    grantedScopes: ['write', 'files.content.write', 'root_readwrite'],
    lastVerifiedAt: Date.now(),
  };
}

function makeFile(provider: AccountRef['provider'], localId = 1, fileId = 'file_123'): CloudFile {
  return {
    ref: { provider, accountId: localId, fileId },
    name: 'quarterly-report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    modifiedTimeMillis: Date.now(),
    parentFolderId: null,
    isFolder: false,
    isStarred: false,
    isTrashed: false,
    isShared: false,
    isOwnedByUser: true,
  };
}

describe('CloudProviderService & DatabaseService Truthfulness', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects unauthenticated Firestore writes instead of silently failing', async () => {
    const account = makeAccount('GOOGLE_DRIVE');
    const pendingOp: PendingOperation = {
      id: 1,
      accountId: 1,
      operation: 'CREATE_FOLDER',
      fileId: null,
      fileName: 'New Folder',
      payload: JSON.stringify({ name: 'New Folder' }),
      state: 'QUEUED',
      createdAt: Date.now(),
      lastAttemptAt: null,
      attemptCount: 0,
      outcomeUncertain: false,
    };

    await expect(databaseService.saveAccount(account)).rejects.toThrow(/not authenticated/i);
    await expect(databaseService.saveOperation(pendingOp)).rejects.toThrow(/not authenticated/i);
  });

  it('never simulates uploads or remote mutations when an OAuth token is absent', async () => {
    const acc = makeAccount('GOOGLE_DRIVE', 77);
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    await expect(
      cloudProviderService.streamUploadBytes(
        acc,
        null,
        file,
        new AbortController().signal,
        () => {}
      )
    ).rejects.toThrow(/OAuth 2\.0 token/i);

    await expect(
      cloudProviderService.executeRemoteMutation(acc, {
        operation: 'CREATE_FOLDER',
        fileId: null,
        name: 'Audit',
      })
    ).rejects.toThrow(/Active OAuth 2\.0 session/i);
  });

  it('issues real provider REST calls for Google Drive, OneDrive, Dropbox, and Box mutations and deletes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'remote_99', name: 'Renamed.pdf' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const gdrive = makeAccount('GOOGLE_DRIVE', 101);
    cloudProviderService.storeTokenForAccount(101, {
      accessToken: 'tok_gd',
      grantedScopes: gdrive.grantedScopes,
    });
    await cloudProviderService.executeRemoteMutation(gdrive, {
      operation: 'RENAME',
      fileId: 'gd_1',
      name: 'Renamed.pdf',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/gd_1',
      expect.objectContaining({ method: 'PATCH' })
    );

    const dropbox = makeAccount('DROPBOX', 102);
    cloudProviderService.storeTokenForAccount(102, {
      accessToken: 'tok_dbx',
      grantedScopes: dropbox.grantedScopes,
    });
    await cloudProviderService.deleteRemotePermanently(dropbox, makeFile('DROPBOX', 102, '/docs/a.pdf'));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/2/files/delete_v2',
      expect.objectContaining({ method: 'POST' })
    );

    const onedrive = makeAccount('ONE_DRIVE', 103);
    cloudProviderService.storeTokenForAccount(103, {
      accessToken: 'tok_od',
      grantedScopes: onedrive.grantedScopes,
    });
    await cloudProviderService.deleteRemotePermanently(onedrive, makeFile('ONE_DRIVE', 103, 'od_item_1'));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/items/od_item_1',
      expect.objectContaining({ method: 'DELETE' })
    );

    const box = makeAccount('BOX', 104);
    cloudProviderService.storeTokenForAccount(104, {
      accessToken: 'tok_box',
      grantedScopes: box.grantedScopes,
    });
    await cloudProviderService.deleteRemotePermanently(box, makeFile('BOX', 104, 'box_file_1'));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.box.com/2.0/files/box_file_1/trash',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
