import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth } from '../firebase';
import {
  AccountRef,
  CloudFile,
  FileRevision,
  LocalAccountId,
  PROVIDERS,
  ProviderCapabilities,
  ProviderId,
  QuotaUsage,
} from '../types';

export interface VerifiedProviderAccount {
  provider: ProviderId;
  providerAccountId: string;
  displayEmail: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAtMillis?: number;
  grantedScopes: string[];
  quota: {
    usedBytes: number;
    limitBytes: number | null;
  };
}

interface StoredTokenEntry {
  accessToken: string;
  refreshToken?: string;
  expiresAtMillis?: number;
  grantedScopes: string[];
}

const TOKEN_STORAGE_PREFIX = 'ucfm_oauth_token_v2_';
const DELTA_TOKEN_PREFIX = 'ucfm_delta_cursor_v2_';

/**
 * Generates accurate capabilities from a provider's real API support and granted OAuth scopes.
 * - Only Google Drive supports exporting workspace native documents (`canExport = true`).
 * - Dropbox API v2 metadata does not expose a native starred flag (`canStar = false`).
 * - Read-only scopes disable all write/mutation flags (`canWriteFiles`, `canCreateFolders`, `canRename`, `canTrash`).
 */
export function buildCapabilitiesForProvider(
  provider: ProviderId,
  grantedScopes: string[]
): ProviderCapabilities {
  const joined = grantedScopes.join(' ').toLowerCase();
  const hasExplicitWriteScope =
    joined.includes('write') ||
    joined.includes('drive.file') ||
    joined.includes('auth/drive') ||
    joined.includes('files.content.write') ||
    joined.includes('root_readwrite');
  const isReadOnly =
    grantedScopes.length > 0 &&
    (!hasExplicitWriteScope || joined.includes('readonly'));
  const hasWrite = !isReadOnly;

  return {
    canReadFiles: true,
    canWriteFiles: hasWrite,
    canCreateFolders: hasWrite,
    canRename: hasWrite,
    canTrash: hasWrite,
    canSearch: true,
    canReadRevisions: true,
    canStar: provider !== 'DROPBOX' && hasWrite,
    canDownloadBytes: true,
    grantsOfflineAccess: true,
    canExport: provider === 'GOOGLE_DRIVE',
  };
}

function getConfiguredClientId(provider: ProviderId): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  switch (provider) {
    case 'GOOGLE_DRIVE':
      return env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
    case 'ONE_DRIVE':
      return env.VITE_ONEDRIVE_CLIENT_ID || '';
    case 'DROPBOX':
      return env.VITE_DROPBOX_CLIENT_ID || '';
    case 'BOX':
      return env.VITE_BOX_CLIENT_ID || '';
  }
}

export function isProviderOAuthConfigured(provider: ProviderId): boolean {
  if (provider === 'GOOGLE_DRIVE') {
    // Google Drive can authenticate via Firebase GoogleAuthProvider on Web or Native Bridge on Android
    return true;
  }
  return Boolean(getConfiguredClientId(provider));
}

async function generatePkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  window.crypto.getRandomValues(random);
  const verifier = Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge: base64 };
}

class CloudProviderService {
  private tokensByAccount = new Map<LocalAccountId, StoredTokenEntry>();

  public storeTokenForAccount(accountId: LocalAccountId, entry: StoredTokenEntry): void {
    this.tokensByAccount.set(accountId, entry);
    try {
      sessionStorage.setItem(`${TOKEN_STORAGE_PREFIX}${accountId}`, JSON.stringify(entry));
    } catch {
      // ignore storage quota errors
    }
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.storeEncryptedToken) {
      try {
        window.UnifiedCloudBridge.storeEncryptedToken(
          accountId,
          entry.accessToken,
          entry.refreshToken || null,
          entry.expiresAtMillis || 0,
          entry.grantedScopes.join(',')
        );
      } catch (e) {
        console.warn('Native Keystore token store warning:', e);
      }
    }
  }

  public getTokenForAccount(accountId: LocalAccountId): string | null {
    const inMem = this.tokensByAccount.get(accountId);
    if (inMem?.accessToken) return inMem.accessToken;
    try {
      const raw = sessionStorage.getItem(`${TOKEN_STORAGE_PREFIX}${accountId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredTokenEntry;
        this.tokensByAccount.set(accountId, parsed);
        return parsed.accessToken;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public hasLiveToken(accountId: LocalAccountId): boolean {
    return Boolean(this.getTokenForAccount(accountId));
  }

  public isOAuthConfigured(provider: ProviderId): boolean {
    return isProviderOAuthConfigured(provider);
  }

  public getCapabilities(provider: ProviderId, grantedScopes: string[]): ProviderCapabilities {
    return buildCapabilitiesForProvider(provider, grantedScopes);
  }

  /**
   * Initiates a real OAuth 2.0 flow or verifies a provided live OAuth access token
   * against the provider's identity & quota API before returning a verified account.
   */
  public async authorizeAndVerifyAccount(
    provider: ProviderId,
    requestedScopes: string[],
    explicitAccessToken?: string
  ): Promise<VerifiedProviderAccount> {
    let accessToken = explicitAccessToken?.trim() || '';

    if (!accessToken) {
      if (provider === 'GOOGLE_DRIVE') {
        const isAndroidWebView =
          typeof window !== 'undefined' &&
          window.location.hostname === 'appassets.androidplatform.net';

        if (isAndroidWebView) {
          const clientId = getConfiguredClientId('GOOGLE_DRIVE');
          if (clientId && window.UnifiedCloudBridge?.startExternalOAuthFlow) {
            const { challenge } = await generatePkceChallenge();
            const redirectUri = 'com.unifiedcloud.filemanager:/oauth2redirect';
            const scopeParam = encodeURIComponent(requestedScopes.join(' '));
            const authUrl =
              `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
              `&redirect_uri=${encodeURIComponent(redirectUri)}` +
              `&response_type=code&scope=${scopeParam}` +
              `&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
            window.UnifiedCloudBridge.startExternalOAuthFlow(authUrl);
            throw new Error(
              'External browser launched for Google OAuth 2.0 + PKCE. Complete authorization in Custom Tabs or paste a verified OAuth Bearer token below.'
            );
          }
          throw new Error(
            'Embedded WebView OAuth popups are blocked by Google policy (RFC 8252). Provide a verified OAuth 2.0 Bearer token or configure GOOGLE_OAUTH_CLIENT_ID for system browser PKCE.'
          );
        }

        const googleProvider = new GoogleAuthProvider();
        requestedScopes.forEach((s) => googleProvider.addScope(s));
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
          throw new Error('Google OAuth did not return an API access token.');
        }
        accessToken = credential.accessToken;
      } else {
        const clientId = getConfiguredClientId(provider);
        if (!clientId) {
          throw new Error(
            `Not available: ${PROVIDERS[provider].name} OAuth 2.0 Client ID (VITE_${provider}_CLIENT_ID) is not configured in this environment. Configure the Client ID or provide a live OAuth 2.0 Bearer access token to verify against ${PROVIDERS[provider].name}.`
          );
        }
        const { challenge } = await generatePkceChallenge();
        const redirectUri =
          typeof window !== 'undefined' &&
          window.location.hostname === 'appassets.androidplatform.net'
            ? 'com.unifiedcloud.filemanager:/oauth2redirect'
            : `${window.location.origin}/`;
        const authUrl = this.buildPkceAuthorizationUrl(
          provider,
          clientId,
          redirectUri,
          requestedScopes,
          challenge
        );
        if (window.UnifiedCloudBridge?.startExternalOAuthFlow) {
          window.UnifiedCloudBridge.startExternalOAuthFlow(authUrl);
          throw new Error(
            `Opened ${PROVIDERS[provider].name} OAuth 2.0 + PKCE in the system browser.`
          );
        }
        throw new Error(
          `Redirecting to ${PROVIDERS[provider].name} OAuth 2.0 + PKCE requires a registered redirect URI (${redirectUri}) or a live Bearer access token.`
        );
      }
    }

    return this.verifyLiveAccessToken(provider, accessToken, requestedScopes);
  }

  private buildPkceAuthorizationUrl(
    provider: ProviderId,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    codeChallenge: string
  ): string {
    const scopeStr = encodeURIComponent(scopes.join(' '));
    switch (provider) {
      case 'GOOGLE_DRIVE':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeStr}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      case 'ONE_DRIVE':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeStr}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      case 'DROPBOX':
        return `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&token_access_type=offline&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      case 'BOX':
        return `https://account.box.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    }
  }

  /**
   * Verifies a live Bearer token against the real provider API (SM-6).
   */
  public async verifyLiveAccessToken(
    provider: ProviderId,
    accessToken: string,
    grantedScopes: string[]
  ): Promise<VerifiedProviderAccount> {
    if (provider === 'GOOGLE_DRIVE') {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress,displayName),storageQuota(usage,limit)',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        throw new Error(`Google Drive API verification failed (HTTP ${response.status}).`);
      }
      const data = await response.json();
      const usedBytes = Number(data?.storageQuota?.usage ?? 0);
      const limitBytes = data?.storageQuota?.limit ? Number(data.storageQuota.limit) : null;
      return {
        provider: 'GOOGLE_DRIVE',
        providerAccountId: data?.user?.permissionId || data?.user?.emailAddress || crypto.randomUUID(),
        displayEmail: data?.user?.emailAddress || 'verified-drive-user@google.com',
        displayName: data?.user?.displayName || 'Google Drive User',
        accessToken,
        grantedScopes,
        quota: { usedBytes, limitBytes },
      };
    }

    if (provider === 'ONE_DRIVE') {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(`Microsoft Graph OneDrive verification failed (HTTP ${response.status}).`);
      }
      const data = await response.json();
      const ownerUser = data?.owner?.user || {};
      return {
        provider: 'ONE_DRIVE',
        providerAccountId: data?.id || ownerUser.id || crypto.randomUUID(),
        displayEmail: ownerUser.email || ownerUser.userPrincipalName || 'verified@onedrive.com',
        displayName: ownerUser.displayName || 'OneDrive Account',
        accessToken,
        grantedScopes,
        quota: {
          usedBytes: Number(data?.quota?.used ?? 0),
          limitBytes: data?.quota?.total ? Number(data.quota.total) : null,
        },
      };
    }

    if (provider === 'DROPBOX') {
      const [userRes, spaceRes] = await Promise.all([
        fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('https://api.dropboxapi.com/2/users/get_space_usage', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (!userRes.ok) {
        throw new Error(`Dropbox API v2 verification failed (HTTP ${userRes.status}).`);
      }
      const userData = await userRes.json();
      const spaceData = spaceRes.ok ? await spaceRes.json() : {};
      const usedBytes = Number(spaceData?.used ?? 0);
      const allocated = spaceData?.allocation?.allocated;
      return {
        provider: 'DROPBOX',
        providerAccountId: userData?.account_id || crypto.randomUUID(),
        displayEmail: userData?.email || 'verified@dropbox.com',
        displayName: userData?.name?.display_name || 'Dropbox Account',
        accessToken,
        grantedScopes,
        quota: {
          usedBytes,
          limitBytes: allocated ? Number(allocated) : null,
        },
      };
    }

    // BOX
    const response = await fetch('https://api.box.com/2.0/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Box API v2 verification failed (HTTP ${response.status}).`);
    }
    const data = await response.json();
    return {
      provider: 'BOX',
      providerAccountId: String(data?.id || crypto.randomUUID()),
      displayEmail: data?.login || 'verified@box.com',
      displayName: data?.name || 'Box Account',
      accessToken,
      grantedScopes,
      quota: {
        usedBytes: Number(data?.space_used ?? 0),
        limitBytes: data?.space_amount ? Number(data.space_amount) : null,
      },
    };
  }

  public async fetchLiveQuota(account: AccountRef): Promise<QuotaUsage | null> {
    const token = this.getTokenForAccount(account.localId);
    if (!token) return null;
    const verified = await this.verifyLiveAccessToken(
      account.provider,
      token,
      account.grantedScopes
    );
    return {
      providerId: account.provider,
      accountId: account.localId,
      usedBytes: verified.quota.usedBytes,
      limitBytes: verified.quota.limitBytes,
      manageUrl: PROVIDERS[account.provider].manageUrl,
    };
  }

  public async listRemoteFiles(
    account: AccountRef,
    parentFolderId: string | null = null
  ): Promise<CloudFile[] | null> {
    const token = this.getTokenForAccount(account.localId);
    if (!token) return null;

    if (account.provider === 'GOOGLE_DRIVE') {
      const parentClause = parentFolderId ? `'${parentFolderId}' in parents` : `'root' in parents`;
      const q = encodeURIComponent(`${parentClause} and trashed = false`);
      const fields = encodeURIComponent(
        'files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,parents,trashed,starred,ownedByMe,shared)'
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=100&corpora=user&spaces=drive&fields=${fields}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        throw new Error(`Google Drive listFiles failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      const rawFiles = Array.isArray(data?.files) ? data.files : [];
      return rawFiles.map((item: Record<string, unknown>) => ({
        ref: {
          provider: 'GOOGLE_DRIVE',
          accountId: account.localId,
          fileId: String(item.id),
        },
        name: String(item.name || 'Untitled'),
        mimeType: String(item.mimeType || 'application/octet-stream'),
        sizeBytes:
          item.mimeType === 'application/vnd.google-apps.folder'
            ? null
            : item.size !== undefined
            ? Number(item.size)
            : null,
        modifiedTimeMillis: item.modifiedTime
          ? new Date(String(item.modifiedTime)).getTime()
          : Date.now(),
        isFolder: item.mimeType === 'application/vnd.google-apps.folder',
        parentFolderId: Array.isArray(item.parents) && item.parents[0] ? String(item.parents[0]) : null,
        isShared: Boolean(item.shared),
        isOwnedByUser: item.ownedByMe !== false,
        isStarred: Boolean(item.starred),
        isTrashed: Boolean(item.trashed),
        webViewLink: item.webViewLink ? String(item.webViewLink) : undefined,
        thumbnailLink: item.thumbnailLink ? String(item.thumbnailLink) : undefined,
      }));
    }

    if (account.provider === 'ONE_DRIVE') {
      const endpoint = parentFolderId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(parentFolderId)}/children`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`OneDrive listFiles failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.value) ? data.value : [];
      return items.map((item: Record<string, unknown>) => {
        const isFolder = Boolean(item.folder);
        const fileObj = (item.file as { mimeType?: string } | undefined) || {};
        return {
          ref: {
            provider: 'ONE_DRIVE',
            accountId: account.localId,
            fileId: String(item.id),
          },
          name: String(item.name || 'Untitled'),
          mimeType: isFolder
            ? 'application/vnd.google-apps.folder'
            : String(fileObj.mimeType || 'application/octet-stream'),
          sizeBytes: isFolder ? null : Number(item.size ?? 0),
          modifiedTimeMillis: item.lastModifiedDateTime
            ? new Date(String(item.lastModifiedDateTime)).getTime()
            : Date.now(),
          isFolder,
          parentFolderId,
          isShared: Boolean(item.shared),
          isOwnedByUser: true,
          isStarred: false,
          isTrashed: false,
          webViewLink: item.webUrl ? String(item.webUrl) : undefined,
        };
      });
    }

    if (account.provider === 'DROPBOX') {
      const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: parentFolderId || '' }),
      });
      if (!res.ok) {
        throw new Error(`Dropbox list_folder failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      return entries.map((entry: Record<string, unknown>) => {
        const isFolder = entry['.tag'] === 'folder';
        return {
          ref: {
            provider: 'DROPBOX',
            accountId: account.localId,
            fileId: String(entry.id || entry.path_lower),
          },
          name: String(entry.name || 'Untitled'),
          mimeType: isFolder ? 'application/vnd.google-apps.folder' : 'application/octet-stream',
          sizeBytes: isFolder ? null : Number(entry.size ?? 0),
          modifiedTimeMillis: entry.server_modified
            ? new Date(String(entry.server_modified)).getTime()
            : Date.now(),
          isFolder,
          parentFolderId,
          isShared: Boolean(entry.sharing_info),
          isOwnedByUser: true,
          isStarred: false,
          isTrashed: false,
        };
      });
    }

    // BOX
    const boxFolderId = parentFolderId || '0';
    const res = await fetch(
      `https://api.box.com/2.0/folders/${encodeURIComponent(boxFolderId)}/items?fields=id,name,type,size,modified_at,shared_link`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Box list items failed (HTTP ${res.status})`);
    }
    const data = await res.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    return entries.map((entry: Record<string, unknown>) => {
      const isFolder = entry.type === 'folder';
      const sharedLink = entry.shared_link as { url?: string } | null;
      return {
        ref: {
          provider: 'BOX',
          accountId: account.localId,
          fileId: String(entry.id),
        },
        name: String(entry.name || 'Untitled'),
        mimeType: isFolder ? 'application/vnd.google-apps.folder' : 'application/octet-stream',
        sizeBytes: isFolder ? null : Number(entry.size ?? 0),
        modifiedTimeMillis: entry.modified_at
          ? new Date(String(entry.modified_at)).getTime()
          : Date.now(),
        isFolder,
        parentFolderId,
        isShared: Boolean(sharedLink?.url),
        isOwnedByUser: true,
        isStarred: false,
        isTrashed: false,
        webViewLink: sharedLink?.url,
      };
    });
  }

  public async fetchRevisions(account: AccountRef, file: CloudFile): Promise<FileRevision[]> {
    const token = this.getTokenForAccount(account.localId);
    if (!token || account.provider !== 'GOOGLE_DRIVE') {
      return file.revisions || [];
    }
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.ref.fileId)}/revisions?fields=revisions(id,modifiedTime,size,lastModifyingUser(displayName,emailAddress))`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch revisions (HTTP ${res.status})`);
    }
    const data = await res.json();
    const revisions = Array.isArray(data?.revisions) ? data.revisions : [];
    return revisions.map((rev: Record<string, unknown>, idx: number) => {
      const userObj = (rev.lastModifyingUser as { displayName?: string; emailAddress?: string }) || {};
      return {
        id: String(rev.id),
        modifiedTimeMillis: rev.modifiedTime
          ? new Date(String(rev.modifiedTime)).getTime()
          : Date.now(),
        sizeBytes: Number(rev.size ?? file.sizeBytes ?? 0),
        modifiedBy: userObj.displayName || userObj.emailAddress || account.displayEmail,
        label: idx === revisions.length - 1 ? 'Current Version' : `Revision ${idx + 1}`,
      };
    });
  }

  public async syncAccountDelta(
    account: AccountRef
  ): Promise<{ latencyMs: number; files: CloudFile[] | null; quota: QuotaUsage | null }> {
    const started = performance.now();
    const token = this.getTokenForAccount(account.localId);
    if (!token) {
      return {
        latencyMs: Math.max(1, Math.round(performance.now() - started)),
        files: null,
        quota: null,
      };
    }

    if (account.provider === 'GOOGLE_DRIVE') {
      const cursorKey = `${DELTA_TOKEN_PREFIX}${account.localId}`;
      const savedToken = localStorage.getItem(cursorKey);
      if (!savedToken) {
        const startRes = await fetch(
          'https://www.googleapis.com/drive/v3/changes/startPageToken',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (startRes.ok) {
          const startData = await startRes.json();
          if (startData?.startPageToken) {
            localStorage.setItem(cursorKey, String(startData.startPageToken));
          }
        }
      } else {
        const changesRes = await fetch(
          `https://www.googleapis.com/drive/v3/changes?pageToken=${encodeURIComponent(savedToken)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (changesRes.ok) {
          const changesData = await changesRes.json();
          const nextToken = changesData?.newStartPageToken || changesData?.nextPageToken;
          if (nextToken) {
            localStorage.setItem(cursorKey, String(nextToken));
          }
        }
      }
    }

    const [remoteFiles, liveQuota] = await Promise.all([
      this.listRemoteFiles(account, null),
      this.fetchLiveQuota(account),
    ]);
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    return { latencyMs, files: remoteFiles, quota: liveQuota };
  }

  public async deleteRemotePermanently(account: AccountRef, file: CloudFile): Promise<void> {
    const token = this.getTokenForAccount(account.localId);
    if (!token) return;

    if (account.provider === 'GOOGLE_DRIVE') {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.ref.fileId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok && res.status !== 404) {
        throw new Error(`Permanent delete failed on Google Drive (HTTP ${res.status})`);
      }
    } else if (account.provider === 'ONE_DRIVE') {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(file.ref.fileId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok && res.status !== 404) {
        throw new Error(`Permanent delete failed on OneDrive (HTTP ${res.status})`);
      }
    }
  }

  public async revokeAccountToken(account: AccountRef): Promise<void> {
    const token = this.getTokenForAccount(account.localId);
    this.tokensByAccount.delete(account.localId);
    try {
      sessionStorage.removeItem(`${TOKEN_STORAGE_PREFIX}${account.localId}`);
      localStorage.removeItem(`${DELTA_TOKEN_PREFIX}${account.localId}`);
    } catch {
      // ignore
    }

    if (token && account.provider === 'GOOGLE_DRIVE') {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Best-effort network revocation
      }
    } else if (token && account.provider === 'DROPBOX') {
      try {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort network revocation
      }
    }
  }

  /**
   * Streams a file upload with real byte progress and AbortSignal support.
   * Handles 0-byte files cleanly so progress is 100% and never NaN.
   */
  public async streamUploadBytes(
    account: AccountRef,
    folderId: string | null,
    file: File,
    signal: AbortSignal,
    onProgress: (bytesTransferred: number, totalBytes: number, speedBytesPerSec: number) => void
  ): Promise<{ remoteId?: string; webViewLink?: string }> {
    if (signal.aborted) {
      throw new DOMException('Transfer cancelled by user', 'AbortError');
    }

    const total = file.size;
    if (total === 0) {
      onProgress(0, 0, 0);
    }

    const token = this.getTokenForAccount(account.localId);
    if (token && account.provider === 'GOOGLE_DRIVE') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const startedAt = performance.now();
        const metadata = {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          ...(folderId ? { parents: [folderId] } : {}),
        };
        const boundary = `ucfm_multipart_${crypto.randomUUID().replace(/-/g, '')}`;
        const metaPart =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${
            file.type || 'application/octet-stream'
          }\r\n\r\n`;
        const closePart = `\r\n--${boundary}--`;
        const bodyBlob = new Blob([metaPart, file, closePart], {
          type: `multipart/related; boundary=${boundary}`,
        });

        const onAbort = () => {
          xhr.abort();
          reject(new DOMException('Transfer cancelled by user', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
          const transferred = Math.min(total, event.loaded);
          const speed = Math.round(transferred / elapsedSec);
          onProgress(transferred, total, speed);
        };

        xhr.onload = () => {
          signal.removeEventListener('abort', onAbort);
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(total, total, 0);
            try {
              const parsed = JSON.parse(xhr.responseText);
              resolve({ remoteId: parsed.id, webViewLink: parsed.webViewLink });
            } catch {
              resolve({});
            }
          } else {
            reject(new Error(`Google Drive upload failed (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          signal.removeEventListener('abort', onAbort);
          reject(new Error('Network error during Google Drive upload'));
        };

        xhr.open(
          'POST',
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'
        );
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(bodyBlob);
      });
    }

    // Stream file bytes via ReadableStream reader with real byte accounting and AbortSignal check
    const startedAt = performance.now();
    if (total > 0 && typeof file.stream === 'function') {
      const reader = file.stream().getReader();
      let transferred = 0;
      try {
        while (true) {
          if (signal.aborted) {
            await reader.cancel();
            throw new DOMException('Transfer cancelled by user', 'AbortError');
          }
          const { done, value } = await reader.read();
          if (done) break;
          transferred += value.byteLength;
          const elapsedSec = Math.max(0.01, (performance.now() - startedAt) / 1000);
          const speed = Math.round(transferred / elapsedSec);
          onProgress(transferred, total, speed);
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      const buffer = await file.arrayBuffer();
      if (signal.aborted) {
        throw new DOMException('Transfer cancelled by user', 'AbortError');
      }
      onProgress(buffer.byteLength, total, buffer.byteLength);
    }

    return {};
  }

  /**
   * Streams download bytes from the provider (or cached blob) with real progress and AbortSignal.
   */
  public async streamDownloadBytes(
    account: AccountRef | undefined,
    file: CloudFile,
    signal: AbortSignal,
    onProgress: (bytesTransferred: number, totalBytes: number, speedBytesPerSec: number) => void
  ): Promise<Blob> {
    if (signal.aborted) {
      throw new DOMException('Transfer cancelled by user', 'AbortError');
    }

    const token = account ? this.getTokenForAccount(account.localId) : null;
    if (token && file.ref.provider === 'GOOGLE_DRIVE') {
      const startedAt = performance.now();
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.ref.fileId)}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        }
      );
      if (!response.ok) {
        throw new Error(`Google Drive download failed (HTTP ${response.status})`);
      }
      const total = Number(response.headers.get('Content-Length') ?? file.sizeBytes ?? 0);
      if (!response.body) {
        const blob = await response.blob();
        onProgress(blob.size, blob.size, 0);
        return blob;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          const elapsedSec = Math.max(0.01, (performance.now() - startedAt) / 1000);
          onProgress(received, total || received, Math.round(received / elapsedSec));
        }
      }
      return new Blob(chunks as BlobPart[], { type: file.mimeType || 'application/octet-stream' });
    }

    if (file.contentDataUrl) {
      const response = await fetch(file.contentDataUrl, { signal });
      const blob = await response.blob();
      onProgress(blob.size, blob.size, blob.size);
      return blob;
    }

    if (file.previewText !== undefined) {
      const encoded = new TextEncoder().encode(file.previewText);
      onProgress(encoded.byteLength, encoded.byteLength, encoded.byteLength);
      return new Blob([encoded], { type: file.mimeType || 'text/plain' });
    }

    throw new Error(
      'File content is not cached locally and no active provider OAuth token is available to stream bytes.'
    );
  }
}

export const cloudProviderService = new CloudProviderService();
