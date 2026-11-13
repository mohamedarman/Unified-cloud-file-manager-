import { describe, it, expect, beforeEach } from 'vitest';
import { authService, AuthError, generateLocalInitialsAvatar } from '../authService';

// Mock localStorage for Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AuthService Cryptographic Authentication & Security', () => {
  beforeEach(() => {
    localStorage.clear();
    authService.clearAllAuthData();
  });

  it('initializes clean vault with zero demo or pre-seeded accounts', async () => {
    await authService.ensureVaultInitialized();
    const users = authService.getAvailableUsers();
    expect(users.length).toBe(0);
  });

  it('generates local data-URI SVG avatar without calling api.dicebear.com', () => {
    const avatar = generateLocalInitialsAvatar('Mohamed Arman', 'email');
    expect(avatar.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(avatar).not.toContain('dicebear.com');
    expect(decodeURIComponent(avatar)).toContain('MA');
  });

  it('registers a new user successfully with strong password and local avatar', async () => {
    const email = 'newuser@unifiedcloud.io';
    const password = 'StrongPassword123!';
    const name = 'New User';

    const { user, session } = await authService.register(email, password, name);

    expect(user.email).toBe(email);
    expect(user.name).toBe(name);
    expect(user.avatarUrl).toMatch(/^data:image\/svg\+xml/);
    expect(user.avatarUrl).not.toContain('dicebear.com');
    expect(session.token).toBeDefined();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects weak passwords on registration', async () => {
    await expect(
      authService.register('weak@unifiedcloud.io', 'weak', 'Weak User')
    ).rejects.toThrow(AuthError);
  });

  it('rejects duplicate email registration', async () => {
    const email = 'duplicate@unifiedcloud.io';
    await authService.register(email, 'SecurePass123!', 'First User');

    await expect(
      authService.register(email, 'AnotherPass123!', 'Second User')
    ).rejects.toThrow(AuthError);
  });

  it('authenticates registered user credentials successfully', async () => {
    await authService.register('verified@enterprise.io', 'EnterpriseAuth2026!', 'Verified User');

    const { user, session } = await authService.authenticate(
      'verified@enterprise.io',
      'EnterpriseAuth2026!'
    );

    expect(user.email).toBe('verified@enterprise.io');
    expect(session.token).toBeDefined();
  });

  it('rejects invalid password with generic AuthError', async () => {
    await authService.register('verified@enterprise.io', 'EnterpriseAuth2026!', 'Verified User');

    await expect(
      authService.authenticate('verified@enterprise.io', 'WrongPassword123!')
    ).rejects.toThrow(AuthError);
  });

  it('rejects OAuth authentication when verified uid or idToken is missing', async () => {
    await expect(
      authService.authenticateFromVerifiedOAuth({
        uid: '',
        email: 'unverified@gmail.com',
        idToken: '',
      })
    ).rejects.toThrow(AuthError);
  });

  it('validates active session from verified OAuth credentials and restores user session', async () => {
    const { session } = await authService.authenticateFromVerifiedOAuth({
      uid: 'firebase_uid_12345',
      email: 'testgoogle@gmail.com',
      displayName: 'Google User',
      idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.verified_id_token_payload',
    });

    const restored = await authService.validateSession(JSON.stringify(session));
    expect(restored).not.toBeNull();
    expect(restored?.user.email).toBe('testgoogle@gmail.com');
    expect(restored?.session.token).toBe(session.token);
  });

  it('handles logout and clears session', async () => {
    await authService.authenticateFromVerifiedOAuth({
      uid: 'firebase_uid_logout',
      email: 'logout@gmail.com',
      displayName: 'Logout User',
      idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.verified_logout_token',
    });
    expect(localStorage.getItem('ucfm_active_session_v1')).not.toBeNull();

    authService.logout();
    expect(localStorage.getItem('ucfm_active_session_v1')).toBeNull();

    const restored = await authService.validateSession();
    expect(restored).toBeNull();
  });

  it('switches between multiple registered accounts', async () => {
    const reg1 = await authService.register('user1@test.com', 'SecurePass123!', 'User One');
    const reg2 = await authService.register('user2@test.com', 'SecurePass123!', 'User Two');

    expect(reg1.user.id).not.toBe(reg2.user.id);

    // Switch back to user1
    const switched = await authService.switchAccount(reg1.user.id);
    expect(switched.user.email).toBe('user1@test.com');
    expect(switched.session.userId).toBe(reg1.user.id);
  });
});
