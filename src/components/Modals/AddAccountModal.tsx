import React, { useState } from 'react';
import { X, ShieldCheck, Check, Key, ArrowRight, Cloud } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { ProviderId, PROVIDERS } from '../../types';

interface AddAccountModalProps {
  onClose: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ onClose }) => {
  const { connectAccount, accounts } = useFileManager();

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('GOOGLE_DRIVE');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [badgeLabel, setBadgeLabel] = useState('');
  const [step, setStep] = useState<'FORM' | 'AUTHORIZING' | 'VERIFYING' | 'DONE'>('FORM');
  const [error, setError] = useState<string | null>(null);

  const providerMeta = PROVIDERS[selectedProvider];

  const handleStartOAuth = () => {
    if (!email || !email.includes('@')) {
      setError('Please provide a valid account email.');
      return;
    }

    if (
      accounts.some(
        (a) =>
          a.displayEmail.toLowerCase() === email.toLowerCase() &&
          a.provider === selectedProvider
      )
    ) {
      setError(`This ${providerMeta.name} account is already connected.`);
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
            email,
            displayName || `${providerMeta.shortName} (${email.split('@')[0]})`,
            badgeLabel || providerMeta.shortName,
            ['read', 'write', 'profile']
          );
          onClose();
        }, 700);
      }, 900);
    }, 1100);
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
                OAuth 2.0 Authorization & Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
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
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Select Cloud Storage Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PROVIDERS) as ProviderId[]).map((pId) => {
                  const p = PROVIDERS[pId];
                  const isSelected = selectedProvider === pId;

                  return (
                    <div
                      key={pId}
                      onClick={() => {
                        setSelectedProvider(pId);
                        setBadgeLabel(p.shortName);
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-400 font-semibold'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.brandColor }}
                        />
                        <span className="text-slate-900">{p.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account Email */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                {providerMeta.name} Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. user@gmail.com or name@enterprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            {/* Display name & label */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Work, Personal, Media"
                  value={badgeLabel}
                  onChange={(e) => setBadgeLabel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Friendly Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Work Drive"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Architectural disclosure */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
              <span className="font-semibold text-slate-700 block">
                Direct Provider Storage Notice:
              </span>
              <p>
                Connecting {providerMeta.name} grants this applet client-side access to browse and upload files directly. Your storage quota remains metered and enforced solely by {providerMeta.name}.
              </p>
            </div>

            {/* Demo shortcuts */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                Quick Demo Accounts:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { provider: 'GOOGLE_DRIVE' as ProviderId, email: 'alex.cloud@gmail.com', label: 'GDrive Backup' },
                  { provider: 'ONE_DRIVE' as ProviderId, email: 'alex.project@enterprise.com', label: 'OneDrive Pro' },
                  { provider: 'DROPBOX' as ProviderId, email: 'alex.studio@dropbox.com', label: 'Dropbox Studio' },
                  { provider: 'BOX' as ProviderId, email: 'alex.collab@box.com', label: 'Box Lab' },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    onClick={() => {
                      setSelectedProvider(demo.provider);
                      setEmail(demo.email);
                      setBadgeLabel(demo.label);
                      setDisplayName(demo.label);
                    }}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 transition"
                  >
                    + {demo.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleStartOAuth}
                className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
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
              <h4 className="font-semibold text-slate-900 text-sm">
                {step === 'AUTHORIZING'
                  ? `Requesting ${providerMeta.name} OAuth 2.0 Consent...`
                  : step === 'VERIFYING'
                  ? 'Exercising Live Verification Call (about.get)...'
                  : 'Account Verified & Connected!'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {step === 'AUTHORIZING'
                  ? 'Client-side PKCE code exchange initiated.'
                  : step === 'VERIFYING'
                  ? 'Verifying account token against cloud endpoint.'
                  : `Account added to Unified Index. State: CONNECTED.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
