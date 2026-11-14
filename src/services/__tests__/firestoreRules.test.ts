import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isProviderOAuthConfigured } from '../cloudProviderService';

describe('Firestore Security Rules & Native OAuth Configuration Verification', () => {
  const rulesText = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

  afterEach(() => {
    delete window.UnifiedCloudBridge;
  });

  it('enforces authenticated user ownership and schema validation in firestore.rules', () => {
    expect(rulesText).toContain("rules_version = '2';");
    expect(rulesText).toContain('match /{document=**}');
    expect(rulesText).toContain('allow read, write: if false;');
    expect(rulesText).toContain('return request.auth != null;');
    expect(rulesText).toContain('return isAuthenticated() && request.auth.uid == userId;');
    expect(rulesText).toContain('data.uid == request.auth.uid');
    expect(rulesText).not.toMatch(/allow\s+read,\s*write:\s*if\s+true\b/);
    expect(rulesText).toContain('match /users/{userId}');
    expect(rulesText).toContain('isValidUserProfile(request.resource.data)');
    expect(rulesText).toContain('isValidAccount(request.resource.data)');
    expect(rulesText).toContain('isValidCloudFile(request.resource.data)');
    expect(rulesText).toContain('isValidQuota(request.resource.data)');
    expect(rulesText).toContain('isValidOperation(request.resource.data)');
    expect(rulesText).toContain('isValidAuditLog(request.resource.data)');
  });

  it('reports Not configured when native Android bridge reports empty OAuth client IDs', () => {
    window.UnifiedCloudBridge = {
      getBridgeCapabilitiesJson: () =>
        JSON.stringify({
          bridgeActive: true,
          googleClientIdConfigured: false,
          oneDriveClientIdConfigured: false,
          dropboxClientIdConfigured: false,
          boxClientIdConfigured: false,
        }),
    };

    expect(isProviderOAuthConfigured('GOOGLE_DRIVE')).toBe(false);
    expect(isProviderOAuthConfigured('ONE_DRIVE')).toBe(false);
    expect(isProviderOAuthConfigured('DROPBOX')).toBe(false);
    expect(isProviderOAuthConfigured('BOX')).toBe(false);
  });

  it('reports configured when native Android bridge supplies provider OAuth client IDs', () => {
    window.UnifiedCloudBridge = {
      getBridgeCapabilitiesJson: () =>
        JSON.stringify({
          bridgeActive: true,
          googleClientIdConfigured: true,
          oneDriveClientIdConfigured: true,
          dropboxClientIdConfigured: false,
          boxClientIdConfigured: true,
        }),
    };

    expect(isProviderOAuthConfigured('GOOGLE_DRIVE')).toBe(true);
    expect(isProviderOAuthConfigured('ONE_DRIVE')).toBe(true);
    expect(isProviderOAuthConfigured('DROPBOX')).toBe(false);
    expect(isProviderOAuthConfigured('BOX')).toBe(true);
  });
});
