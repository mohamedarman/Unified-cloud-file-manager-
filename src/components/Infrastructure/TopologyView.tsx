import React, { useState } from 'react';
import {
  Cloud,
  Server,
  Database,
  HardDrive,
  Cpu,
  Network,
  Activity,
  Layers,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { StatusIndicator } from '../common/StatusIndicator';

interface TopologyNode {
  id: string;
  name: string;
  category: 'core' | 'provider' | 'region' | 'service';
  provider?: 'AWS' | 'AZURE' | 'GCP' | 'STORAGE';
  icon: any;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  details: string;
  metrics?: string;
  cost?: string;
}

export const TopologyView: React.FC = () => {
  const { resources, cloudAccounts, setSelectedResource } = useInfrastructure();
  const { setCurrentTab } = useFileManager();
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  const topologyNodes: TopologyNode[] = [
    {
      id: 'core-hub',
      name: 'MultiCloud Control Plane',
      category: 'core',
      icon: Cloud,
      status: 'HEALTHY',
      details: 'Global routing orchestrator & quota governor',
      metrics: '4 Cloud Providers · 128 Resources Connected',
    },
    {
      id: 'branch-aws',
      name: 'AWS Hyperscaler',
      category: 'provider',
      provider: 'AWS',
      icon: Server,
      status: 'HEALTHY',
      details: 'us-east-1 (N. Virginia) · Account #1284-9023-4410',
      metrics: '42 Assets · 98% Health',
      cost: '$4,850/mo',
    },
    {
      id: 'branch-azure',
      name: 'Azure Enterprise',
      category: 'provider',
      provider: 'AZURE',
      icon: Layers,
      status: 'WARNING',
      details: 'westeurope (Amsterdam) · Sub #sub-49f2-8921-99af',
      metrics: '28 Assets · 1 Active Warning',
      cost: '$3,420/mo',
    },
    {
      id: 'branch-gcp',
      name: 'Google Cloud Platform',
      category: 'provider',
      provider: 'GCP',
      icon: Cpu,
      status: 'HEALTHY',
      details: 'us-central1 (Iowa) · Project #prj-prod-mesh-2026',
      metrics: '35 Assets · 100% Health',
      cost: '$2,680/mo',
    },
    {
      id: 'branch-storage',
      name: 'Federated Cloud Storage',
      category: 'provider',
      provider: 'STORAGE',
      icon: HardDrive,
      status: 'HEALTHY',
      details: 'Google Drive, OneDrive, Dropbox, Box Sync',
      metrics: '62 Cloud Files · 43.4 TB Quota',
      cost: '$195/mo',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Multi-Cloud Infrastructure Topology
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive structural hierarchy and cross-cloud topology graph
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentTab('infra_overview')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
          >
            Switch to Table View
          </button>
        </div>
      </div>

      {/* Interactive Topology Canvas */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
        {/* Level 1: Global Core Orchestrator Hub */}
        <div className="flex flex-col items-center w-full max-w-4xl">
          <div
            onClick={() => setSelectedNode(topologyNodes[0])}
            className="group relative bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 border border-blue-500/40 shadow-xl max-w-md w-full cursor-pointer hover:border-blue-400 transition transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/30 flex items-center justify-center text-blue-400 border border-blue-400/30">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">MultiCloud Control Plane</h3>
                  <p className="text-[11px] text-blue-200/80">Global Core Orchestrator</p>
                </div>
              </div>
              <StatusIndicator status="HEALTHY" size="sm" showPulse />
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 font-mono">
              <span>Latency: 4.2ms</span>
              <span>4 Clouds Connected</span>
            </div>
          </div>

          {/* Connector Line */}
          <div className="w-px h-8 bg-slate-300 dark:bg-slate-700" />
          <div className="w-4/5 h-px bg-slate-300 dark:bg-slate-700 mb-8 relative">
            {/* Dots */}
            <div className="absolute left-0 -top-1 w-2 h-2 rounded-full bg-slate-400" />
            <div className="absolute left-1/3 -top-1 w-2 h-2 rounded-full bg-slate-400" />
            <div className="absolute left-2/3 -top-1 w-2 h-2 rounded-full bg-slate-400" />
            <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-slate-400" />
          </div>

          {/* Level 2: Four Cloud Hyperscaler Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {/* 1. AWS */}
            <div className="space-y-3">
              <div
                onClick={() => setSelectedNode(topologyNodes[1])}
                className="bg-white dark:bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-amber-600 dark:text-amber-400">AWS Cloud</span>
                  <StatusIndicator status="HEALTHY" size="sm" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">us-east-1 Region</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">42 active assets · $4,850/mo</p>
              </div>

              {/* AWS Sub-Services */}
              <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-900/60 space-y-2">
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-eks-cluster');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">EKS Core Cluster</p>
                  <p className="text-[10px] text-slate-400 font-mono">18 nodes · v1.30</p>
                </div>
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-rds-aurora');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">Aurora PG Cluster</p>
                  <p className="text-[10px] text-slate-400 font-mono">Multi-AZ · 12k IOPS</p>
                </div>
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-s3-prod-assets');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">S3 Enterprise Vault</p>
                  <p className="text-[10px] text-slate-400 font-mono">16.4 TB KMS Encrypted</p>
                </div>
              </div>
            </div>

            {/* 2. Azure */}
            <div className="space-y-3">
              <div
                onClick={() => setSelectedNode(topologyNodes[2])}
                className="bg-white dark:bg-slate-900 border border-blue-500/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-blue-600 dark:text-blue-400">Microsoft Azure</span>
                  <StatusIndicator status="WARNING" size="sm" showPulse />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">westeurope Region</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">28 active assets · $3,420/mo</p>
              </div>

              {/* Azure Sub-Services */}
              <div className="pl-3 border-l-2 border-blue-300 dark:border-blue-900/60 space-y-2">
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-aks-cluster');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">AKS Pipeline Cluster</p>
                  <p className="text-[10px] text-slate-400 font-mono">8 nodes · v1.29</p>
                </div>
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-cosmos-db');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">Cosmos DB Global</p>
                  <p className="text-[10px] text-slate-400 font-mono">Multi-region write</p>
                </div>
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-vm-worker-azure');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">Batch Ingest VM</p>
                  <p className="text-[10px] text-amber-500 font-mono">High RAM usage (88%)</p>
                </div>
              </div>
            </div>

            {/* 3. GCP */}
            <div className="space-y-3">
              <div
                onClick={() => setSelectedNode(topologyNodes[3])}
                className="bg-white dark:bg-slate-900 border border-sky-500/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-sky-600 dark:text-sky-400">Google Cloud</span>
                  <StatusIndicator status="HEALTHY" size="sm" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">us-central1 Region</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">35 active assets · $2,680/mo</p>
              </div>

              {/* GCP Sub-Services */}
              <div className="pl-3 border-l-2 border-sky-300 dark:border-sky-900/60 space-y-2">
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-gcp-ml-runner');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">G2 ML Inference</p>
                  <p className="text-[10px] text-slate-400 font-mono">8 vCPU · 32GB RAM</p>
                </div>
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-gcp-cloudsql');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">CloudSQL Timeseries</p>
                  <p className="text-[10px] text-slate-400 font-mono">HA Postgres 16</p>
                </div>
                <div
                  onClick={() => {
                    const res = resources.find((r) => r.id === 'res-gcp-gcs-lake');
                    if (res) setSelectedResource(res);
                  }}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">GCS Data Lake</p>
                  <p className="text-[10px] text-slate-400 font-mono">14.8 TB Dual-region</p>
                </div>
              </div>
            </div>

            {/* 4. Storage Federation */}
            <div className="space-y-3">
              <div
                onClick={() => setSelectedNode(topologyNodes[4])}
                className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">Storage Mesh</span>
                  <StatusIndicator status="HEALTHY" size="sm" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">Unified SaaS Drives</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">4 Accounts · 43.4 TB Quota</p>
              </div>

              {/* Storage Sub-Services */}
              <div className="pl-3 border-l-2 border-emerald-300 dark:border-emerald-900/60 space-y-2">
                <div
                  onClick={() => setCurrentTab('files')}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">Google Drive (2 Accs)</p>
                  <p className="text-[10px] text-slate-400 font-mono">Personal & Photos</p>
                </div>
                <div
                  onClick={() => setCurrentTab('files')}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">Microsoft OneDrive</p>
                  <p className="text-[10px] text-slate-400 font-mono">Enterprise 365</p>
                </div>
                <div
                  onClick={() => setCurrentTab('files')}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-xs cursor-pointer transition shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">Dropbox & Box</p>
                  <p className="text-[10px] text-slate-400 font-mono">Creative & Research Vault</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Node Details Box */}
        {selectedNode && (
          <div className="mt-8 max-w-xl w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex items-center justify-between animate-in fade-in-50 duration-150">
            <div>
              <div className="flex items-center gap-2">
                <selectedNode.icon className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{selectedNode.name}</h4>
                <StatusIndicator status={selectedNode.status} size="sm" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedNode.details}</p>
              {selectedNode.metrics && (
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 mt-0.5">{selectedNode.metrics}</p>
              )}
            </div>

            <button
              onClick={() => setSelectedNode(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
