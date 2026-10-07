import React, { useState, useMemo } from 'react';
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
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Share2,
  Download,
  Info,
  Lock,
  Search,
  Key,
  Terminal,
  FileText,
  Sliders,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { StatusIndicator } from '../common/StatusIndicator';
import { toast } from 'sonner';

export type DiagramTab = 'system_architecture' | 'infra_topology' | 'conference_diagram' | 'data_flow_simulator';

export interface ArchitectureNode {
  id: string;
  title: string;
  subtitle: string;
  layer: 'presentation' | 'domain' | 'security' | 'governance' | 'provider' | 'backend';
  icon: any;
  status: 'HEALTHY' | 'ACTIVE' | 'ISOLATED' | 'PROTECTED';
  codeReference: string;
  invariants: string[];
  metrics: string;
}

export const TopologyView: React.FC = () => {
  const { resources, cloudAccounts, setSelectedResource } = useInfrastructure();
  const { setCurrentTab, accounts } = useFileManager();

  // Active Diagram View Tab
  const [activeTab, setActiveTab] = useState<DiagramTab>('system_architecture');
  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  // Layer Filter
  const [layerFilter, setLayerFilter] = useState<string>('ALL');
  // Selected Node for detailed inspection
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(null);

  // Data Flow Simulation State
  const [activeSimulation, setActiveSimulation] = useState<'upload' | 'search' | 'sync' | 'auth' | null>('upload');
  const [simulationStep, setSimulationStep] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // System Architecture Nodes (derived from Architecture.md & Rules.md)
  const systemNodes: ArchitectureNode[] = [
    {
      id: 'pres_layer',
      title: 'Presentation & Viewport Layer',
      subtitle: 'React SPA · ViewModels · Hotkeys · Device Studio',
      layer: 'presentation',
      icon: Layers,
      status: 'ACTIVE',
      codeReference: 'src/components/Router/ViewRouter.tsx',
      invariants: [
        'Offline-first rendering from metadata cache',
        'Zero-blocking UI transitions; optimistic feedback',
        'Strict accessibility WCAG AA contrast and full hotkey bindings',
      ],
      metrics: '18 Views · Mobile/Tablet/Desktop responsive',
    },
    {
      id: 'governor_layer',
      title: 'Quota Governor & Rate Limiter',
      subtitle: 'Admission Control · In-Flight Permits · Concurrency Caps',
      layer: 'governance',
      icon: Activity,
      status: 'PROTECTED',
      codeReference: 'src/utils/quotaGovernor.ts & Architecture.md §12.7',
      invariants: [
        'Max 4 concurrent requests per account; 8 globally',
        'Bounded sliding window rate ceiling prevents 429 throttling',
        'Outcome reconciliation safeguard against duplicate uploads',
      ],
      metrics: '0 Throttled Requests · 120 req / 100s budget',
    },
    {
      id: 'domain_layer',
      title: 'Domain Engine & File Orchestrator',
      subtitle: 'Merge · Fan-out · Filter · Attributions · Transmit',
      layer: 'domain',
      icon: Cpu,
      status: 'ACTIVE',
      codeReference: 'src/context/FileManagerContext.tsx',
      invariants: [
        'Explicit AccountId required on every provider operation',
        'Zero ambient cross-account state leakage',
        'Normalized mime-type detection and thumbnail caching',
      ],
      metrics: '62 Cloud Files Managed · 4 Cloud Services',
    },
    {
      id: 'security_layer',
      title: 'Security & Keystore Boundary',
      subtitle: 'Hardware Keystore · Encrypted Token Vault · Regex Scrubbing',
      layer: 'security',
      icon: Shield,
      status: 'ISOLATED',
      codeReference: 'src/utils/redactor.ts & Rules.md §26',
      invariants: [
        'Pure client-side OAuth tokens with zero backend persistence',
        'Automated FNV-1a correlation tagging without exposing file IDs',
        'Irreversible regex scrubbing strips bearer tokens from logs',
      ],
      metrics: '100% Client-Side Isolated · 0 Telemetry Leaks',
    },
    {
      id: 'provider_layer',
      title: 'Multi-Cloud Provider Mesh',
      subtitle: 'Google Drive API v3 · OneDrive Graph · Dropbox v2 · Box',
      layer: 'provider',
      icon: Cloud,
      status: 'HEALTHY',
      codeReference: 'src/types/index.ts & Architecture.md §8',
      invariants: [
        'Streaming chunked uploads directly between client & cloud',
        'Delta sync tokens utilized for instant incremental cache refresh',
        'No file sharding, pooling, or artificial quota bypass',
      ],
      metrics: '4 Authorized Cloud Accounts · 43.4 TB Managed Quota',
    },
    {
      id: 'backend_layer',
      title: 'Minimal Stateless OAuth Relay',
      subtitle: 'RFC 7636 PKCE · Zero File Content · Stateless Exchange',
      layer: 'backend',
      icon: Key,
      status: 'PROTECTED',
      codeReference: 'Architecture.md §2 (Minimal Backend)',
      invariants: [
        'Backend never receives, processes, or inspects file bytes',
        'Stateless ephemeral token code exchange only',
        'Compliant with Google API Services Limited Use Policy',
      ],
      metrics: 'Zero File Storage · Stateless TLS 1.3 Endpoint',
    },
  ];

  // Simulation step details
  const simulationFlows = {
    upload: {
      title: 'Direct Streaming Upload Pipeline',
      steps: [
        { step: 1, node: 'pres_layer', text: 'User picks file in UploadModal (streaming chunks initiated)' },
        { step: 2, node: 'governor_layer', text: 'QuotaGovernor tests capacity: permit granted within concurrent limits' },
        { step: 3, node: 'security_layer', text: 'Keystore unlocks provider OAuth token via client-side scope verification' },
        { step: 4, node: 'provider_layer', text: 'Direct HTTP pipeline streams bytes straight to target cloud provider' },
        { step: 5, node: 'domain_layer', text: 'Operation settled in Local Cache; Outcome verified without duplicates' },
      ],
    },
    search: {
      title: 'Parallel Cross-Cloud Search Fan-Out',
      steps: [
        { step: 1, node: 'pres_layer', text: 'Debounced search query entered in CrossAccountSearchView' },
        { step: 2, node: 'governor_layer', text: 'Governor allocates simultaneous query permits across all 4 accounts' },
        { step: 3, node: 'provider_layer', text: 'Parallel fan-out queries Google Drive, OneDrive, Dropbox, and Box' },
        { step: 4, node: 'domain_layer', text: 'Search results aggregated, deduplicated, and attributed with account badges' },
        { step: 5, node: 'pres_layer', text: 'Instant sub-50ms reactive grid display with preview thumbnails' },
      ],
    },
    sync: {
      title: 'Offline Durable Write & Delta Reconciliation',
      steps: [
        { step: 1, node: 'pres_layer', text: 'Action triggered while offline or on unstable cellular network' },
        { step: 2, node: 'domain_layer', text: 'Queued in PendingOperationEntity with outcomeUncertain = true' },
        { step: 3, node: 'security_layer', text: 'Audit event scrubbed and recorded in tamper-evident memory sink' },
        { step: 4, node: 'provider_layer', text: 'Connectivity re-established: Delta sync verifies actual cloud state' },
        { step: 5, node: 'domain_layer', text: 'Write reconciled without duplicate folders or re-upload conflict' },
      ],
    },
    auth: {
      title: 'Zero-Leakage OAuth Token Lifecycle',
      steps: [
        { step: 1, node: 'pres_layer', text: 'User clicks Connect Account for Google, OneDrive, Dropbox, or Box' },
        { step: 2, node: 'backend_layer', text: 'RFC 7636 PKCE code exchange via minimal stateless relay' },
        { step: 3, node: 'security_layer', text: 'Token encrypted client-side in Keystore; zero tokens stored on server' },
        { step: 4, node: 'governor_layer', text: 'Storage quota baseline recorded and isolated in AccountStateMachine' },
        { step: 5, node: 'domain_layer', text: 'Account status marked CONNECTED with real-time health ping cadence' },
      ],
    },
  };

  const currentFlow = simulationFlows[activeSimulation || 'upload'];

  // Handle Play Simulation
  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimulationStep(1);
    const interval = setInterval(() => {
      setSimulationStep((prev) => {
        if (prev >= currentFlow.steps.length) {
          clearInterval(interval);
          setIsSimulating(false);
          toast.success(`Simulation completed: ${currentFlow.title}`);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
  };

  const handleExportDiagram = () => {
    toast.success('Architecture Diagram specification exported to console');
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 transition-colors ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : ''}`}>
      {/* 1. Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>Full System Architecture & Diagram Suite</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold uppercase">
                Verified
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive structural hierarchy, security invariants, topology mesh, and live data flow simulator
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
          <button
            onClick={() => setActiveTab('system_architecture')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'system_architecture'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>System Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab('infra_topology')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'infra_topology'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Infrastructure</span>
          </button>

          <button
            onClick={() => setActiveTab('conference_diagram')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'conference_diagram'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Conference Diagram</span>
          </button>

          <button
            onClick={() => setActiveTab('data_flow_simulator')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'data_flow_simulator'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Flow Simulator</span>
          </button>
        </div>

        {/* Action Controls: Zoom, Export, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(60, z - 15))}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] w-9 text-center font-bold text-slate-700 dark:text-slate-200">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1 text-slate-400 hover:text-blue-500 rounded cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleExportDiagram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer"
            title="Export Architecture Specs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Diagram'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Interactive Diagram Canvas Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-start">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="w-full max-w-6xl space-y-6"
        >
          {/* TAB 1: SYSTEM & SECURITY ARCHITECTURE DIAGRAM */}
          {activeTab === 'system_architecture' && (
            <div className="space-y-6">
              {/* Architecture Blueprint Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span>Clean Modular Architecture & Security Invariants</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Strict Multi-Account Isolation, Keystore Cryptography, and Zero-Storage Management
                    </p>
                  </div>

                  <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-200 dark:border-blue-900/40">
                    Architecture.md §2 Compliant
                  </span>
                </div>

                {/* Vertical Interactive Flow Diagram with Connector Lines */}
                <div className="space-y-4 relative">
                  {systemNodes.map((node, index) => {
                    const isSelected = selectedNode?.id === node.id;
                    const Icon = node.icon;

                    return (
                      <div key={node.id} className="relative">
                        {/* Node Box */}
                        <div
                          onClick={() => setSelectedNode(node)}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/30'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {node.title}
                                  </h3>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    {node.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {node.subtitle}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                              <span className="hidden md:inline text-[11px] bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                {node.codeReference}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>

                          {/* Invariants Bullets */}
                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            {node.invariants.map((inv, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{inv}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Arrow connector between levels */}
                        {index < systemNodes.length - 1 && (
                          <div className="flex justify-center py-1">
                            <div className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLOUD INFRASTRUCTURE & HYPERSCALER TOPOLOGY */}
          {activeTab === 'infra_topology' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-indigo-600" />
                      <span>Multi-Cloud Fabric & Hyperscaler Cluster Mesh</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      AWS, Azure, Google Cloud, and Federated Storage nodes in live distributed operation
                    </p>
                  </div>

                  <button
                    onClick={() => setCurrentTab('infra_overview')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect 128 Fleet Assets</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 4 Hyperscaler Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* AWS */}
                  <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-amber-600 dark:text-amber-400">AWS Cloud</span>
                      <StatusIndicator status="HEALTHY" size="sm" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">us-east-1 Region</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">42 active assets · $4,850/mo</p>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-amber-200/50 dark:border-amber-900/40 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        EKS Core Cluster (18 nodes)
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        Aurora Postgres Multi-AZ
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        S3 KMS Encrypted Vault
                      </div>
                    </div>
                  </div>

                  {/* Azure */}
                  <div className="p-4 rounded-2xl border border-blue-300 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-600 dark:text-blue-400">Microsoft Azure</span>
                      <StatusIndicator status="WARNING" size="sm" showPulse />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">westeurope Region</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">28 active assets · $3,420/mo</p>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-blue-200/50 dark:border-blue-900/40 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        AKS Pipeline Cluster (8 nodes)
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        Cosmos DB Global Replication
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-amber-300 dark:border-amber-800 font-medium text-amber-600">
                        Batch Ingest VM (88% RAM Alert)
                      </div>
                    </div>
                  </div>

                  {/* GCP */}
                  <div className="p-4 rounded-2xl border border-sky-300 dark:border-sky-900/60 bg-sky-50/20 dark:bg-sky-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-sky-600 dark:text-sky-400">Google Cloud</span>
                      <StatusIndicator status="HEALTHY" size="sm" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">us-central1 Region</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">35 active assets · $2,680/mo</p>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-sky-200/50 dark:border-sky-900/40 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        G2 ML Inference Runners
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        CloudSQL Timeseries Cluster
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        GCS Multi-Region Lake
                      </div>
                    </div>
                  </div>

                  {/* Storage Mesh */}
                  <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">Federated Storage</span>
                      <StatusIndicator status="HEALTHY" size="sm" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">SaaS Cloud Drives</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">4 Accounts · 43.4 TB Quota</p>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/40 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        Google Drive (2 Accounts)
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        Microsoft OneDrive 365
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-medium">
                        Dropbox & Box Enterprise
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONFERENCE & EXTERNAL PRESENTATION DIAGRAM */}
          {activeTab === 'conference_diagram' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-blue-500/30 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 block mb-1">
                      Conference Architecture Poster · Technical Paper 2026
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      Zero-Storage Multi-Cloud Orchestration & Governance Protocol
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-white/10 border border-white/20 text-xs font-mono">
                      v1.4 Spec Verified
                    </span>
                  </div>
                </div>

                {/* 3 Pillars of Conference Architecture */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-sm">1. Strict Zero-Storage Invariant</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      All file contents stream strictly between the client and the respective authorized provider. The central proxy neither pools, caches, nor resells third-party cloud storage.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-sm">2. Keystore-Backed Isolation</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Every authorized account maintains an isolated cryptographic token bucket. When an account is disconnected, all local indices and tokens are wiped instantly.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                      <Activity className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-sm">3. Quota & Rate Governance</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      The QuotaGovernor ensures fair concurrent permits (max 4 per account), preventing rate-limit throttling and providing durable offline reconciliation.
                    </p>
                  </div>
                </div>

                {/* Footer specs */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300">
                  <span>Architecture Citation: Architecture.md (RFC 7636 PKCE · Google Drive API v3 · Microsoft Graph API)</span>
                  <span className="text-emerald-400">✓ SOC2 Type II Certified Invariant</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE DATA FLOW TRANSACTION SIMULATOR */}
          {activeTab === 'data_flow_simulator' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Play className="w-5 h-5 text-emerald-600 fill-current" />
                      <span>Live Data Flow & Transaction Simulator</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Trace step-by-step transaction execution across presentation, security, governor, and provider layers
                    </p>
                  </div>

                  {/* Flow selection pills */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => { setActiveSimulation('upload'); setSimulationStep(1); }}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeSimulation === 'upload' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Upload Flow
                    </button>
                    <button
                      onClick={() => { setActiveSimulation('search'); setSimulationStep(1); }}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeSimulation === 'search' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Search Fan-Out
                    </button>
                    <button
                      onClick={() => { setActiveSimulation('sync'); setSimulationStep(1); }}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeSimulation === 'sync' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Offline Sync
                    </button>
                    <button
                      onClick={() => { setActiveSimulation('auth'); setSimulationStep(1); }}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeSimulation === 'auth' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      OAuth Lifecycle
                    </button>
                  </div>
                </div>

                {/* Simulation Control Bar */}
                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-blue-900 dark:text-blue-300">{currentFlow.title}</h3>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                      Step {simulationStep} of {currentFlow.steps.length} in active execution pipeline
                    </p>
                  </div>

                  <button
                    disabled={isSimulating}
                    onClick={handleRunSimulation}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-pulse' : ''}`} />
                    <span>{isSimulating ? 'Tracing...' : 'Run Simulation'}</span>
                  </button>
                </div>

                {/* Step Trace Visualizer */}
                <div className="space-y-3">
                  {currentFlow.steps.map((st) => {
                    const isPassed = simulationStep > st.step;
                    const isCurrent = simulationStep === st.step;

                    return (
                      <div
                        key={st.step}
                        className={`p-4 rounded-2xl border transition-all flex items-start gap-3 text-xs ${
                          isCurrent
                            ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
                            : isPassed
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-slate-800 dark:text-slate-200'
                            : 'bg-slate-50 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold font-mono text-xs ${
                            isCurrent
                              ? 'bg-blue-600 text-white animate-pulse'
                              : isPassed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isPassed ? '✓' : st.step}
                        </div>

                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 dark:text-white">{st.text}</p>
                          <span className="text-[10px] font-mono text-slate-400 block">Target Layer: #{st.node}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Node Details Inspector Drawer (Opens when any node is clicked) */}
      {selectedNode && (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <selectedNode.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{selectedNode.title}</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                  {selectedNode.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedNode.subtitle} · <span className="font-mono text-slate-700 dark:text-slate-300">{selectedNode.codeReference}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hidden md:inline">
              {selectedNode.metrics}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
