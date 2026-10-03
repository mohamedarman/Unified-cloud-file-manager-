import React, { useState } from 'react';
import {
  X,
  Power,
  RotateCcw,
  ExternalLink,
  Cpu,
  HardDrive,
  Network,
  Shield,
  Clock,
  DollarSign,
  Tag,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Radio,
  FileCode,
  Share2,
  Server,
  Database,
  ArrowRight,
} from 'lucide-react';
import { CloudResource } from '../../types/infrastructure';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { StatusIndicator } from '../common/StatusIndicator';
import { CloudProviderBadge } from '../common/CloudProviderBadge';

interface ResourceDetailDrawerProps {
  resource: CloudResource | null;
  onClose: () => void;
  onSelectRelatedResource?: (resource: CloudResource) => void;
}

export const ResourceDetailDrawer: React.FC<ResourceDetailDrawerProps> = ({
  resource,
  onClose,
  onSelectRelatedResource,
}) => {
  const { toggleResourcePower, rebootResource, logs, resources } = useInfrastructure();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'config' | 'metrics' | 'networking' | 'security' | 'related' | 'logs'
  >('overview');

  if (!resource) return null;

  const resourceLogs = logs.filter(
    (l) => l.resourceName === resource.name || l.provider === resource.provider
  );

  // Find related resources based on VPC, provider, or type
  const relatedResources = resources.filter(
    (r) =>
      r.id !== resource.id &&
      (r.provider === resource.provider ||
        (resource.specs.vpcId && r.specs.vpcId === resource.specs.vpcId))
  ).slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col text-slate-900 dark:text-slate-100 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <CloudProviderBadge provider={resource.provider} />
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <StatusIndicator status={resource.status} size="sm" showPulse />
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-[11px] font-mono text-slate-400 capitalize">
                {resource.environment}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {resource.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ID: <span className="font-mono">{resource.id}</span> · Region:{' '}
              <span className="font-mono">{resource.region}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Operational Controls */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleResourcePower(resource.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer ${
                resource.status === 'STOPPED'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{resource.status === 'STOPPED' ? 'Start Instance' : 'Stop Instance'}</span>
            </button>

            {resource.status !== 'STOPPED' && (
              <button
                onClick={() => rebootResource(resource.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>
            )}
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Run Rate</span>
            <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
              ${resource.costMonthly.toFixed(2)}/mo
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 text-xs font-medium overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'config', label: 'Configuration' },
              { id: 'metrics', label: 'Metrics' },
              { id: 'networking', label: 'Networking' },
              { id: 'security', label: 'Security' },
              { id: 'related', label: 'Related Resources' },
              { id: 'logs', label: 'Activity Logs' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 border-b-2 font-medium capitalize whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Health Diagnostic
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {resource.statusMessage || 'All health checks reporting nominal response.'}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  General Metadata
                </span>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="flex justify-between p-2.5">
                    <span className="text-slate-500">Resource Type</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {resource.type}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-slate-500">Cloud Provider</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {resource.provider}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-slate-500">Region & Availability Zone</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {resource.region}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-slate-500">Target Environment</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200 uppercase">
                      {resource.environment}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5">
                    <span className="text-slate-500">Provisioned Date</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {resource.createdAt}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Infrastructure Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resource.tags).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-2 py-1 rounded-md text-[11px] font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      {k}:{' '}
                      <strong className="font-semibold text-blue-600 dark:text-blue-400">
                        {v}
                      </strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Hardware & Provisioning Specifications
              </span>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {resource.specs.instanceType && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Machine Sizing</span>
                    <span className="font-mono font-semibold">{resource.specs.instanceType}</span>
                  </div>
                )}
                {resource.specs.vCpu && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Virtual Compute</span>
                    <span className="font-mono font-semibold">{resource.specs.vCpu} vCPU</span>
                  </div>
                )}
                {resource.specs.memoryGb && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">RAM Capacity</span>
                    <span className="font-mono font-semibold">{resource.specs.memoryGb} GB</span>
                  </div>
                )}
                {resource.specs.storageGb && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Storage Volume</span>
                    <span className="font-mono font-semibold">{resource.specs.storageGb} GB SSD</span>
                  </div>
                )}
                {resource.specs.engine && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Database Engine</span>
                    <span className="font-mono font-semibold">
                      {resource.specs.engine} {resource.specs.engineVersion}
                    </span>
                  </div>
                )}
                {resource.specs.clusterVersion && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Kubernetes Release</span>
                    <span className="font-mono font-semibold">{resource.specs.clusterVersion}</span>
                  </div>
                )}
                {resource.specs.nodesCount && (
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Node Pool Size</span>
                    <span className="font-mono font-semibold">{resource.specs.nodesCount} worker nodes</span>
                  </div>
                )}
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Operating System / Kernel</span>
                  <span className="font-mono font-medium">Ubuntu 22.04 LTS (x86_64)</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Hypervisor Architecture</span>
                  <span className="font-mono font-medium">Nitro / KVM Hardware Virtualization</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Auto-Recovery Policy</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    Automatic Restart Enabled
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: METRICS */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Live Telemetry Utilization
              </span>

              {resource.metrics.cpuUsagePercent !== undefined && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">CPU Compute Load</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {resource.metrics.cpuUsagePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        resource.metrics.cpuUsagePercent > 85
                          ? 'bg-rose-500'
                          : resource.metrics.cpuUsagePercent > 70
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${resource.metrics.cpuUsagePercent}%` }}
                    />
                  </div>
                </div>
              )}

              {resource.metrics.memoryUsagePercent !== undefined && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Memory Allocation</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {resource.metrics.memoryUsagePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        resource.metrics.memoryUsagePercent > 85
                          ? 'bg-rose-500'
                          : resource.metrics.memoryUsagePercent > 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${resource.metrics.memoryUsagePercent}%` }}
                    />
                  </div>
                </div>
              )}

              {resource.metrics.uptimePercentage && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex justify-between items-center">
                  <span className="text-slate-500 font-medium">SLA Availability (Trailing 30d)</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {resource.metrics.uptimePercentage}%
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
                  <span className="text-slate-500 text-[11px] block">Disk I/O Throughput</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-1 block">
                    384.2 MB/s
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
                  <span className="text-slate-500 text-[11px] block">Network Ingress / Egress</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-1 block">
                    1.42 Gbps
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NETWORKING */}
          {activeTab === 'networking' && (
            <div className="space-y-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                VPC Topology & Routing
              </span>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Virtual Private Cloud (VPC)</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {resource.specs.vpcId || 'vpc-mesh-us-east-prod'}
                  </span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Subnet CIDR</span>
                  <span className="font-mono font-semibold">10.140.2.0/24 (Private Tier)</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Private IP</span>
                  <span className="font-mono font-semibold">{resource.specs.ipAddress || '10.140.2.85'}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Elastic Public IP</span>
                  <span className="font-mono font-semibold">52.23.119.80</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Security Group Rules</span>
                  <span className="font-mono font-semibold text-emerald-600">Port 443 / 22 (SSH VPN)</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">DNS Canonical FQDN</span>
                  <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                    {resource.name.toLowerCase()}.internal.cloud.net
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Security Posture & Compliance Findings
              </span>
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                      KMS Encryption at Rest: Active
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                      AES-256 Customer Managed Key (CMK)
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold">
                  Compliant
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">IAM Execution Role</span>
                  <span className="font-mono font-semibold">arn:aws:iam::prod-service-worker-role</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">TLS Encryption in Transit</span>
                  <span className="font-mono font-semibold text-emerald-600">TLS 1.3 Strict</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">CIS Benchmark Compliance</span>
                  <span className="font-mono font-semibold text-emerald-600">98.5% Score</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">CVE Vulnerability Findings</span>
                  <span className="font-mono font-semibold">0 Critical · 0 High · 1 Low</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: RELATED RESOURCES */}
          {activeTab === 'related' && (
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Connected Multi-Cloud Dependencies
              </span>

              {relatedResources.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No related resources detected.</p>
              ) : (
                relatedResources.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectRelatedResource?.(rel)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 hover:border-blue-400 dark:hover:border-blue-700 transition cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CloudProviderBadge provider={rel.provider} />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                          {rel.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {rel.type} · {rel.region}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 7: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Audited Events for {resource.name}
              </span>
              {resourceLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No recent log entries.</p>
              ) : (
                resourceLogs.map((l) => (
                  <div
                    key={l.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-xs space-y-1"
                  >
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="font-mono font-semibold">{l.level}</span>
                      <span className="font-mono">{l.timestamp}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200">{l.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
