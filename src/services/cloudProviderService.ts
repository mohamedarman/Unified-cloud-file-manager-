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

export interface StoredTokenEntry {
  accessToken: string;
  refreshToken?: string;
  expiresAtMillis?: number;
  grantedScopes: string[];
  provider?: ProviderId;
  providerAccountId?: string;
  displayEmail?: string;
}

interface PendingPkceState {
  provider: ProviderId;
  badgeLabel: string;
  verifier: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}

export interface RemoteMutationRequest {
  operation: 'CREATE_FOLDER' | 'RENAME' | 'MOVE' | 'COPY' | 'TRASH' | 'RESTORE' | 'STAR';
  fileId: string | null;
  name?: string;
  targetFolderId?: string | null;
  starred?: boolean;
}

const TOKEN_STORAGE_PREFIX = 'ucfm_oauth_token_v2_';
const DELTA_TOKEN_PREFIX = 'ucfm_delta_cursor_v2_';
const PKCE_STATE_KEY = 'ucfm_pkce_state_v1';

/**
 * Generates accurate capabilities from a provider's real API support and granted OAuth scopes.
 * - Only Google Drive supports exporting workspace native documents (`canExport = true`).
 * - Dropbox API v2 metadata does not expose recoverable trash or native starred flags (`canTrash = false`, `canStar = false`).
 * - Read-only scopes disable all write/mutation flags (`canWriteFiles`, `canCreateFolders`, `canRename`, `canTrash`, `canStar`).
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
    canTrash: provider !== 'DROPBOX' && hasWrite,
    canSearch: true,
    canReadRevisions: true,
    canStar: provider === 'GOOGLE_DRIVE' && hasWrite,
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

function getNativeBridgeCapabilities(): Record<string, unknown> | null {
  if (typeof window === 'undefined' || !window.UnifiedCloudBridge?.getBridgeCapabilitiesJson) {
    return null;
  }
  try {
    return JSON.parse(window.UnifiedCloudBridge.getBridgeCapabilitiesJson()) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function isProviderOAuthConfigured(provider: ProviderId): boolean {
  const bridgeCaps = getNativeBridgeCapabilities();
  if (bridgeCaps) {
    if (provider === 'GOOGLE_DRIVE') return Boolean(bridgeCaps.googleClientIdConfigured);
    if (provider === 'ONE_DRIVE') return Boolean(bridgeCaps.oneDriveClientIdConfigured);
    if (provider === 'DROPBOX') return Boolean(bridgeCaps.dropboxClientIdConfigured);
    if (provider === 'BOX') return Boolean(bridgeCaps.boxClientIdConfigured);
  }
  if (getConfiguredClientId(provider)) {
    return true;
  }
  return provider === 'GOOGLE_DRIVE';
}

function generateSecureUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function generatePkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues || !cryptoObj?.subtle) {
    throw new Error('Web Crypto API is unavailable for PKCE challenge generation.');
  }
  const random = new Uint8Array(32);
  cryptoObj.getRandomValues(random);
  const verifier = Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
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
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`${TOKEN_STORAGE_PREFIX}${accountId}`, JSON.stringify(entry));
      } catch {
        // ignore storage quota errors
      }
    }
    if (typeof window === 'undefined') return;
    if (window.UnifiedCloudBridge?.storeAccountTokenJson && entry.provider) {
      try {
        window.UnifiedCloudBridge.storeAccountTokenJson(
          JSON.stringify({
            accountId,
            provider: entry.provider,
            providerAccountId: entry.providerAccountId || `acct_${accountId}`,
            displayEmail: entry.displayEmail || null,
            accessToken: entry.accessToken,
            refreshToken: entry.refreshToken || null,
            expiresAtMillis: entry.expiresAtMillis || 0,
            scopesCsv: entry.grantedScopes.join(','),
          })
        );
        return;
      } catch (e) {
        console.warn('Native Account token store warning:', e);
      }
    }
    if (window.UnifiedCloudBridge?.storeEncryptedToken) {
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

  public getTokenEntry(accountId: LocalAccountId): StoredTokenEntry | null {
    const inMem = this.tokensByAccount.get(accountId);
    if (inMem?.accessToken) return inMem;
    try {
      const raw = sessionStorage.getItem(`${TOKEN_STORAGE_PREFIX}${accountId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredTokenEntry;
        this.tokensByAccount.set(accountId, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public getTokenForAccount(accountId: LocalAccountId): string | null {
    return this.getTokenEntry(accountId)?.accessToken ?? null;
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

  public async refreshAccountToken(account: AccountRef): Promise<string | null> {
    const entry = this.getTokenEntry(account.localId);
    if (!entry?.refreshToken) {
      return entry?.accessToken ?? null;
    }

    const tokenData = await this.performRefreshGrant(account.provider, entry.refreshToken);
    if (!tokenData?.accessToken) {
      return null;
    }

    const updated: StoredTokenEntry = {
      ...entry,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || entry.refreshToken,
      expiresAtMillis: tokenData.expiresAtMillis || entry.expiresAtMillis,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      displayEmail: account.displayEmail,
    };
    this.storeTokenForAccount(account.localId, updated);
    return updated.accessToken;
  }

  private async ensureValidToken(account: AccountRef): Promise<string | null> {
    const entry = this.getTokenEntry(account.localId);
    if (!entry?.accessToken) return null;
    if (entry.expiresAtMillis && entry.expiresAtMillis > 0 && Date.now() > entry.expiresAtMillis - 60_000) {
      const refreshed = await this.refreshAccountToken(account);
      return refreshed || entry.accessToken;
    }
    return entry.accessToken;
  }

  public async authorizeAndVerifyAccount(
    provider: ProviderId,
    requestedScopes: string[],
    explicitAccessToken?: string,
    badgeLabel?: string
  ): Promise<VerifiedProviderAccount> {
    let accessToken = explicitAccessToken?.trim() || '';
    let refreshToken: string | undefined;
    let expiresAtMillis: number | undefined;

    if (!accessToken) {
      const isAndroidWebView =
        typeof window !== 'undefined' &&
        (window.location?.hostname === 'appassets.androidplatform.net' ||
          Boolean(window.UnifiedCloudBridge?.startExternalOAuthFlow));

      if (provider === 'GOOGLE_DRIVE' && !isAndroidWebView) {
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
        const canLaunchNative =
          typeof window !== 'undefined' && Boolean(window.UnifiedCloudBridge?.startExternalOAuthFlow);
        if (!clientId && !isProviderOAuthConfigured(provider)) {
          throw new Error(
            `Not configured: ${PROVIDERS[provider].name} OAuth 2.0 Client ID is not configured in this environment. Configure the Client ID or provide a live OAuth 2.0 Bearer access token.`
          );
        }
        if (!clientId && provider === 'GOOGLE_DRIVE' && isAndroidWebView) {
          throw new Error(
            'Embedded WebView OAuth popups are blocked by Google policy (RFC 8252). Configure GOOGLE_OAUTH_CLIENT_ID for system browser PKCE or provide a verified OAuth Bearer token.'
          );
        }

        const { verifier, challenge } = await generatePkceChallenge();
        const state = generateSecureUuid();
        const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
        const redirectUri = isAndroidWebView
          ? 'com.unifiedcloud.filemanager:/oauth2redirect'
          : `${origin}/`;

        const pkcePayload: PendingPkceState = {
          provider,
          badgeLabel: badgeLabel || PROVIDERS[provider].shortName,
          verifier,
          redirectUri,
          scopes: requestedScopes,
          state,
        };
        if (typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem(PKCE_STATE_KEY, JSON.stringify(pkcePayload));
          } catch {
            // ignore
          }
        }

        if (!clientId) {
          throw new Error(
            `Not configured: Client ID for ${PROVIDERS[provider].name} is not set in the web bundle. Paste a verified OAuth Bearer token or set VITE_*_CLIENT_ID.`
          );
        }

        const authUrl = this.buildPkceAuthorizationUrl(
          provider,
          clientId,
          redirectUri,
          requestedScopes,
          challenge,
          state
        );

        if (canLaunchNative && typeof window !== 'undefined' && window.UnifiedCloudBridge?.startExternalOAuthFlow) {
          const launched = window.UnifiedCloudBridge.startExternalOAuthFlow(authUrl);
          if (!launched) {
            throw new Error(`Unable to open Chrome Custom Tabs for ${PROVIDERS[provider].name}.`);
          }
          throw new Error(
            `Custom Tabs launched for ${PROVIDERS[provider].name} OAuth 2.0 + PKCE. Complete consent in your browser; authorization will complete on return.`
          );
        }

        if (typeof window !== 'undefined' && window.location) {
          window.location.assign(authUrl);
        }
        throw new Error(`Redirecting to ${PROVIDERS[provider].name} OAuth 2.0 + PKCE...`);
      }
    }

    const verified = await this.verifyLiveAccessToken(provider, accessToken, requestedScopes);
    return {
      ...verified,
      refreshToken,
      expiresAtMillis,
    };
  }

  /**
   * Consumes an OAuth 2.0 authorization code callback returned from Chrome Custom Tabs or
   * browser redirect, validates the PKCE state, exchanges code -> token, and verifies the live account.
   */
  public async completePendingOAuthCallback(): Promise<{
    account: VerifiedProviderAccount;
    badgeLabel: string;
  } | null> {
    if (typeof window === 'undefined') return null;

    let callbackUrlString: string | null = null;
    if (window.UnifiedCloudBridge?.consumePendingOAuthCallbackJson) {
      try {
        const raw = window.UnifiedCloudBridge.consumePendingOAuthCallbackJson();
        const parsed = JSON.parse(raw) as { hasCallback?: boolean; callbackUrl?: string };
        if (parsed.hasCallback && parsed.callbackUrl) {
          callbackUrlString = parsed.callbackUrl;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!callbackUrlString && window.location.search.includes('code=')) {
      callbackUrlString = window.location.href;
    }

    if (!callbackUrlString) return null;

    const url = new URL(callbackUrlString);
    const oauthError = url.searchParams.get('error');
    if (oauthError) {
      sessionStorage.removeItem(PKCE_STATE_KEY);
      throw new Error(`OAuth consent failed: ${url.searchParams.get('error_description') || oauthError}`);
    }

    const code = url.searchParams.get('code');
    if (!code) return null;

    const rawState = sessionStorage.getItem(PKCE_STATE_KEY);
    if (!rawState) return null;
    const saved = JSON.parse(rawState) as PendingPkceState;
    const returnedState = url.searchParams.get('state');
    if (returnedState && saved.state && returnedState !== saved.state) {
      sessionStorage.removeItem(PKCE_STATE_KEY);
      throw new Error('OAuth state mismatch rejected for security.');
    }

    sessionStorage.removeItem(PKCE_STATE_KEY);
    if (window.location.search.includes('code=')) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    const tokens = await this.exchangeAuthorizationCode(
      saved.provider,
      code,
      saved.verifier,
      saved.redirectUri
    );
    const verified = await this.verifyLiveAccessToken(saved.provider, tokens.accessToken, saved.scopes);
    return {
      account: {
        ...verified,
        refreshToken: tokens.refreshToken,
        expiresAtMillis: tokens.expiresAtMillis,
      },
      badgeLabel: saved.badgeLabel,
    };
  }

  private async exchangeAuthorizationCode(
    provider: ProviderId,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAtMillis?: number }> {
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.exchangeOAuthCodeJson) {
      const raw = window.UnifiedCloudBridge.exchangeOAuthCodeJson(
        provider,
        code,
        codeVerifier,
        redirectUri
      );
      const parsed = JSON.parse(raw) as {
        accessToken?: string;
        refreshToken?: string;
        expiresInSeconds?: number;
        expiresIn?: number;
        error?: string;
      };
      if (parsed.error || !parsed.accessToken) {
        throw new Error(parsed.error || 'Native OAuth code exchange failed.');
      }
      const ttlSeconds = parsed.expiresInSeconds ?? parsed.expiresIn;
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAtMillis: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      };
    }

    const endpoint = this.tokenEndpointFor(provider);
    const clientId = getConfiguredClientId(provider);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
      throw new Error(
        data?.error_description || data?.error || `Token exchange failed (HTTP ${res.status})`
      );
    }
    return {
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAtMillis: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
    };
  }

  private async performRefreshGrant(
    provider: ProviderId,
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAtMillis?: number } | null> {
    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.refreshOAuthTokenJson) {
      try {
        const raw = window.UnifiedCloudBridge.refreshOAuthTokenJson(provider, refreshToken);
        const parsed = JSON.parse(raw) as {
          accessToken?: string;
          refreshToken?: string;
          expiresInSeconds?: number;
          expiresIn?: number;
        };
        const ttlSeconds = parsed.expiresInSeconds ?? parsed.expiresIn;
        if (parsed.accessToken) {
          return {
            accessToken: parsed.accessToken,
            refreshToken: parsed.refreshToken,
            expiresAtMillis: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
          };
        }
      } catch {
        return null;
      }
    }

    const clientId = getConfiguredClientId(provider);
    if (!clientId) return null;
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      });
      const res = await fetch(this.tokenEndpointFor(provider), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.access_token) return null;
      return {
        accessToken: String(data.access_token),
        refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
        expiresAtMillis: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
      };
    } catch {
      return null;
    }
  }

  private tokenEndpointFor(provider: ProviderId): string {
    switch (provider) {
      case 'GOOGLE_DRIVE':
        return 'https://oauth2.googleapis.com/token';
      case 'ONE_DRIVE':
        return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      case 'DROPBOX':
        return 'https://api.dropboxapi.com/oauth2/token';
      case 'BOX':
        return 'https://api.box.com/oauth2/token';
    }
  }

  private buildPkceAuthorizationUrl(
    provider: ProviderId,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    codeChallenge: string,
    state: string
  ): string {
    const scopeStr = encodeURIComponent(scopes.join(' '));
    const stateParam = `&state=${encodeURIComponent(state)}`;
    switch (provider) {
      case 'GOOGLE_DRIVE':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeStr}&code_challenge=${codeChallenge}&code_challenge_method=S256&access_type=offline${stateParam}`;
      case 'ONE_DRIVE':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeStr}&code_challenge=${codeChallenge}&code_challenge_method=S256${stateParam}`;
      case 'DROPBOX':
        return `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&token_access_type=offline&code_challenge=${codeChallenge}&code_challenge_method=S256${stateParam}`;
      case 'BOX':
        return `https://account.box.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256${stateParam}`;
    }
  }

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
    const token = await this.ensureValidToken(account);
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
    const token = await this.ensureValidToken(account);
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
    const token = await this.ensureValidToken(account);
    if (!token) {
      return file.revisions || [];
    }

    if (account.provider === 'GOOGLE_DRIVE') {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.ref.fileId)}/revisions?fields=revisions(id,modifiedTime,size,lastModifyingUser(displayName,emailAddress))`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch Drive revisions (HTTP ${res.status})`);
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

    if (account.provider === 'ONE_DRIVE') {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(file.ref.fileId)}/versions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch OneDrive versions (HTTP ${res.status})`);
      }
      const data = await res.json();
      const versions = Array.isArray(data?.value) ? data.value : [];
      return versions.map((ver: Record<string, unknown>, idx: number) => {
        const modifiedByUser =
          ((ver.lastModifiedBy as { user?: { displayName?: string; email?: string } })?.user) || {};
        return {
          id: String(ver.id),
          modifiedTimeMillis: ver.lastModifiedDateTime
            ? new Date(String(ver.lastModifiedDateTime)).getTime()
            : Date.now(),
          sizeBytes: Number(ver.size ?? file.sizeBytes ?? 0),
          modifiedBy: modifiedByUser.displayName || modifiedByUser.email || account.displayEmail,
          label: idx === 0 ? 'Current Version' : `Version ${versions.length - idx}`,
        };
      });
    }

    if (account.provider === 'DROPBOX') {
      const res = await fetch('https://api.dropboxapi.com/2/files/list_revisions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.ref.fileId, mode: 'id', limit: 25 }),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch Dropbox revisions (HTTP ${res.status})`);
      }
      const data = await res.json();
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      return entries.map((entry: Record<string, unknown>, idx: number) => ({
        id: String(entry.rev || idx),
        modifiedTimeMillis: entry.server_modified
          ? new Date(String(entry.server_modified)).getTime()
          : Date.now(),
        sizeBytes: Number(entry.size ?? file.sizeBytes ?? 0),
        modifiedBy: account.displayEmail,
        label: idx === 0 ? 'Current Revision' : `Rev ${String(entry.rev || idx)}`,
      }));
    }

    const res = await fetch(
      `https://api.box.com/2.0/files/${encodeURIComponent(file.ref.fileId)}/versions`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch Box versions (HTTP ${res.status})`);
    }
    const data = await res.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    return entries.map((entry: Record<string, unknown>, idx: number) => {
      const modifiedBy = (entry.modified_by as { name?: string; login?: string }) || {};
      return {
        id: String(entry.id),
        modifiedTimeMillis: entry.modified_at
          ? new Date(String(entry.modified_at)).getTime()
          : Date.now(),
        sizeBytes: Number(entry.size ?? file.sizeBytes ?? 0),
        modifiedBy: modifiedBy.name || modifiedBy.login || account.displayEmail,
        label: `Version ${entries.length - idx}`,
      };
    });
  }

  public async syncAccountDelta(
    account: AccountRef
  ): Promise<{ latencyMs: number; files: CloudFile[] | null; quota: QuotaUsage | null }> {
    const started = performance.now();
    const token = await this.ensureValidToken(account);
    if (!token) {
      return {
        latencyMs: Math.max(1, Math.round(performance.now() - started)),
        files: null,
        quota: null,
      };
    }

    const cursorKey = `${DELTA_TOKEN_PREFIX}${account.localId}`;
    const savedCursor = typeof localStorage !== 'undefined' ? localStorage.getItem(cursorKey) : null;

    if (account.provider === 'GOOGLE_DRIVE') {
      if (!savedCursor) {
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
          `https://www.googleapis.com/drive/v3/changes?pageToken=${encodeURIComponent(savedCursor)}`,
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
    } else if (account.provider === 'ONE_DRIVE') {
      const deltaUrl = savedCursor || 'https://graph.microsoft.com/v1.0/me/drive/root/delta';
      const deltaRes = await fetch(deltaUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (deltaRes.ok) {
        const data = await deltaRes.json();
        const nextLink = data?.['@odata.deltaLink'] || data?.['@odata.nextLink'];
        if (nextLink) {
          localStorage.setItem(cursorKey, String(nextLink));
        }
      }
    } else if (account.provider === 'DROPBOX') {
      if (!savedCursor) {
        const cursorRes = await fetch(
          'https://api.dropboxapi.com/2/files/list_folder/get_latest_cursor',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path: '', recursive: false }),
          }
        );
        if (cursorRes.ok) {
          const data = await cursorRes.json();
          if (data?.cursor) {
            localStorage.setItem(cursorKey, String(data.cursor));
          }
        }
      } else {
        const contRes = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cursor: savedCursor }),
        });
        if (contRes.ok) {
          const data = await contRes.json();
          if (data?.cursor) {
            localStorage.setItem(cursorKey, String(data.cursor));
          }
        }
      }
    } else if (account.provider === 'BOX') {
      const streamPos = savedCursor || 'now';
      const eventsRes = await fetch(
        `https://api.box.com/2.0/events?stream_position=${encodeURIComponent(streamPos)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        if (data?.next_stream_position) {
          localStorage.setItem(cursorKey, String(data.next_stream_position));
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

  public async executeRemoteMutation(
    account: AccountRef,
    req: RemoteMutationRequest
  ): Promise<{ remoteId?: string }> {
    const token = await this.ensureValidToken(account);
    if (!token) {
      throw new Error(
        `Not available: Active OAuth 2.0 session for ${PROVIDERS[account.provider].name} required to sync "${req.operation}" remotely.`
      );
    }

    if (account.provider === 'GOOGLE_DRIVE') {
      return this.executeGoogleDriveMutation(token, req);
    }
    if (account.provider === 'ONE_DRIVE') {
      return this.executeOneDriveMutation(token, req);
    }
    if (account.provider === 'DROPBOX') {
      return this.executeDropboxMutation(token, req);
    }
    return this.executeBoxMutation(token, req);
  }

  private async executeGoogleDriveMutation(
    token: string,
    req: RemoteMutationRequest
  ): Promise<{ remoteId?: string }> {
    if (req.operation === 'CREATE_FOLDER') {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: req.name || 'New Folder',
          mimeType: 'application/vnd.google-apps.folder',
          ...(req.targetFolderId ? { parents: [req.targetFolderId] } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Google Drive create folder failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.id ? String(data.id) : undefined };
    }
    if (!req.fileId) throw new Error('Target fileId required');
    const encodedId = encodeURIComponent(req.fileId);

    if (req.operation === 'COPY') {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodedId}/copy?fields=id`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(req.name ? { name: req.name } : {}),
          ...(req.targetFolderId ? { parents: [req.targetFolderId] } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Google Drive copy failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.id ? String(data.id) : undefined };
    }

    if (req.operation === 'MOVE') {
      const parentsQuery = req.targetFolderId
        ? `?addParents=${encodeURIComponent(req.targetFolderId)}`
        : '';
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodedId}${parentsQuery}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Google Drive move failed (HTTP ${res.status})`);
      return {};
    }

    const patchBody: Record<string, unknown> = {};
    if (req.operation === 'RENAME') patchBody.name = req.name;
    if (req.operation === 'TRASH') patchBody.trashed = true;
    if (req.operation === 'RESTORE') patchBody.trashed = false;
    if (req.operation === 'STAR') patchBody.starred = Boolean(req.starred);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodedId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    });
    if (!res.ok) throw new Error(`Google Drive ${req.operation} failed (HTTP ${res.status})`);
    return {};
  }

  private async executeOneDriveMutation(
    token: string,
    req: RemoteMutationRequest
  ): Promise<{ remoteId?: string }> {
    if (req.operation === 'STAR') {
      throw new Error('Starring is not supported natively by Microsoft OneDrive.');
    }
    if (req.operation === 'CREATE_FOLDER') {
      const parentEndpoint = req.targetFolderId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(req.targetFolderId)}/children`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      const res = await fetch(parentEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: req.name || 'New Folder',
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }),
      });
      if (!res.ok) throw new Error(`OneDrive create folder failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.id ? String(data.id) : undefined };
    }
    if (!req.fileId) throw new Error('Target fileId required');
    const encodedId = encodeURIComponent(req.fileId);

    if (req.operation === 'TRASH') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`OneDrive trash failed (HTTP ${res.status})`);
      }
      return {};
    }
    if (req.operation === 'RESTORE') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodedId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`OneDrive restore failed (HTTP ${res.status})`);
      return {};
    }
    if (req.operation === 'COPY') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodedId}/copy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(req.name ? { name: req.name } : {}),
          ...(req.targetFolderId ? { parentReference: { id: req.targetFolderId } } : {}),
        }),
      });
      if (!res.ok && res.status !== 202) throw new Error(`OneDrive copy failed (HTTP ${res.status})`);
      return {};
    }

    const patchBody: Record<string, unknown> = {};
    if (req.operation === 'RENAME' && req.name) patchBody.name = req.name;
    if (req.operation === 'MOVE') {
      patchBody.parentReference = req.targetFolderId ? { id: req.targetFolderId } : { path: '/drive/root:' };
    }
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodedId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    });
    if (!res.ok) throw new Error(`OneDrive ${req.operation} failed (HTTP ${res.status})`);
    return {};
  }

  private async executeDropboxMutation(
    token: string,
    req: RemoteMutationRequest
  ): Promise<{ remoteId?: string }> {
    if (req.operation === 'TRASH' || req.operation === 'RESTORE' || req.operation === 'STAR') {
      throw new Error(`Dropbox does not support ${req.operation} natively.`);
    }
    if (req.operation === 'CREATE_FOLDER') {
      const folderPath = `${req.targetFolderId && req.targetFolderId.startsWith('/') ? req.targetFolderId : ''}/${req.name || 'New Folder'}`;
      const res = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: folderPath, autorename: true }),
      });
      if (!res.ok) throw new Error(`Dropbox create_folder_v2 failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.metadata?.id ? String(data.metadata.id) : undefined };
    }
    if (!req.fileId) throw new Error('Target fileId required');

    if (req.operation === 'COPY') {
      const baseDir = req.targetFolderId && req.targetFolderId.startsWith('/') ? req.targetFolderId : '';
      const res = await fetch('https://api.dropboxapi.com/2/files/copy_v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_path: req.fileId,
          to_path: `${baseDir}/${req.name || 'Copy'}`,
          autorename: true,
        }),
      });
      if (!res.ok) throw new Error(`Dropbox copy_v2 failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.metadata?.id ? String(data.metadata.id) : undefined };
    }

    const baseDir = req.targetFolderId && req.targetFolderId.startsWith('/') ? req.targetFolderId : '';
    const toPath =
      req.operation === 'RENAME'
        ? `${baseDir}/${req.name || 'Renamed'}`
        : `${baseDir}/${req.name || req.fileId.split('/').pop() || 'Item'}`;
    const res = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_path: req.fileId,
        to_path: toPath,
        autorename: true,
      }),
    });
    if (!res.ok) throw new Error(`Dropbox move_v2 failed (HTTP ${res.status})`);
    return {};
  }

  private async executeBoxMutation(
    token: string,
    req: RemoteMutationRequest
  ): Promise<{ remoteId?: string }> {
    if (req.operation === 'STAR') {
      throw new Error('Starring is not supported natively by Box.');
    }
    if (req.operation === 'CREATE_FOLDER') {
      const res = await fetch('https://api.box.com/2.0/folders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: req.name || 'New Folder',
          parent: { id: req.targetFolderId || '0' },
        }),
      });
      if (!res.ok) throw new Error(`Box create folder failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.id ? String(data.id) : undefined };
    }
    if (!req.fileId) throw new Error('Target fileId required');
    const encodedId = encodeURIComponent(req.fileId);

    if (req.operation === 'TRASH') {
      const res = await fetch(`https://api.box.com/2.0/files/${encodedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) throw new Error(`Box trash failed (HTTP ${res.status})`);
      return {};
    }
    if (req.operation === 'RESTORE') {
      const res = await fetch(`https://api.box.com/2.0/files/${encodedId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Box restore failed (HTTP ${res.status})`);
      return {};
    }
    if (req.operation === 'COPY') {
      const res = await fetch(`https://api.box.com/2.0/files/${encodedId}/copy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { id: req.targetFolderId || '0' },
          ...(req.name ? { name: req.name } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Box copy failed (HTTP ${res.status})`);
      const data = await res.json();
      return { remoteId: data?.id ? String(data.id) : undefined };
    }

    const body: Record<string, unknown> = {};
    if (req.operation === 'RENAME' && req.name) body.name = req.name;
    if (req.operation === 'MOVE') body.parent = { id: req.targetFolderId || '0' };
    const res = await fetch(`https://api.box.com/2.0/files/${encodedId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Box ${req.operation} failed (HTTP ${res.status})`);
    return {};
  }

  public async deleteRemotePermanently(account: AccountRef, file: CloudFile): Promise<void> {
    const token = await this.ensureValidToken(account);
    if (!token) {
      throw new Error(
        `Cannot permanently delete "${file.name}" from ${PROVIDERS[account.provider].name}: no active OAuth token.`
      );
    }

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
      return;
    }

    if (account.provider === 'ONE_DRIVE') {
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
      return;
    }

    if (account.provider === 'DROPBOX') {
      const res = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.ref.fileId }),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Permanent delete failed on Dropbox (HTTP ${res.status})`);
      }
      return;
    }

    const encodedId = encodeURIComponent(file.ref.fileId);
    const trashRes = await fetch(`https://api.box.com/2.0/files/${encodedId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!trashRes.ok && trashRes.status !== 404) {
      throw new Error(`Delete failed on Box (HTTP ${trashRes.status})`);
    }
    const purgeRes = await fetch(`https://api.box.com/2.0/files/${encodedId}/trash`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!purgeRes.ok && purgeRes.status !== 404) {
      throw new Error(`Permanent purge failed on Box (HTTP ${purgeRes.status})`);
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

    if (typeof window !== 'undefined' && window.UnifiedCloudBridge?.revokeAndPurgeAccount) {
      try {
        window.UnifiedCloudBridge.revokeAndPurgeAccount(account.localId);
      } catch {
        // ignore
      }
    }

    if (!token) return;

    if (account.provider === 'GOOGLE_DRIVE') {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Best-effort network revocation
      }
    } else if (account.provider === 'DROPBOX') {
      try {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort network revocation
      }
    } else if (account.provider === 'BOX') {
      const clientId = getConfiguredClientId('BOX');
      if (clientId) {
        try {
          const body = new URLSearchParams({ token, client_id: clientId });
          await fetch('https://api.box.com/oauth2/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });
        } catch {
          // Best-effort network revocation
        }
      }
    }
  }

  /**
   * Streams a real file upload to the connected cloud provider with byte progress and AbortSignal support.
   * Requires an authenticated OAuth 2.0 Bearer token — throws explicitly if missing rather than simulating success.
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

    const token = await this.ensureValidToken(account);
    if (!token) {
      throw new Error(
        `Upload requires an active OAuth 2.0 token for ${PROVIDERS[account.provider].name}. Reconnect this account in Accounts Center.`
      );
    }

    const total = file.size;
    if (total === 0) {
      onProgress(0, 0, 0);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startedAt = performance.now();

      const onAbort = () => {
        xhr.abort();
        reject(new DOMException('Transfer cancelled by user', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
        const transferred = Math.min(total, event.loaded);
        onProgress(transferred, total, Math.round(transferred / elapsedSec));
      };

      xhr.onload = () => {
        signal.removeEventListener('abort', onAbort);
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(total, total, 0);
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (account.provider === 'BOX' && Array.isArray(parsed?.entries) && parsed.entries[0]) {
              resolve({ remoteId: String(parsed.entries[0].id) });
              return;
            }
            resolve({
              remoteId: parsed?.id ? String(parsed.id) : undefined,
              webViewLink: parsed?.webViewLink || parsed?.webUrl,
            });
          } catch {
            resolve({});
          }
        } else {
          reject(new Error(`${PROVIDERS[account.provider].name} upload failed (HTTP ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error(`Network error during ${PROVIDERS[account.provider].name} upload`));
      };

      if (account.provider === 'GOOGLE_DRIVE') {
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
        const bodyBlob = new Blob([metaPart, file, `\r\n--${boundary}--`], {
          type: `multipart/related; boundary=${boundary}`,
        });
        xhr.open(
          'POST',
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'
        );
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(bodyBlob);
      } else if (account.provider === 'ONE_DRIVE') {
        const parentSegment = folderId
          ? `items/${encodeURIComponent(folderId)}:`
          : 'root:';
        xhr.open(
          'PUT',
          `https://graph.microsoft.com/v1.0/me/drive/${parentSegment}/${encodeURIComponent(file.name)}:/content`
        );
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      } else if (account.provider === 'DROPBOX') {
        const baseDir = folderId && folderId.startsWith('/') ? folderId : '';
        xhr.open('POST', 'https://content.dropboxapi.com/2/files/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader(
          'Dropbox-API-Arg',
          JSON.stringify({
            path: `${baseDir}/${file.name}`,
            mode: 'add',
            autorename: true,
          })
        );
        xhr.send(file);
      } else {
        const formData = new FormData();
        formData.append(
          'attributes',
          JSON.stringify({ name: file.name, parent: { id: folderId || '0' } })
        );
        formData.append('file', file, file.name);
        xhr.open('POST', 'https://upload.box.com/api/2.0/files/content');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      }
    });
  }

  /**
   * Streams download bytes from the connected cloud provider with real progress and AbortSignal.
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

    const token = account ? await this.ensureValidToken(account) : null;
    if (token) {
      const startedAt = performance.now();
      let response: Response;
      if (file.ref.provider === 'GOOGLE_DRIVE') {
        response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.ref.fileId)}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` }, signal }
        );
      } else if (file.ref.provider === 'ONE_DRIVE') {
        response = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(file.ref.fileId)}/content`,
          { headers: { Authorization: `Bearer ${token}` }, signal }
        );
      } else if (file.ref.provider === 'DROPBOX') {
        response = await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify({ path: file.ref.fileId }),
          },
          signal,
        });
      } else {
        response = await fetch(
          `https://api.box.com/2.0/files/${encodeURIComponent(file.ref.fileId)}/content`,
          { headers: { Authorization: `Bearer ${token}` }, signal }
        );
      }

      if (!response.ok) {
        throw new Error(`${PROVIDERS[file.ref.provider].name} download failed (HTTP ${response.status})`);
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
