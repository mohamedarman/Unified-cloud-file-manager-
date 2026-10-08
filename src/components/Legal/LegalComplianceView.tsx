import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Lock,
  Scale,
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Printer,
  ChevronRight,
  RefreshCw,
  Globe,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';

type LegalTab = 'privacy' | 'terms' | 'providers';

export const LegalComplianceView: React.FC = () => {
  const getTabFromHash = (): LegalTab => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.toLowerCase();
      if (h.includes('terms')) return 'terms';
      if (h.includes('provider')) return 'providers';
      if (h.includes('privacy')) return 'privacy';
    }
    return 'privacy';
  };

  const [activeTab, setActiveTab] = useState<LegalTab>(getTabFromHash);

  React.useEffect(() => {
    const handleHash = () => {
      setActiveTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const switchTab = (tab: LegalTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${tab}`;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPolicy = () => {
    const text = `UNIFIED CLOUD FILE MANAGER - PRIVACY POLICY & TERMS OF SERVICE\nLast Updated: October 8, 2026\n\nPrivacy Policy and Terms can be viewed online at https://unified-cloud-file-manager.app/#/legal\nContact: privacy@unified-cloud-file-manager.app`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unified-cloud-privacy-and-terms.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Legal document exported successfully.');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Legal, Privacy & Compliance Hub</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified compliance disclosures, privacy agreements, terms of service, and provider API policies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            aria-label="Print legal documentation"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportPolicy}
            aria-label="Export legal disclosures text"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Document</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => switchTab('privacy')}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
            activeTab === 'privacy'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Privacy Policy</span>
        </button>

        <button
          onClick={() => switchTab('terms')}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
            activeTab === 'terms'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Terms of Service</span>
        </button>

        <button
          onClick={() => switchTab('providers')}
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
            activeTab === 'providers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Cloud Provider Disclosures</span>
        </button>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl space-y-6">
        {/* Core Storage Invariant Banner */}
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-950 dark:text-blue-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Multi-Cloud Architecture Principle (Non-Storage Entity)</span>
          </div>
          <p className="text-xs leading-relaxed text-blue-900 dark:text-blue-300">
            <strong>Unified Cloud File Manager</strong> functions strictly as a client-side interface orchestrator for managing authorized files across third-party cloud storage accounts (Google Drive, Microsoft OneDrive, Dropbox, and Box). It does not provide, pool, resell, expand, or bypass storage quotas. Storage remains owned, metered, and enforced exclusively by each respective cloud provider.
          </p>
        </div>

        {/* TAB 1: PRIVACY POLICY */}
        {activeTab === 'privacy' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 text-slate-700 dark:text-slate-300 text-xs leading-relaxed transition-colors">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 block mb-1">
                Transparency & Data Protection
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Privacy Policy
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Effective Date: October 8, 2026 • Version 1.2
              </p>
            </div>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                1. Overview & Data Minimization
              </h4>
              <p>
                Unified Cloud File Manager is committed to zero-knowledge privacy. The application is designed to operate primarily on the client device. We do not maintain centralized user databases of your uploaded files, passwords, or document contents.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                2. Data We Process & Store
              </h4>
              <p>
                When you use Unified Cloud File Manager, the following data is processed and stored strictly within your local browser storage:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>
                  <strong>OAuth Credentials:</strong> Scoped OAuth access and refresh tokens acquired when you authorize cloud accounts. These are stored locally and are used exclusively to make direct API calls to each cloud provider.
                </li>
                <li>
                  <strong>Directory Metadata Cache:</strong> File names, IDs, sizes, MIME types, timestamps, and thumbnail URLs are temporarily cached in browser storage to enable instantaneous search and offline queuing.
                </li>
                <li>
                  <strong>User Preferences:</strong> Theme settings (light, dark, system), view modes (grid or list), and sorting preferences.
                </li>
              </ul>
              <p className="text-slate-600 dark:text-slate-400">
                We do <strong>not</strong> collect advertising identifiers, tracking pixels, or keystrokes.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                3. Multi-Account Isolation Invariants
              </h4>
              <p>
                Our architecture enforces cryptographic and organizational boundaries across all connected accounts:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>
                  <strong>Deterministic Account Partitioning:</strong> Provider file IDs are paired with a strictly validated local account identity. Files from Account A are never addressable or queryable with tokens from Account B.
                </li>
                <li>
                  <strong>No Cross-Account Token Sharing:</strong> Cloud API requests always transmit the token corresponding exactly to the file's originating account.
                </li>
                <li>
                  <strong>Immediate Deletion on Disconnect:</strong> When you disconnect an account, all associated cached metadata, file records, and OAuth tokens are immediately and irreversibly purged from local storage.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                4. Google API Services User Data Policy Compliance
              </h4>
              <p>
                Unified Cloud File Manager's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline font-medium inline-flex items-center gap-0.5"
                >
                  <span>Google API Services User Data Policy</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                , including the Limited Use requirements.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>We do not transfer your Google Drive data to any third parties.</li>
                <li>We do not use your Google Drive data for advertising or marketing.</li>
                <li>We do not use your Google Drive data to train machine learning or artificial intelligence models.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                5. Your Rights (GDPR, CCPA, and Global Privacy)
              </h4>
              <p>
                Depending on your jurisdiction, you have full control over your personal data:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>
                  <strong>Right to Access:</strong> You can view all cached metadata directly in the Accounts Center and File Browser.
                </li>
                <li>
                  <strong>Right to Erasure:</strong> You can delete all locally cached data at any time via Settings &gt; "Factory Reset All Local Data".
                </li>
                <li>
                  <strong>Right to Revoke:</strong> You can revoke application access directly from your cloud provider's account security dashboard (e.g. Google Account Permissions, Microsoft Apps).
                </li>
              </ul>
            </section>

            <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                6. Contact & Data Protection Officer
              </h4>
              <p>
                For questions regarding this Privacy Policy or data protection practices, please contact us at:
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                Email: privacy@unified-cloud-file-manager.app<br />
                Security Inquiries: security@unified-cloud-file-manager.app
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: TERMS OF SERVICE */}
        {activeTab === 'terms' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 text-slate-700 dark:text-slate-300 text-xs leading-relaxed transition-colors">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 block mb-1">
                Legal Agreement
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Terms of Service
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Effective Date: October 8, 2026 • Version 1.2
              </p>
            </div>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                1. Acceptance of Terms
              </h4>
              <p>
                By accessing or using Unified Cloud File Manager ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the Service.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                2. Ownership of Cloud Credentials & Authorized Use
              </h4>
              <p>
                You represent and warrant that you are the lawful owner of, or possess all necessary permissions and authorizations to connect and manage, any cloud storage accounts you authenticate within the Service. You remain bound by each respective cloud provider's Terms of Service and Acceptable Use policies.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                3. Non-Storage Provision Representation
              </h4>
              <p>
                Unified Cloud File Manager does not provide, resell, lease, combine, or expand file storage capacity. The Service is an orchestration and interface client. You acknowledge that all storage quotas, bandwidth limitations, and file retention terms are governed entirely by your third-party cloud providers.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                4. Prohibited Uses
              </h4>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>Transmit, store, or share malware, spyware, or illegal content.</li>
                <li>Attempt to bypass or circumvent provider rate limits, quotas, or API authentication controls.</li>
                <li>Reverse-engineer or exploit the application interface to access unauthorized user accounts.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                5. Disclaimer of Warranties & Limitation of Liability
              </h4>
              <p>
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE DEVELOPERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA OR INTERRUPTED NETWORK OPERATIONS.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                6. Termination & Account Removal
              </h4>
              <p>
                You may cease using the Service at any time by disconnecting your cloud accounts or wiping local application data through the Settings menu.
              </p>
            </section>
          </div>
        )}

        {/* TAB 3: PROVIDER DISCLOSURES */}
        {activeTab === 'providers' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6 text-slate-700 dark:text-slate-300 text-xs leading-relaxed transition-colors">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 block mb-1">
                Third-Party Platform Disclosures
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cloud Provider Integrations
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Statements and integration boundaries for supported cloud ecosystems
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Google Drive API Integration</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Operates using scoped OAuth 2.0 (e.g. <code>drive.file</code>, <code>drive.readonly</code>). Respects user privacy and Google Limited Use restrictions.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span>Microsoft OneDrive (Graph API)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Connects through Microsoft Identity Platform. All tokens are partitioned per tenant and account ID.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>Dropbox API</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Standard OAuth 2.0 client flow with short-lived tokens and refresh tokens.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Box Platform API</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  User-authorized access scoped strictly to approved enterprise and personal folders.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
