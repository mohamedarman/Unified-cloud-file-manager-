import React, { useState } from 'react';
import {
  Cloud,
  Plus,
  Shield,
  Activity,
  DollarSign,
  Server,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Key,
  Calendar,
} from 'lucide-react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { StatusIndicator } from '../common/StatusIndicator';
import { CloudPlatform } from '../../types/infrastructure';
import { toast } from 'sonner';

export const CloudProvidersView: React.FC = () => {
  const { cloudAccounts, connectProvider } = useInfrastructure();
  const { setCurrentTab, accounts } = useFileManager();

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedNewProvider, setSelectedNewProvider] = useState<CloudPlatform>('AWS');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountId, setNewAccountId] = useState('');

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim() || !newAccountId.trim()) {
      toast.error('Please enter account name and identifier');
      return;
    }
    connectProvider(selectedNewProvider, newAccountName, newAccountId);
    setIsConnectModalOpen(false);
    setNewAccountName('');
    setNewAccountId('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cloud Providers & Tenant Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authorize, configure, and monitor connections across AWS, Azure, Google Cloud, and SaaS storage
          </p>
        </div>

        <button
          onClick={() => setIsConnectModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Connect Cloud Provider</span>
        </button>
      </div>

      {/* Cloud Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cloudAccounts.map((account) => (
          <div
            key={account.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <CloudProviderBadge provider={account.provider} showFullName />
                <StatusIndicator status={account.status} size="sm" showPulse />
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {account.displayName}
              </h3>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                Account ID / Tenant: {account.accountIdOrSub}
              </p>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Health Score</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {account.healthScore}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Active Assets</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {account.resourceCount} units
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Run Rate</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ${account.estimatedMonthlyCost}/mo
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px] font-mono">Region: {account.primaryRegion}</span>
              <button
                onClick={() => {
                  if (account.provider === 'GOOGLE_DRIVE') {
                    setCurrentTab('files');
                  } else {
                    setCurrentTab('infra_overview');
                  }
                }}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Inspect Fleet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Connect Provider Modal */}
      {isConnectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsConnectModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold">Connect Cloud Infrastructure Provider</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Establish cross-account IAM role, subscription, or project credentials
              </p>
            </div>

            <form onSubmit={handleAddAccount} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Provider Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['AWS', 'AZURE', 'GCP'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedNewProvider(p)}
                      className={`p-2.5 rounded-xl border text-center font-medium transition cursor-pointer ${
                        selectedNewProvider === p
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Account / Environment Name</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. AWS Secondary Staging us-west-2"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Account ID / Subscription / Project ID</label>
                <input
                  type="text"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                  placeholder="e.g. 9812-4410-0012 or prj-analytics-stg"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs transition"
                >
                  Establish Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
