import React from 'react';
import { ShieldCheck, FileText, Lock, CheckCircle, Scale, AlertCircle } from 'lucide-react';

export const LegalComplianceView: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6 text-blue-600" />
          <span>Privacy Policy & Legal Disclosures</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Compliance statements for Google Play Store, App Store, and GitHub Open Source Distribution
        </p>
      </div>

      <div className="max-w-3xl space-y-5 text-xs text-slate-700 leading-relaxed">
        {/* Important Storage Disclosure Banner */}
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-950">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span>Multi-Cloud Architecture Principle</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            <strong>Unified Cloud File Manager</strong> is an interface layer for managing authorized files across multiple cloud storage accounts (Google Drive, Microsoft OneDrive, Dropbox, and Box). It does not provide, pool, resell, or bypass any storage quotas. Storage remains owned, metered, and enforced exclusively by each respective provider.
          </p>
        </div>

        {/* Section 1: Google API Disclosure */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>1. Google API Services Limited Use Policy Compliance</span>
          </h3>
          <p>
            Unified Cloud File Manager's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline font-medium"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
            <li>We do not transfer user data to third parties.</li>
            <li>We do not use user data for advertising, machine learning models, or market research.</li>
            <li>All file requests are executed client-side via authorized OAuth tokens.</li>
          </ul>
        </div>

        {/* Section 2: Multi-Account Isolation */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <span>2. Strict Multi-Account Isolation Invariants</span>
          </h3>
          <p>
            Our architecture enforces cryptographic and organizational boundaries across connected accounts:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
            <li>Provider file IDs are partitioned by local account identity.</li>
            <li>Cache entries and tokens are never shared or crossed between accounts.</li>
            <li>When an account is disconnected, all cached metadata and tokens are permanently wiped.</li>
          </ul>
        </div>

        {/* Section 3: Telemetry & Redaction */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            <span>3. Zero-Telemetry & Client-Side Redaction</span>
          </h3>
          <p>
            The application operates entirely on your device. Debug and audit logs run through an automated regex scrubbing engine that irreversibly strips bearer tokens, sensitive emails, and file contents before any internal display.
          </p>
        </div>

        {/* Section 4: Terms of Service */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <h3 className="font-bold text-slate-900 text-sm">4. Terms of Service</h3>
          <p className="text-[11px] text-slate-600">
            By connecting cloud accounts to this platform, you certify that you own or are authorized to access the respective cloud credentials. You remain subject to each cloud provider’s respective Terms of Service and Acceptable Use policies.
          </p>
        </div>
      </div>
    </div>
  );
};
