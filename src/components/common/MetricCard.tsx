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
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 transition-all duration-150 flex flex-col justify-between ${
        onClick
          ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 flex items-center justify-center text-slate-600 dark:text-slate-300">
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="my-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800/80">
        {change ? (
          <div className="flex items-center gap-1">
            <span
              className={`flex items-center font-medium font-mono tabular-nums ${
                change.trend === 'UP'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : change.trend === 'DOWN'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {change.trend === 'UP' && <ArrowUpRight className="w-3.5 h-3.5" />}
              {change.trend === 'DOWN' && <ArrowDownRight className="w-3.5 h-3.5" />}
              {change.trend === 'NEUTRAL' && <Minus className="w-3.5 h-3.5" />}
              <span>{change.value}</span>
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              {change.period || 'vs last month'}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 truncate">
            {subtitle || 'Real-time telemetry'}
          </span>
        )}
      </div>
    </div>
  );
};
