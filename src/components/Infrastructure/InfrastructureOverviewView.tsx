import React, { useState, useMemo } from 'react';
import {
  Server,
  Search,
  Filter,
  Layers,
  Power,
  RotateCcw,
  ArrowUpDown,
  ExternalLink,
  Cpu,
  HardDrive,
  Database,
  Network,
  Cloud,
  SlidersHorizontal,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudResource, ResourceType, CloudPlatform } from '../../types/infrastructure';
import { StatusIndicator } from '../common/StatusIndicator';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { ResourceDetailDrawer } from './ResourceDetailDrawer';
import { EmptyState } from '../common/EmptyState';
import { toast } from 'sonner';

interface InfrastructureOverviewViewProps {
  initialTypeFilter?: ResourceType | 'ALL';
}

export const InfrastructureOverviewView: React.FC<InfrastructureOverviewViewProps> = ({
  initialTypeFilter = 'ALL',
}) => {
  const {
    resources,
    selectedProviderFilter,
    setSelectedProviderFilter,
    selectedResource,
    setSelectedResource,
    toggleResourcePower,
  } = useInfrastructure();

  const { setCurrentTab } = useFileManager();

  const [activeTypeTab, setActiveTypeTab] = useState<ResourceType | 'ALL'>(initialTypeFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HEALTHY' | 'WARNING' | 'STOPPED'>('ALL');

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      // Type filter
      if (activeTypeTab !== 'ALL' && res.type !== activeTypeTab) return false;

      // Provider filter
      if (selectedProviderFilter !== 'ALL' && res.provider !== selectedProviderFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && res.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          res.name.toLowerCase().includes(q) ||
          res.region.toLowerCase().includes(q) ||
          (res.specs.instanceType && res.specs.instanceType.toLowerCase().includes(q)) ||
          (res.specs.ipAddress && res.specs.ipAddress.includes(q))
        );
      }

      return true;
    });
  }, [resources, activeTypeTab, selectedProviderFilter, statusFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Top Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 space-y-3 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Cloud Infrastructure Fleet
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compute nodes, storage volumes, managed databases, VPC networks and Kubernetes clusters
            </p>
          </div>

          {/* Quick jump to Cloud Storage Files */}
          <button
            onClick={() => setCurrentTab('files')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs transition cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-500" />
            <span>Open Storage Drive Files</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Sub-resource Segmented Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100 dark:border-slate-800 text-xs font-medium">
          {[
            { id: 'ALL', label: 'All Resources', icon: Layers },
            { id: 'COMPUTE', label: 'Compute & VMs', icon: Cpu },
            { id: 'KUBERNETES', label: 'Kubernetes', icon: Server },
            { id: 'DATABASE', label: 'Databases', icon: Database },
            { id: 'STORAGE', label: 'Object Storage', icon: HardDrive },
            { id: 'NETWORK', label: 'VPC & Networks', icon: Network },
          ].map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.id === 'ALL'
                ? resources.length
                : resources.filter((r) => r.type === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTypeTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                  activeTypeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    activeTypeTab === tab.id ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          {/* Search Input */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by resource name, IP, region, or machine type..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-850 border border-transparent focus:border-blue-500 text-slate-800 dark:text-slate-200 transition"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Provider Filter */}
            <select
              value={selectedProviderFilter}
              onChange={(e) => setSelectedProviderFilter(e.target.value as any)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 outline-none cursor-pointer transition shadow-2xs"
            >
              <option value="ALL">All Cloud Providers</option>
              <option value="AWS">Amazon Web Services</option>
              <option value="AZURE">Microsoft Azure</option>
              <option value="GCP">Google Cloud Platform</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 outline-none cursor-pointer transition shadow-2xs"
            >
              <option value="ALL">All States</option>
              <option value="HEALTHY">Healthy Only</option>
              <option value="WARNING">Warnings / Attention</option>
              <option value="STOPPED">Stopped</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Grid View */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredResources.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No matching cloud resources"
            description="No resources match the selected provider, type, or search query."
            action={{
              label: 'Reset Filters',
              onClick: () => {
                setActiveTypeTab('ALL');
                setSelectedProviderFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              },
            }}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Resource Name</th>
                  <th className="px-3 py-3">Provider & Region</th>
                  <th className="px-3 py-3">Type & Sizing</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 hidden md:table-cell">Utilization</th>
                  <th className="px-3 py-3 hidden sm:table-cell text-right">Est. Cost</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredResources.map((res) => (
                  <tr
                    key={res.id}
                    onClick={() => setSelectedResource(res)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60 cursor-pointer transition"
                  >
                    {/* Name & ID */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate max-w-[200px] sm:max-w-xs">
                          {res.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                          {res.id}
                        </p>
                      </div>
                    </td>

                    {/* Provider & Region */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <CloudProviderBadge provider={res.provider} size="sm" />
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                          {res.region}
                        </span>
                      </div>
                    </td>

                    {/* Type & Sizing */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {res.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                          {res.specs.instanceType ||
                            res.specs.engine ||
                            res.specs.clusterVersion ||
                            (res.specs.storageGb ? `${res.specs.storageGb} GB` : 'Standard')}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusIndicator status={res.status} size="sm" showPulse />
                    </td>

                    {/* Utilization Bar */}
                    <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">
                      {res.metrics.cpuUsagePercent !== undefined ? (
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-slate-400">CPU</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {res.metrics.cpuUsagePercent}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-750 rounded-full h-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                res.metrics.cpuUsagePercent > 80
                                  ? 'bg-rose-500'
                                  : res.metrics.cpuUsagePercent > 60
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${res.metrics.cpuUsagePercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* Cost */}
                    <td className="px-3 py-3 hidden sm:table-cell text-right whitespace-nowrap font-mono font-semibold text-slate-800 dark:text-slate-200">
                      ${res.costMonthly.toFixed(2)}/mo
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleResourcePower(res.id)}
                          className={`p-1.5 rounded-lg border transition ${
                            res.status === 'STOPPED'
                              ? 'border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600'
                          }`}
                          title={res.status === 'STOPPED' ? 'Start Instance' : 'Stop Instance'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSelectedResource(res)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                          title="Inspect Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Resource Detail Drawer */}
      <ResourceDetailDrawer
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
      />
    </div>
  );
};
