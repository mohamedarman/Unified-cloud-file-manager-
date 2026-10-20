import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: {
    value: string | number;
    trend: 'UP' | 'DOWN' | 'NEUTRAL';
    period?: string;
  };
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  change,
  subtitle,
  icon,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-lg p-5 transition-all duration-150 flex flex-col justify-between ${
        onClick
          ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
          {title}
        </span>
        {icon && (
          <div className="text-slate-400">
            {icon}
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold text-slate-900 tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="text-sm text-slate-500 font-medium">
              {unit}
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {change ? (
          <div className="flex items-center gap-1 font-medium tabular-nums">
            <span className={change.trend === 'UP' ? 'text-emerald-600' : 'text-rose-600'}>
              {change.trend === 'UP' ? '+' : ''}{change.value}
            </span>
            <span className="text-slate-400 font-normal">
              {change.period || 'vs last month'}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">
            {subtitle || 'Real-time telemetry'}
          </span>
        )}
      </div>
    </div>
  );
};
