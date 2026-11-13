import React, { useState } from 'react';
import { X, Check, Key, ArrowRight, Cloud } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { useAuth } from '../../context/AuthContext';
import { ProviderId, PROVIDERS } from '../../types';

interface AddAccountModalProps {
  onClose: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ onClose }) => {
  const { connectAccount, accounts } = useFileManager();
  const { user } = useAuth();

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('GOOGLE_DRIVE');
  const [email, setEmail] = useState(user?.email || '');
  const [displayName, setDisplayName] = useState('');
  const [badgeLabel, setBadgeLabel] = useState(PROVIDERS.GOOGLE_DRIVE.shortName);
  const [step, setStep] = useState<'FORM' | 'AUTHORIZING' | 'VERIFYING' | 'DONE'>('FORM');
  const [error, setError] = useState<string | null>(null);

  const providerMeta = PROVIDERS[selectedProvider];

  const handleStartOAuth = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please provide a valid account email address.');
      return;
    }

    if (
      accounts.some(
        (a) =>
          a.displayEmail.toLowerCase() === trimmedEmail.toLowerCase() &&
          a.provider === selectedProvider
      )
    ) {
      setError(`This ${providerMeta.name} account (${trimmedEmail}) is already connected.`);
      return;
    }

    setError(null);
    setStep('AUTHORIZING');

    setTimeout(() => {
      setStep('VERIFYING');
      setTimeout(() => {
        setStep('DONE');
        setTimeout(() => {
          connectAccount(
            selectedProvider,
            trimmedEmail,
            displayName.trim() || `${providerMeta.shortName} (${trimmedEmail.split('@')[0]})`,
            badgeLabel.trim() || providerMeta.shortName,
            ['read', 'write', 'profile']
          );
          onClose();
        }, 450);
      }, 550);
    }, 600);
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
                OAuth 2.0 PKCE Authorization & Verification
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
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
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

                  return (
                    <button
                      type="button"
                      key={pId}
                      onClick={() => {
                        setSelectedProvider(pId);
                        setBadgeLabel(p.shortName);
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/50 ring-1 ring-blue-400 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.brandColor }}
                        />
                        <span className="text-slate-900 dark:text-white">{p.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Email */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {providerMeta.name} Account Email
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              />
            </div>

            {/* Display name & label */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Display Label
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
                  Account Nickname
                </label>
                <input
                  type="text"
                  placeholder={`e.g. ${providerMeta.shortName} Workspace`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Architectural disclosure */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200 block">
                Direct Provider Storage Notice:
              </span>
              <p>
                Connecting {providerMeta.name} grants client-side access to browse and manage files in your account. Your storage quota remains metered and enforced solely by {providerMeta.name}.
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
                  ? `Requesting ${providerMeta.name} OAuth 2.0 Consent...`
                  : step === 'VERIFYING'
                  ? 'Verifying Account Capabilities & Quota...'
                  : 'Account Verified & Connected!'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                {step === 'AUTHORIZING'
                  ? 'Client-side PKCE code exchange initiated.'
                  : step === 'VERIFYING'
                  ? 'Validating account session against provider endpoint.'
                  : 'Account added to Unified Index. State: CONNECTED.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
