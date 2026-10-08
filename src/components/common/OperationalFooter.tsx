import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  Command,
  HelpCircle,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useFileManager } from '../../context/FileManagerContext';

interface OperationalFooterProps {
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
}

export const OperationalFooter: React.FC<OperationalFooterProps> = ({
  onOpenCommandPalette,
  onOpenShortcuts,
}) => {
  const { resources, alerts, selectedEnvironment } = useInfrastructure();
  const { currentTab, setCurrentTab } = useFileManager();

  // Simulated live region ping jitter
  const [pings, setPings] = useState({
    aws: 19,
    azure: 23,
    gcp: 14,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setPings({
        aws: Math.floor(17 + Math.random() * 6),
        azure: Math.floor(21 + Math.random() * 8),
        gcp: Math.floor(13 + Math.random() * 5),
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const activeResourcesCount = resources.filter((r) => r.status === 'HEALTHY').length;
  const criticalAlertsCount = alerts.filter(
    (a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED'
  ).length;

  return (
    <footer className="hidden md:flex items-center justify-between px-4 py-1.5 bg-slate-900 text-slate-400 border-t border-slate-800 text-[11px] font-mono select-none z-20 shrink-0">
      {/* Left: Global Health & Environment */}
      <div className="flex items-center gap-4">
        {/* Fabric Health */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                criticalAlertsCount > 0 ? 'bg-rose-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                criticalAlertsCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="font-semibold text-slate-200">
            {criticalAlertsCount > 0 ? 'Degraded Mesh' : 'Multi-Cloud Fabric Operational'}
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Fleet Count */}
        <div
          onClick={() => setCurrentTab('infra_overview')}
          className="hover:text-slate-200 cursor-pointer transition flex items-center gap-1.5"
          title="Inspect Infrastructure Fleet"
        >
          <Layers className="w-3 h-3 text-blue-400" />
          <span>
            {activeResourcesCount}/{resources.length} nodes active
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Hyperscaler Ping Latencies */}
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex items-center gap-1" title="AWS us-east-1 roundtrip">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
            <span className="text-slate-500">AWS</span>
            <span className="text-slate-300 tabular-nums">{pings.aws}ms</span>
          </div>

          <div className="flex items-center gap-1" title="Azure eastus roundtrip">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
            <span className="text-slate-500">AZURE</span>
            <span className="text-slate-300 tabular-nums">{pings.azure}ms</span>
          </div>

          <div className="flex items-center gap-1" title="GCP us-central1 roundtrip">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400/80" />
            <span className="text-slate-500">GCP</span>
            <span className="text-slate-300 tabular-nums">{pings.gcp}ms</span>
          </div>
        </div>
      </div>

      {/* Right: Environment, SLA, and Keyboard Cheatsheet */}
      <div className="flex items-center gap-3">
        {/* Compliance / Security Shield */}
        <div
          onClick={() => setCurrentTab('security')}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer transition"
          title="Security & Account Isolation Architecture"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-Knowledge Isolation</span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Legal Links */}
        <div className="flex items-center gap-2 text-slate-400">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.hash = '#/privacy';
              setCurrentTab('legal');
            }}
            className="hover:text-slate-200 transition cursor-pointer"
            title="View Privacy Policy and Compliance"
          >
            Privacy
          </button>
          <span className="text-slate-700">·</span>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.hash = '#/terms';
              setCurrentTab('legal');
            }}
            className="hover:text-slate-200 transition cursor-pointer"
            title="View Terms of Service"
          >
            Terms
          </button>
        </div>

        <span className="text-slate-700">|</span>

        {/* Shortcuts quick triggers */}
        <div className="flex items-center gap-2 text-slate-500">
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Open Universal Command Palette"
          >
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </button>

          <button
            onClick={onOpenShortcuts}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Open Keyboard Shortcuts Cheatsheet"
          >
            <HelpCircle className="w-2.5 h-2.5" />
            <span>?</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
