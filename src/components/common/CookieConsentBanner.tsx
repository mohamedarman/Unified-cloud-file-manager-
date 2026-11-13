import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, Lock, ExternalLink } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { useAuth } from '../../context/AuthContext';

export interface CookiePreferences {
  essential: boolean;
  performanceCache: boolean;
  timestamp: string;
}

export const CookieConsentBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { setCurrentTab } = useFileManager();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    try {
      const consent = localStorage.getItem('ucfm_cookie_consent');
      if (!consent) {
        const timer = setTimeout(() => setIsOpen(true), 400);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Unable to read cookie consent state:', e);
    }
  }, []);

  const persistPreferences = (performanceCache: boolean) => {
    const prefs: CookiePreferences = {
      essential: true,
      performanceCache,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem('ucfm_cookie_consent', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Unable to save cookie consent state:', e);
    }
    setIsOpen(false);
  };

  const handleAcceptAll = () => {
    persistPreferences(true);
  };

  const handleEssentialOnly = () => {
    persistPreferences(false);
  };

  const handleOpenPrivacyPolicy = () => {
    if (isAuthenticated) {
      setIsOpen(false);
      setCurrentTab('legal');
    } else {
      setShowPrivacyModal(true);
    }
  };

  if (!isOpen && !showPrivacyModal) return null;

  return (
    <>
      {isOpen && (
        <aside
          aria-label="Storage and Privacy Consent"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-4 sm:p-5 text-slate-900 dark:text-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs tracking-tight text-slate-900 dark:text-white">
                    Client-Side Storage & Privacy Notice
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Zero third-party tracking • Local device isolation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleEssentialOnly}
                aria-label="Dismiss cookie notice with essential only"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Unified Cloud File Manager utilizes local storage strictly for session credentials, directory caching, and user interface preferences. We do not use advertising trackers or sell personal data.
            </p>

            {showDetails && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-[10px] space-y-1.5 text-slate-600 dark:text-slate-400 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    <span>Essential Session Storage</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">Required</span>
                </div>
                <p>Maintains OAuth tokens, local account IDs, and multi-cloud isolation bounds.</p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Cookie className="w-3 h-3 text-blue-500" />
                    <span>Performance & Thumbnail Cache</span>
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">Optional</span>
                </div>
                <p>Speeds up directory navigation and offline searches on repeated loads.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  {showDetails ? 'Hide details' : 'Learn more'}
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleOpenPrivacyPolicy}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Privacy Policy</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Essential Only
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white shadow-xs transition cursor-pointer"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Privacy Policy"
          onClick={() => setShowPrivacyModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-slate-900 dark:text-slate-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base">Privacy Policy & Consent Governance</h3>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                aria-label="Close privacy policy modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
              <p>
                <strong>1. Local Storage & Session Isolation:</strong> Essential storage persists your encrypted PBKDF2-SHA256 credential vault, 24-hour session token, and per-user account preferences (`ucfm_cookie_consent`).
              </p>
              <p>
                <strong>2. Independent Provider Quotas:</strong> Unified Cloud File Manager is a client-side multi-account browser. It does not sell storage capacity or alter provider quota boundaries; all files and quotas remain governed by Google Drive, Microsoft OneDrive, Dropbox, or Box.
              </p>
              <p>
                <strong>3. Deterministic PII Redaction:</strong> Diagnostic logs pass through a client-side redactor that scrubs OAuth bearer tokens, email addresses, and file paths prior to display or storage.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPrivacyModal(false);
                  handleEssentialOnly();
                }}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrivacyModal(false);
                  handleAcceptAll();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Accept All & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
