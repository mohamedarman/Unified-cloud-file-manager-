import { describe, it, expect, beforeEach } from 'vitest';
import { authService, AuthError } from '../authService';

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

describe('AuthService Cryptographic Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    authService.clearAllAuthData();
  });

  it('initializes default vault accounts', async () => {
    await authService.ensureVaultInitialized();
    const users = authService.getAvailableUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(users.some((u) => u.email === 'mohamedarman536@gmail.com')).toBe(true);
  });

  it('registers a new user successfully with strong password', async () => {
    const email = 'newuser@unifiedcloud.io';
    const password = 'StrongPassword123!';
    const name = 'New User';

    const { user, session } = await authService.register(email, password, name);

    expect(user.email).toBe(email);
    expect(user.name).toBe(name);
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

  it('authenticates valid credentials successfully', async () => {
    await authService.ensureVaultInitialized();

    const { user, session } = await authService.authenticate(
      'alex.morgan@enterprise.corp',
      'EnterpriseDemo2026!'
    );

    expect(user.email).toBe('alex.morgan@enterprise.corp');
    expect(session.token).toBeDefined();
  });

  it('rejects invalid password with generic AuthError', async () => {
    await authService.ensureVaultInitialized();

    await expect(
      authService.authenticate('alex.morgan@enterprise.corp', 'WrongPassword123!')
    ).rejects.toThrow(AuthError);
  });

  it('validates active session and restores user session', async () => {
    const { session } = await authService.authenticateWithGoogle(
      'testgoogle@gmail.com',
      'Google User'
    );

    const restored = await authService.validateSession(JSON.stringify(session));
    expect(restored).not.toBeNull();
    expect(restored?.user.email).toBe('testgoogle@gmail.com');
    expect(restored?.session.token).toBe(session.token);
  });

  it('handles logout and clears session', async () => {
    await authService.authenticateWithGoogle('logout@gmail.com');
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
