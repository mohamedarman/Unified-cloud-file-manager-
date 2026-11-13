import React, { useState } from 'react';
import { X, Check, Key, ArrowRight, Cloud, ShieldAlert, Lock } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { ProviderId, PROVIDERS } from '../../types';
import { cloudProviderService } from '../../services/cloudProviderService';

interface AddAccountModalProps {
  onClose: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ onClose }) => {
  const { connectAccountWithOAuth } = useFileManager();

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('GOOGLE_DRIVE');
  const [badgeLabel, setBadgeLabel] = useState(PROVIDERS.GOOGLE_DRIVE.shortName);
  const [scopeMode, setScopeMode] = useState<'readwrite' | 'readonly'>('readwrite');
  const [bearerToken, setBearerToken] = useState('');
  const [step, setStep] = useState<'FORM' | 'AUTHORIZING' | 'DONE'>('FORM');
  const [error, setError] = useState<string | null>(null);

  const providerMeta = PROVIDERS[selectedProvider];
  const hasOAuthClientConfigured =
    selectedProvider === 'GOOGLE_DRIVE' ||
    cloudProviderService.isOAuthConfigured(selectedProvider);

  const handleStartOAuth = async () => {
    setError(null);
    const trimmedToken = bearerToken.trim();

    if (!hasOAuthClientConfigured && !trimmedToken) {
      setError(
        `Not available: ${providerMeta.name} OAuth 2.0 Client ID is not configured in environment variables (VITE_${selectedProvider}_CLIENT_ID). Provide a live OAuth 2.0 Bearer access token below or configure the client ID.`
      );
      return;
    }

    const grantedScopes =
      scopeMode === 'readwrite' ? ['read', 'write', 'profile'] : ['read', 'profile'];

    setStep('AUTHORIZING');
    try {
      await connectAccountWithOAuth(
        selectedProvider,
        badgeLabel.trim() || providerMeta.shortName,
        grantedScopes,
        trimmedToken || undefined
      );
      setStep('DONE');
      onClose();
    } catch (err: unknown) {
      setStep('FORM');
      setError(
        err instanceof Error
          ? err.message
          : `Failed to authorize ${providerMeta.name}. Verify your OAuth configuration or Bearer token.`
      );
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 text-slate-900 dark:text-slate-100 transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: providerMeta.brandColor }}
            >
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                Connect Cloud Account
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real OAuth 2.0 + PKCE Authorization & Live Quota Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'FORM' && (
          <div className="space-y-4">
            {/* 1. Provider Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Select Cloud Storage Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PROVIDERS) as ProviderId[]).map((pId) => {
                  const p = PROVIDERS[pId];
                  const isSelected = selectedProvider === pId;
                  const configured =
                    pId === 'GOOGLE_DRIVE' || cloudProviderService.isOAuthConfigured(pId);

                  return (
                    <button
                      type="button"
                      key={pId}
                      onClick={() => {
                        setSelectedProvider(pId);
                        setBadgeLabel(p.shortName);
                        setError(null);
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/50 ring-1 ring-blue-400 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: p.brandColor }}
                        />
                        <span className="text-slate-900 dark:text-white truncate">{p.name}</span>
                      </div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      ) : !configured ? (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                          Token/ID req
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Display Label & Scope Permission Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Display Badge Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Work, Personal"
                  value={badgeLabel}
                  onChange={(e) => setBadgeLabel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Requested OAuth Scope
                </label>
                <select
                  value={scopeMode}
                  onChange={(e) => setScopeMode(e.target.value as 'readwrite' | 'readonly')}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="readwrite">Full Read & Write</option>
                  <option value="readonly">Read-Only (Disable Writes)</option>
                </select>
              </div>
            </div>

            {/* 3. Optional / Direct OAuth 2.0 Bearer Access Token for live API verification */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>OAuth 2.0 Bearer Access Token (Optional for OAuth Popup / Direct Verify)</span>
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  {hasOAuthClientConfigured ? 'OAuth Client Ready' : 'Required without Client ID'}
                </span>
              </label>
              <input
                type="password"
                placeholder={`Paste live ${providerMeta.name} OAuth Bearer token or leave blank for OAuth flow`}
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Verified live against {providerMeta.name}&apos;s identity, quota, and file list endpoints before marking the account CONNECTED.
              </p>
            </div>

            {/* Architectural disclosure */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200 block">
                Direct Provider Storage & Token Vault Notice:
              </span>
              <p>
                Connecting {providerMeta.name} uses OAuth 2.0 + PKCE (never WebView password forms). Tokens are stored in the encrypted vault and revoked on disconnect. Storage quota remains metered solely by {providerMeta.name}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOAuth}
                className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Authorize {providerMeta.shortName}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step !== 'FORM' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
                style={{ backgroundColor: providerMeta.brandColor }}
              >
                {step === 'DONE' ? (
                  <Check className="w-8 h-8 animate-in zoom-in" />
                ) : (
                  <Key className="w-8 h-8 animate-pulse" />
                )}
              </div>
              {step !== 'DONE' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin bg-white" />
              )}
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                {step === 'AUTHORIZING'
                  ? `Verifying ${providerMeta.name} OAuth 2.0 Credentials & Live Quota...`
                  : 'Account Verified & Connected!'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                {step === 'AUTHORIZING'
                  ? 'Executing OAuth 2.0 PKCE handshake and querying provider quota endpoint.'
                  : 'Account verified against provider API and added to Unified Index.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
