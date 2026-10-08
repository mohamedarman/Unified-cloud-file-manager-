import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, Check, Lock, ExternalLink } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';

export interface CookiePreferences {
  essential: boolean;
  performanceCache: boolean;
  timestamp: string;
}

export const CookieConsentBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { setCurrentTab } = useFileManager();

  useEffect(() => {
    const consent = localStorage.getItem('ucfm_cookie_consent');
    if (!consent) {
      // Delay slightly to prevent layout jump on immediate mount
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const prefs: CookiePreferences = {
      essential: true,
      performanceCache: true,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('ucfm_cookie_consent', JSON.stringify(prefs));
    setIsOpen(false);
  };

  const handleEssentialOnly = () => {
    const prefs: CookiePreferences = {
      essential: true,
      performanceCache: false,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('ucfm_cookie_consent', JSON.stringify(prefs));
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Storage and Privacy Consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
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
            onClick={handleEssentialOnly}
            aria-label="Dismiss cookie notice with essential only"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
          Unified Cloud File Manager utilizes local browser storage strictly for session credentials, directory caching, and user interface preferences. We do not use advertising trackers or sell personal data.
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
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
            >
              {showDetails ? 'Hide details' : 'Learn more'}
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={() => {
                setIsOpen(false);
                setCurrentTab('legal');
              }}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Privacy Policy</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={handleEssentialOnly}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              Essential Only
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white shadow-xs transition cursor-pointer"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
