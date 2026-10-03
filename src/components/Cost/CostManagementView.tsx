import React from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Sparkles,
  PieChart as PieChartIcon,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Zap,
  Tag,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { MetricCard } from '../common/MetricCard';
import { CloudProviderBadge } from '../common/CloudProviderBadge';
import { toast } from 'sonner';

export const CostManagementView: React.FC = () => {
  const { costs, recommendations, applyRecommendation } = useInfrastructure();

  const totalCurrentSpend = costs.reduce((s, c) => s + c.currentSpend, 0);
  const totalBudget = costs.reduce((s, c) => s + c.budget, 0);
  const totalProjected = costs.reduce((s, c) => s + c.projectedSpend, 0);

  const totalPotentialSavings = recommendations
    .filter((r) => r.status === 'OPEN')
    .reduce((s, r) => s + r.estimatedMonthlySavings, 0);

  const budgetUsedPct = Math.round((totalCurrentSpend / (totalBudget || 1)) * 100);

  const providerChartData = costs.map((c) => ({
    name: c.name,
    Spend: c.currentSpend,
    Budget: c.budget,
    Projected: c.projectedSpend,
    color:
      c.provider === 'AWS'
        ? '#FF9900'
        : c.provider === 'AZURE'
        ? '#0078D4'
        : c.provider === 'GCP'
        ? '#4285F4'
        : '#10B981',
  }));

  const pieData = costs.map((c) => ({
    name: c.name,
    value: c.currentSpend,
    color:
      c.provider === 'AWS'
        ? '#FF9900'
        : c.provider === 'AZURE'
        ? '#0078D4'
        : c.provider === 'GCP'
        ? '#4285F4'
        : '#10B981',
  }));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            FinOps & Multi-Cloud Cost Governance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time spend tracking, predictive forecasting, budget guardrails and automated rightsizing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
            Billing Cycle: 01 Sep - 30 Sep
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          title="Month-to-Date Spend"
          value={`$${totalCurrentSpend.toLocaleString()}`}
          unit={`/ $${totalBudget.toLocaleString()}`}
          subtitle={`${budgetUsedPct}% of monthly limit`}
          icon={<DollarSign className="w-4 h-4 text-blue-500" />}
          change={{ value: '-2.1%', trend: 'DOWN', period: 'vs budget' }}
        />

        <MetricCard
          title="Projected End-of-Month"
          value={`$${totalProjected.toLocaleString()}`}
          unit="estimated"
          subtitle="Within $13,500 target cap"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          change={{ value: 'Under budget', trend: 'DOWN' }}
        />

        <MetricCard
          title="Identified Optimization Savings"
          value={`$${totalPotentialSavings.toLocaleString()}`}
          unit="/ mo"
          subtitle={`${recommendations.filter(r => r.status === 'OPEN').length} active recommendations`}
          icon={<Sparkles className="w-4 h-4 text-amber-500" />}
          change={{ value: `-$${(totalPotentialSavings * 12).toLocaleString()}`, trend: 'DOWN', period: 'annual' }}
        />

        <MetricCard
          title="Budget Health Guardrails"
          value="Healthy"
          unit="nominal"
          subtitle="Zero threshold breaches"
          icon={<ShieldAlert className="w-4 h-4 text-emerald-500" />}
        />
      </div>

      {/* Spend Charts: Bar Chart vs Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Spend vs. Allocated Budget by Provider
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Run-rate performance across authorized infrastructure accounts
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerChartData}>
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
                  formatter={(v: any) => [`$${v}`, '']}
                />
                <Bar dataKey="Spend" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Budget" fill="#94a3b8" radius={[6, 6, 0, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Cloud Spend Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Share of wallet across hyperscalers
            </p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(v: any) => [`$${v}`, 'Spend']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {costs.map((c) => (
              <div key={c.id} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        c.provider === 'AWS'
                          ? '#FF9900'
                          : c.provider === 'AZURE'
                          ? '#0078D4'
                          : c.provider === 'GCP'
                          ? '#4285F4'
                          : '#10B981',
                    }}
                  />
                  <span className="text-slate-600 dark:text-slate-400">{c.name}</span>
                </div>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {c.percentageOfTotal}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FinOps Optimization Opportunities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Automated FinOps Rightsizing Recommendations
            </h2>
          </div>
          <span className="text-xs text-emerald-600 font-semibold font-mono">
            Total Savings: ${totalPotentialSavings}/mo (${(totalPotentialSavings * 12).toLocaleString()}/yr)
          </span>
        </div>

        <div className="space-y-3">
          {recommendations.map((rec) => {
            const isApplied = rec.status === 'APPLIED';
            return (
              <div
                key={rec.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isApplied
                    ? 'bg-slate-50 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800 opacity-60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {rec.type.replace('_', ' ')}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {rec.title}
                      </h4>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <CloudProviderBadge provider={rec.provider} size="sm" />
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {rec.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs pt-1.5 text-slate-500">
                      <span>Affected Resource: <strong className="font-mono text-slate-700 dark:text-slate-300">{rec.resourceName}</strong></span>
                      <span>Current Run Rate: <strong className="font-mono text-slate-700 dark:text-slate-300">${rec.currentCost}/mo</strong></span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Monthly Savings</span>
                      <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        +${rec.estimatedMonthlySavings}/mo
                      </span>
                    </div>

                    <button
                      disabled={isApplied}
                      onClick={() => applyRecommendation(rec.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer ${
                        isApplied
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isApplied ? 'Applied ✓' : 'Apply Recommendation'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
