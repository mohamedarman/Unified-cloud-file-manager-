import React from 'react';
import {
  Workflow,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Shield,
  Zap,
} from 'lucide-react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { CloudProviderBadge } from '../common/CloudProviderBadge';

export const AutomationView: React.FC = () => {
  const { workflows, triggerWorkflow } = useInfrastructure();

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Automation & Infrastructure Runbooks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Declarative workflows for disaster recovery, nightly cost optimization, and compliance scanning
          </p>
        </div>

        <button
          onClick={() => triggerWorkflow(workflows[0].id)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Execute All Active Workflows</span>
        </button>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Workflow className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {wf.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Schedule: {wf.scheduleCron || 'Manual Execution'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                  {wf.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-xs text-slate-400">Target Hyperscalers:</span>
                  {wf.targetClouds.map((p) => (
                    <CloudProviderBadge key={p} provider={p} size="sm" />
                  ))}
                </div>
              </div>

              <div className="flex items-center sm:flex-col items-end gap-2 shrink-0">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold uppercase">
                  {wf.status}
                </span>

                <button
                  onClick={() => triggerWorkflow(wf.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current text-blue-600" />
                  <span>Run Now</span>
                </button>
              </div>
            </div>

            {/* Run summary footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Last execution result: <strong className="text-slate-700 dark:text-slate-300 font-normal">{wf.actionSummary}</strong></span>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                Total executions: {wf.executionCount} runs
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
