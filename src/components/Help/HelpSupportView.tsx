import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { toast } from 'sonner';

export const HelpSupportView: React.FC = () => {
  const { accounts } = useFileManager();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  const faqs = [
    {
      q: 'How does Multi-Cloud Unified Management work?',
      a: 'The application acts as a client-side unified controller. When you connect your Google Drive, OneDrive, Dropbox, or Box accounts via OAuth 2.0 + PKCE, you can browse, upload, download, and search across all of them from a single workspace without mixing tokens or permissions.',
    },
    {
      q: 'Does this app provide or bypass cloud storage limits?',
      a: 'No. Storage remains strictly owned, metered, and enforced by each respective cloud provider. You use your existing storage quotas provided by Google One, Microsoft 365, Dropbox, or Box.',
    },
    {
      q: 'How do I run or package this app on Android?',
      a: 'On Android Chrome you can install the PWA via "Add to Home screen", or build the included Kotlin/Compose Android project (app/) which hosts the workspace with native Android Keystore token storage, Room offline persistence, WorkManager sync, and Chrome Custom Tabs OAuth.',
    },
    {
      q: 'What happens when I disconnect a cloud account?',
      a: 'In accordance with multi-account isolation rules, disconnecting an account revokes its OAuth token where supported and purges its cached credentials, file metadata, and offline pinned bytes from local storage.',
    },
    {
      q: 'Are my OAuth tokens sent to any third-party proxy server?',
      a: 'No. All OAuth authorization code exchanges and cloud API requests occur directly between your device and the respective provider endpoints (googleapis.com, graph.microsoft.com, dropboxapi.com, box.com).',
    },
  ];

  const handleCopyDiagnostics = async () => {
    const hasNativeBridge =
      typeof window !== 'undefined' &&
      Boolean((window as { UnifiedCloudBridge?: unknown }).UnifiedCloudBridge);

    const report = {
      app: 'Unified Cloud File Manager',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      nativeAndroidBridge: hasNativeBridge,
      connectedAccountsCount: accounts.length,
      providers: accounts.map((a) => ({ provider: a.provider, state: a.state })),
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      timestampIso: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopiedDiagnostics(true);
      toast.success('Non-sensitive client diagnostics copied to clipboard.');
      setTimeout(() => setCopiedDiagnostics(false), 2500);
    } catch {
      toast.error('Clipboard access unavailable in this browser context.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span>Help Center & Diagnostics</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Frequently asked questions, Android packaging architecture, and issue reporting
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* FAQs */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Frequently Asked Questions</span>
          </h3>

          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-3.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="p-3.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs leading-relaxed border-t border-slate-100 dark:border-slate-800">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Real Issue Reporting & Diagnostics */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Issue Reporting & Client Diagnostics</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This client runs serverless directly on your device with no support ticketing backend. You can copy sanitized client runtime diagnostics (without emails, tokens, or file names) or file an issue directly on GitHub.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void handleCopyDiagnostics()}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedDiagnostics ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Diagnostics Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Client Diagnostics</span>
                </>
              )}
            </button>

            <a
              href="https://github.com/mohamedarman/Unified-cloud-file-manager/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
            >
              <span>Open GitHub Issues</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
