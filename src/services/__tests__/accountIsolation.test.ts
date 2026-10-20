import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../authService';

// Mock localStorage for test environment
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

describe('Account Isolation and Database Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    authService.clearAllAuthData();
  });

  it('ensures new account starts with a genuine empty state', async () => {
    const reg = await authService.register('newuser@cloud.io', 'SecurePass123!', 'New User');
    const userId = reg.user.id;

    const filesKey = `ucfm_files_v2_${userId}`;
    const accountsKey = `ucfm_accounts_v2_${userId}`;

    // New account should not have any pre-existing files or accounts stored
    expect(localStorage.getItem(filesKey)).toBeNull();
    expect(localStorage.getItem(accountsKey)).toBeNull();
  });

  it('isolates records between Account A and Account B', async () => {
    // 1. Register Account A
    const accA = await authService.register('accounta@test.com', 'SecurePass123!', 'Account A');
    const idA = accA.user.id;

    // Simulate Account A creating a record
    const fileA = { id: 'file_a_1', name: 'SecretReport.pdf', size: 1024, isFolder: false };
    localStorage.setItem(`ucfm_files_v2_${idA}`, JSON.stringify([fileA]));

    // 2. Register / Switch to Account B
    const accB = await authService.register('accountb@test.com', 'SecurePass123!', 'Account B');
    const idB = accB.user.id;

    // Account B scoped storage should be empty (genuine empty state)
    const filesBStored = localStorage.getItem(`ucfm_files_v2_${idB}`);
    const filesB = filesBStored ? JSON.parse(filesBStored) : [];
    expect(filesB.length).toBe(0);

    // Account B cannot see Account A's file
    expect(filesB.some((f: any) => f.id === 'file_a_1')).toBe(false);

    // 3. Account A logs back in and recovers its original record after restart
    const loginA = await authService.authenticate('accounta@test.com', 'SecurePass123!');
    expect(loginA.user.id).toBe(idA);

    const restoredFilesA = JSON.parse(localStorage.getItem(`ucfm_files_v2_${idA}`) || '[]');
    expect(restoredFilesA.length).toBe(1);
    expect(restoredFilesA[0].id).toBe('file_a_1');
    expect(restoredFilesA[0].name).toBe('SecretReport.pdf');
  });
});
