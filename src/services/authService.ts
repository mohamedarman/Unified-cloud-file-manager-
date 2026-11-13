/**
 * Authentication and Session Validation Service
 *
 * Implements:
 * - RFC 5322 email validation and strong password policy validation
 * - Local SVG initials avatar generation (never sends user names or emails to external avatar APIs)
 * - Cryptographically random UUID identifiers via `crypto.randomUUID()`
 * - Verified OAuth identity binding (`authenticateFromVerifiedOAuth`) requiring a verified token/uid
 * - PBKDF2-HMAC-SHA256 local credential verification for offline/test environments
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  createdAt: number;
  lastLoginAt?: number;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface VerifiedOAuthIdentity {
  uid: string;
  email: string;
  displayName?: string | null;
  idToken: string;
  photoUrl?: string | null;
}

interface StoredUserRecord {
  id: string;
  email: string; // normalized lowercase
  name: string;
  saltHex: string;
  passwordHashHex: string;
  iterations: number;
  provider: 'google' | 'email';
  createdAt: number;
  lastLoginAt?: number;
}

const STORAGE_KEY_VAULT = 'ucfm_auth_vault_v1';
const STORAGE_KEY_SESSION = 'ucfm_active_session_v1';
const PBKDF2_ITERATIONS = 100_000;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Cryptography API is not available in this runtime environment.');
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();
  const passwordKey = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return bufferToHex(derivedBits);
}

function generateRandomBytes(length: number): Uint8Array {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

function generateSecureToken(): string {
  return `ses_${getCrypto().randomUUID()}`;
}

/**
 * Generates a self-contained SVG data URI avatar with the user's initials locally.
 * Never transmits user names or emails to external services like api.dicebear.com.
 */
export function generateLocalInitialsAvatar(name: string, provider: 'google' | 'email'): string {
  const parts = (name || 'U').trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0]?.slice(0, 2) || 'U').toUpperCase();
  const bg = provider === 'google' ? '#1a73e8' : '#0284c7';
  const safeInitials = initials.replace(/[^A-Z0-9]/g, '') || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="38" font-weight="600">${safeInitials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export class AuthError extends Error {
  constructor(message: string, public readonly code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
  }
}

class AuthService {
  private vaultInitialized = false;

  public validateEmail(email: string): string {
    const trimmed = (email || '').trim().toLowerCase();
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      throw new AuthError('Please enter a valid email address.', 'INVALID_EMAIL');
    }
    if (trimmed.length > 254) {
      throw new AuthError('Email address exceeds maximum length.', 'EMAIL_TOO_LONG');
    }
    return trimmed;
  }

  public validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new AuthError('Password must be at least 8 characters long.', 'WEAK_PASSWORD');
    }
    if (password.length > 128) {
      throw new AuthError(
        'Password exceeds maximum allowable length (128 characters).',
        'PASSWORD_TOO_LONG'
      );
    }
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

    if (!hasLower || !hasUpper || !hasNumberOrSymbol) {
      throw new AuthError(
        'Password must contain uppercase, lowercase, and at least one number or symbol.',
        'WEAK_PASSWORD'
      );
    }
  }

  private loadVault(): Map<string, StoredUserRecord> {
    const map = new Map<string, StoredUserRecord>();
    try {
      const data = localStorage.getItem(STORAGE_KEY_VAULT);
      if (data) {
        const records: StoredUserRecord[] = JSON.parse(data);
        records.forEach((r) => map.set(r.email, r));
      }
    } catch (e) {
      console.warn('Failed to parse user vault, initializing new store:', e);
    }
    return map;
  }

  private saveVault(vault: Map<string, StoredUserRecord>): void {
    try {
      const records = Array.from(vault.values());
      localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to persist user vault:', e);
      throw new AuthError('Failed to store account credentials securely.', 'STORAGE_FAILURE');
    }
  }

  public async ensureVaultInitialized(): Promise<void> {
    if (this.vaultInitialized) return;
    this.vaultInitialized = true;
  }

  public async register(
    rawEmail: string,
    rawPassword: string,
    rawName: string,
    firebaseUid?: string
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    await this.ensureVaultInitialized();

    const email = this.validateEmail(rawEmail);
    this.validatePassword(rawPassword);

    const name = (rawName || '').trim();
    if (!name || name.length < 2) {
      throw new AuthError('Please enter a display name (at least 2 characters).', 'INVALID_NAME');
    }

    const vault = this.loadVault();
    if (vault.has(email) && !firebaseUid) {
      throw new AuthError(
        'An account with this email address is already registered.',
        'DUPLICATE_EMAIL'
      );
    }

    const salt = generateRandomBytes(16);
    const passwordHashHex = await derivePasswordHash(rawPassword, salt);
    const userId = firebaseUid || `usr_${getCrypto().randomUUID()}`;

    const newRecord: StoredUserRecord = {
      id: userId,
      email,
      name,
      saltHex: bufferToHex(salt.buffer),
      passwordHashHex,
      iterations: PBKDF2_ITERATIONS,
      provider: 'email',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    vault.set(email, newRecord);
    this.saveVault(vault);

    const authUser = this.toAuthUser(newRecord);
    const session = this.createSession(userId);

    return { user: authUser, session };
  }

  public async authenticate(
    rawEmail: string,
    rawPassword: string
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    await this.ensureVaultInitialized();

    const email = this.validateEmail(rawEmail);
    if (!rawPassword) {
      throw new AuthError('Password is required.', 'MISSING_PASSWORD');
    }

    const vault = this.loadVault();
    const record = vault.get(email);

    if (!record) {
      throw new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const salt = hexToUint8Array(record.saltHex);
    const calculatedHashHex = await derivePasswordHash(rawPassword, salt, record.iterations);

    if (!timingSafeEqualHex(calculatedHashHex, record.passwordHashHex)) {
      throw new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    record.lastLoginAt = Date.now();
    vault.set(email, record);
    this.saveVault(vault);

    const authUser = this.toAuthUser(record);
    const session = this.createSession(record.id);

    return { user: authUser, session };
  }

  /**
   * Binds a verified Firebase Auth / Google OAuth identity (requiring uid + idToken + email).
   * Rejects any attempt to create a session from an unverified email string.
   */
  public async authenticateFromVerifiedOAuth(
    identity: VerifiedOAuthIdentity | null | undefined
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    await this.ensureVaultInitialized();

    if (!identity || !identity.uid || !identity.idToken || !identity.email) {
      throw new AuthError(
        'Verified OAuth identity (uid, idToken, and email) is required.',
        'UNVERIFIED_OAUTH_IDENTITY'
      );
    }

    const email = this.validateEmail(identity.email);
    const vault = this.loadVault();
    let record = vault.get(email);

    if (!record) {
      const name = (identity.displayName || email.split('@')[0]).trim();
      const salt = generateRandomBytes(16);
      const passwordHashHex = await derivePasswordHash(identity.idToken, salt);

      record = {
        id: identity.uid,
        email,
        name: name || 'Google User',
        saltHex: bufferToHex(salt.buffer),
        passwordHashHex,
        iterations: PBKDF2_ITERATIONS,
        provider: 'google',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };
      vault.set(email, record);
      this.saveVault(vault);
    } else {
      record.id = identity.uid;
      record.lastLoginAt = Date.now();
      vault.set(email, record);
      this.saveVault(vault);
    }

    const authUser = this.toAuthUser(record);
    const session = this.createSession(record.id);

    return { user: authUser, session };
  }

  public async validateSession(
    explicitToken?: string | null
  ): Promise<{ user: AuthUser; session: AuthSession } | null> {
    await this.ensureVaultInitialized();

    try {
      const sessionJson = explicitToken
        ? explicitToken
        : localStorage.getItem(STORAGE_KEY_SESSION);

      if (!sessionJson) return null;

      let session: AuthSession;
      try {
        session = JSON.parse(sessionJson);
      } catch {
        this.clearSession();
        return null;
      }

      if (!session.token || !session.userId || !session.expiresAt) {
        this.clearSession();
        return null;
      }

      if (Date.now() >= session.expiresAt) {
        this.clearSession();
        return null;
      }

      const vault = this.loadVault();
      let matchingRecord: StoredUserRecord | null = null;
      for (const rec of vault.values()) {
        if (rec.id === session.userId) {
          matchingRecord = rec;
          break;
        }
      }

      if (!matchingRecord) {
        this.clearSession();
        return null;
      }

      return {
        user: this.toAuthUser(matchingRecord),
        session,
      };
    } catch (e) {
      console.error('Session validation error:', e);
      this.clearSession();
      return null;
    }
  }

  public async switchAccount(
    targetUserId: string
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    await this.ensureVaultInitialized();

    const vault = this.loadVault();
    let matchingRecord: StoredUserRecord | null = null;
    for (const rec of vault.values()) {
      if (rec.id === targetUserId) {
        matchingRecord = rec;
        break;
      }
    }

    if (!matchingRecord) {
      throw new AuthError('Requested account is not registered on this device.', 'ACCOUNT_NOT_FOUND');
    }

    matchingRecord.lastLoginAt = Date.now();
    vault.set(matchingRecord.email, matchingRecord);
    this.saveVault(vault);

    const authUser = this.toAuthUser(matchingRecord);
    const session = this.createSession(matchingRecord.id);

    return { user: authUser, session };
  }

  public getAvailableUsers(): AuthUser[] {
    const vault = this.loadVault();
    return Array.from(vault.values()).map((r) => this.toAuthUser(r));
  }

  public logout(): void {
    this.clearSession();
  }

  public clearAllAuthData(): void {
    localStorage.removeItem(STORAGE_KEY_VAULT);
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem('ucfm_auth_user');
    this.vaultInitialized = false;
  }

  private createSession(userId: string): AuthSession {
    const session: AuthSession = {
      token: generateSecureToken(),
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
    };
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      const vault = this.loadVault();
      for (const rec of vault.values()) {
        if (rec.id === userId) {
          localStorage.setItem('ucfm_auth_user', JSON.stringify(this.toAuthUser(rec)));
          break;
        }
      }
    } catch (e) {
      console.error('Failed to store session in localStorage:', e);
    }
    return session;
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem('ucfm_auth_user');
    } catch (e) {
      console.error('Failed to clear session from localStorage:', e);
    }
  }

  private toAuthUser(record: StoredUserRecord): AuthUser {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      provider: record.provider,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
      avatarUrl: generateLocalInitialsAvatar(record.name, record.provider),
    };
  }
}

export const authService = new AuthService();
