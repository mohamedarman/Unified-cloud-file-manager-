import React from 'react';
import {
  Cloud,
  Cpu,
  HardDrive,
  Database,
  Network,
  Activity,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Shield,
  Layers,
  ExternalLink,
  RefreshCw,
  Zap,
  Clock,
  Sparkles,
  Server,
  Workflow,
  ArrowRight,
  Folder,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useFileManager } from '../../context/FileManagerContext';
import { MetricCard } from '../common/MetricCard';
import { StatusIndicator } from '../common/StatusIndicator';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { toast } from 'sonner';

export const MultiCloudDashboardView: React.FC = () => {
  const {
    cloudAccounts,
    resources,
    alerts,
    costs,
    recommendations,
    applyRecommendation,
    selectedEnvironment,
    setSelectedEnvironment,
    acknowledgeAlert,
    resolveAlert,
    triggerWorkflow,
  } = useInfrastructure();

  const { setCurrentTab, files } = useFileManager();

  // Computations
  const totalResources = resources.length;
  const healthyResources = resources.filter((r) => r.status === 'HEALTHY').length;
  const warningResources = resources.filter((r) => r.status === 'WARNING').length;
  const stoppedResources = resources.filter((r) => r.status === 'STOPPED').length;

  const totalMonthlySpend = costs.reduce((sum, c) => sum + c.currentSpend, 0);
  const totalBudget = costs.reduce((sum, c) => sum + c.budget, 0);

  const activeAlerts = alerts.filter((a) => a.status !== 'RESOLVED');

  // Filter Hyperscalers (AWS, Azure, GCP) separate from Storage
  const hyperscalers = cloudAccounts.filter(
    (acc) => acc.provider === 'AWS' || acc.provider === 'AZURE' || acc.provider === 'GCP'
  );

  // Spend chart data
  const spendChartData = costs.map((c) => ({
    name: c.provider,
    Spend: c.currentSpend,
    Budget: c.budget,
  }));

  // Mock 24h Telemetry data
  const telemetryData = [
    { time: '00:00', cpuAvg: 38, memoryAvg: 54 },
    { time: '04:00', cpuAvg: 32, memoryAvg: 52 },
    { time: '08:00', cpuAvg: 58, memoryAvg: 68 },
    { time: '12:00', cpuAvg: 64, memoryAvg: 72 },
    { time: '16:00', cpuAvg: 69, memoryAvg: 76 },
    { time: '20:00', cpuAvg: 51, memoryAvg: 63 },
    { time: 'Now', cpuAvg: 44, memoryAvg: 59 },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* 1. Header Banner: Understandable & Action-Oriented */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Multi-Cloud Command Center
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Multi-Cloud Fabric Healthy</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time management, observability, and FinOps across AWS, Azure, and Google Cloud
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Action Buttons */}
          <button
            onClick={() => setCurrentTab('infra_topology')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Topology Map</span>
          </button>

          <button
            onClick={() => {
              toast.success('Real-time telemetry refreshed');
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer"
            title="Refresh telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Executive Metrics: Answer "What is happening?" & "Is anything wrong?" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          title="Fleet Resources"
          value={totalResources}
          unit="nodes"
          subtitle={`${healthyResources} active · ${warningResources} with warnings`}
          icon={<Server className="w-4 h-4 text-blue-500" />}
          change={{ value: '+2', trend: 'UP', period: 'this week' }}
          onClick={() => setCurrentTab('infra_overview')}
        />

        <MetricCard
          title="Operational SLA"
          value="99.99%"
          unit="uptime"
          subtitle="Nominal across 3 clouds"
          icon={<Activity className="w-4 h-4 text-emerald-500" />}
          change={{ value: '0.0%', trend: 'NEUTRAL' }}
          onClick={() => setCurrentTab('monitoring_metrics')}
        />

        <MetricCard
          title="Monthly Cloud Spend"
          value={`$${totalMonthlySpend.toLocaleString()}`}
          unit={`/ $${totalBudget.toLocaleString()}`}
          subtitle={`${Math.round((totalMonthlySpend / totalBudget) * 100)}% of monthly budget`}
          icon={<DollarSign className="w-4 h-4 text-teal-500" />}
          change={{ value: '-3.2%', trend: 'DOWN', period: 'vs forecast' }}
          onClick={() => setCurrentTab('cost_overview')}
        />

        <MetricCard
          title="Active Alerts"
          value={activeAlerts.length}
          unit={activeAlerts.length === 1 ? 'incident' : 'incidents'}
          subtitle={activeAlerts.length > 0 ? 'Requires attention' : 'All health checks clear'}
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          badge={
            activeAlerts.length > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono font-bold">
                Action Required
              </span>
            ) : undefined
          }
          onClick={() => setCurrentTab('monitoring_alerts')}
        />
      </div>

      {/* 3. Primary Hyperscalers Overview (AWS, Azure, GCP) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Connected Cloud Providers
            </h2>
            <p className="text-[11px] text-slate-400">
              Active subscriptions, compute clusters, databases, and monthly run-rates
            </p>
          </div>
          <button
            onClick={() => setCurrentTab('providers')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Manage Providers</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hyperscalers.map((account) => {
            return (
              <div
                key={account.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-blue-400 dark:hover:border-blue-700 transition-all flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <CloudProviderBadge provider={account.provider} />
                    <StatusIndicator status={account.status} size="sm" showPulse />
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {account.displayName}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    Account: {account.accountIdOrSub}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Resources</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {account.resourceCount} units
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Run Rate</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        ${account.estimatedMonthlyCost.toLocaleString()}/mo
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[11px]">{account.primaryRegion}</span>
                  <button
                    onClick={() => setCurrentTab('infra_overview')}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Fleet</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Charts: Telemetry & Multi-Cloud Spend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Multi-Cloud Spend vs. Budget
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly cloud spend pacing across AWS, Azure, and GCP
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              ${totalMonthlySpend.toLocaleString()} / mo
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`$${value}`, '']}
                />
                <Bar dataKey="Spend" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Budget" fill="#94a3b8" radius={[6, 6, 0, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 24h Telemetry Area Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                24-Hour Compute & Memory Utilization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregated CPU & RAM telemetry across active cloud nodes
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Avg 44% CPU · Optimal
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => [`${value}%`, name === 'cpuAvg' ? 'CPU' : 'Memory']}
                />
                <Area type="monotone" dataKey="cpuAvg" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#cpuGradient)" />
                <Area type="monotone" dataKey="memoryAvg" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#memGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Actionable Attention Section (Alerts & Cost Optimizations) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Operational Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Operational Alerts ({activeAlerts.length})
                </h3>
              </div>
              <button
                onClick={() => setCurrentTab('monitoring_alerts')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                View All
              </button>
            </div>

            <div className="space-y-2.5">
              {activeAlerts.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-500" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No active infrastructure alerts
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    All cloud providers and clusters are operating nominally.
                  </p>
                </div>
              ) : (
                activeAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded uppercase ${
                              alt.severity === 'CRITICAL'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                : alt.severity === 'WARNING'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {alt.severity}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {alt.title}
                          </p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {alt.message}
                        </p>
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                          Fix: {alt.recommendation}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {Math.round((Date.now() - alt.timestamp) / 60000)}m ago
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                      <button
                        onClick={() => acknowledgeAlert(alt.id)}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-lg transition"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => resolveAlert(alt.id)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                      >
                        Resolve Alert
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FinOps Recommendations & Storage Jump */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cost Optimization Opportunities
                </h3>
              </div>
              <button
                onClick={() => setCurrentTab('cost_overview')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                FinOps Center
              </button>
            </div>

            <div className="space-y-2">
              {recommendations.slice(0, 2).map((rec) => {
                const isApplied = rec.status === 'APPLIED';
                return (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {rec.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {rec.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                          +${rec.estimatedMonthlySavings}/mo
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">savings</span>
                      </div>
                      <button
                        disabled={isApplied}
                        onClick={() => applyRecommendation(rec.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          isApplied
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                      >
                        {isApplied ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Storage Banner */}
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Cloud File Storage Subsystem
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {files.filter((f) => !f.isTrashed).length} files across Google Drive, OneDrive, and Dropbox
                </p>
              </div>
            </div>

            <button
              onClick={() => setCurrentTab('files')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs shrink-0"
            >
              <span>Open Files</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
