import React, { useState } from 'react';
import {
  Activity,
  FileText,
  AlertTriangle,
  Clock,
  Search,
  Download,
  Filter,
  CheckCircle2,
  RefreshCw,
  Cpu,
  HardDrive,
  Network,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { StatusIndicator } from '../common/StatusIndicator';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { toast } from 'sonner';

interface ObservabilityViewProps {
  initialSubTab?: 'metrics' | 'logs' | 'alerts' | 'events';
}

export const ObservabilityView: React.FC<ObservabilityViewProps> = ({
  initialSubTab = 'metrics',
}) => {
  const {
    logs,
    alerts,
    resources,
    acknowledgeAlert,
    resolveAlert,
    exportLogsAsJson,
  } = useInfrastructure();

  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'logs' | 'alerts' | 'events'>(
    initialSubTab
  );

  const [logFilterQuery, setLogFilterQuery] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');

  // Multi-series metrics
  const latencyData = [
    { time: '14:30', p50: 12, p95: 38, p99: 84 },
    { time: '14:35', p50: 14, p95: 42, p99: 92 },
    { time: '14:40', p50: 13, p95: 39, p99: 86 },
    { time: '14:45', p50: 18, p95: 64, p99: 142 },
    { time: '14:50', p50: 22, p95: 88, p99: 198 },
    { time: '14:55', p50: 15, p95: 46, p99: 104 },
    { time: '15:00', p50: 12, p95: 36, p99: 78 },
  ];

  const networkTrafficData = [
    { time: '14:30', ingress: 840, egress: 1240 },
    { time: '14:35', ingress: 920, egress: 1380 },
    { time: '14:40', ingress: 890, egress: 1310 },
    { time: '14:45', ingress: 1420, egress: 2150 },
    { time: '14:50', ingress: 1850, egress: 2840 },
    { time: '14:55', ingress: 1120, egress: 1720 },
    { time: '15:00', ingress: 940, egress: 1420 },
  ];

  const filteredLogs = logs.filter((log) => {
    if (logLevelFilter !== 'ALL' && log.level !== logLevelFilter) return false;
    if (logFilterQuery.trim()) {
      const q = logFilterQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.service.toLowerCase().includes(q) ||
        log.resourceName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Top Header & Subtabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 space-y-3 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Observability & Telemetry Stream
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distributed tracing, live logs, microservice metrics, and operational incident response
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportLogsAsJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit JSON</span>
            </button>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium">
          {[
            { id: 'metrics', label: 'Metrics & Latency', icon: Activity },
            { id: 'logs', label: `Live Logs (${logs.length})`, icon: FileText },
            { id: 'alerts', label: `Active Incidents (${alerts.filter(a => a.status !== 'RESOLVED').length})`, icon: AlertTriangle },
            { id: 'events', label: 'Events Audit Trail', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                  activeSubTab === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* 1. METRICS & LATENCY */}
        {activeSubTab === 'metrics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Latency Percentiles */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Global API Latency Percentiles (ms)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      p50, p95 and p99 response times across ingress gateways
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-600 font-semibold">
                    p95: 36ms · Nominal
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={latencyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}ms`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#1e293b',
                          borderRadius: '0.75rem',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p95" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p99" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Network Throughput */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Multi-Cloud Network Traffic (Mbps)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ingress vs. Egress across AWS VPC, Azure VNet, GCP Backbone
                    </p>
                  </div>
                  <span className="text-xs font-mono text-blue-600 font-semibold">
                    Peak: 2.84 Gbps
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={networkTrafficData}>
                      <defs>
                        <linearGradient id="ingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="egrGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}M`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#1e293b',
                          borderRadius: '0.75rem',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Area type="monotone" dataKey="ingress" stroke="#3b82f6" strokeWidth={2} fill="url(#ingGradient)" />
                      <Area type="monotone" dataKey="egress" stroke="#8b5cf6" strokeWidth={2} fill="url(#egrGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. LIVE LOG STREAM */}
        {activeSubTab === 'logs' && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={logFilterQuery}
                  onChange={(e) => setLogFilterQuery(e.target.value)}
                  placeholder="Filter log messages, services, or resource names..."
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value as any)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="ALL">All Levels</option>
                  <option value="INFO">INFO Only</option>
                  <option value="WARN">WARN Only</option>
                  <option value="ERROR">ERROR Only</option>
                </select>
              </div>
            </div>

            {/* Terminal-style Log Stream Window */}
            <div className="bg-slate-950 text-slate-200 rounded-2xl border border-slate-800 font-mono text-xs overflow-hidden shadow-2xl">
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-semibold text-slate-300">Live Multi-Cloud Syslog</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Streaming · {filteredLogs.length} events</span>
                </div>
              </div>

              <div className="p-4 space-y-2 max-h-[550px] overflow-y-auto">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 hover:bg-slate-900/60 p-1 rounded transition"
                  >
                    <span className="text-slate-500 shrink-0 select-none">{log.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold uppercase text-[10px] shrink-0 ${
                        log.level === 'WARN'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : log.level === 'ERROR'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-blue-400 shrink-0 font-semibold">[{log.provider}/{log.service}]</span>
                    <span className="text-slate-300 flex-1">{log.message}</span>
                    {log.traceId && (
                      <span className="text-slate-600 text-[10px] shrink-0">{log.traceId}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. ALERTS & INCIDENTS */}
        {activeSubTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Active Operational Incidents & Guardrail Alerts
              </h3>
              <span className="text-xs text-slate-500">
                {alerts.filter((a) => a.status !== 'RESOLVED').length} active
              </span>
            </div>

            <div className="space-y-3">
              {alerts.map((alt) => (
                <div
                  key={alt.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase ${
                            alt.severity === 'CRITICAL'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : alt.severity === 'WARNING'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                          }`}
                        >
                          {alt.severity}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {alt.title}
                        </h4>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <CloudProviderBadge provider={alt.provider} size="sm" />
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1">
                        {alt.message}
                      </p>

                      <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 mt-2">
                        <strong>Remediation Strategy:</strong> {alt.recommendation}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono text-slate-400 block">
                        {new Date(alt.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] font-mono uppercase font-semibold text-slate-500 mt-1 block">
                        Status: {alt.status}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    {alt.status !== 'RESOLVED' && (
                      <>
                        <button
                          onClick={() => acknowledgeAlert(alt.id)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => resolveAlert(alt.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition"
                        >
                          Mark as Resolved
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. EVENTS AUDIT TRAIL */}
        {activeSubTab === 'events' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((ev) => (
                <div key={ev.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {ev.service} · {ev.message}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Resource: <span className="font-mono text-slate-600 dark:text-slate-300">{ev.resourceName}</span> · Provider: {ev.provider}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {ev.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
