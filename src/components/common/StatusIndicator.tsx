import React from 'react';
import { ResourceStatus } from '../../types/infrastructure';

interface StatusIndicatorProps {
  status: ResourceStatus | 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'SUCCESS' | 'FAILED' | 'ACTIVE';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  showPulse = false,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'HEALTHY':
      case 'CONNECTED':
      case 'SUCCESS':
      case 'ACTIVE':
        return {
          colorClass: 'bg-emerald-500',
          ringClass: 'bg-emerald-400',
          textClass: 'text-emerald-700 dark:text-emerald-400',
          defaultLabel: 'Healthy',
        };
      case 'WARNING':
      case 'DEGRADED':
        return {
          colorClass: 'bg-amber-500',
          ringClass: 'bg-amber-400',
          textClass: 'text-amber-700 dark:text-amber-400',
          defaultLabel: 'Warning',
        };
      case 'CRITICAL':
      case 'DISCONNECTED':
      case 'FAILED':
        return {
          colorClass: 'bg-rose-500',
          ringClass: 'bg-rose-400',
          textClass: 'text-rose-700 dark:text-rose-400',
          defaultLabel: 'Critical',
        };
      case 'STOPPED':
      case 'PROVISIONING':
      default:
        return {
          colorClass: 'bg-slate-400 dark:bg-slate-500',
          ringClass: 'bg-slate-300 dark:bg-slate-600',
          textClass: 'text-slate-600 dark:text-slate-400',
          defaultLabel: status === 'STOPPED' ? 'Stopped' : 'Provisioning',
        };
    }
  };

  const config = getStatusConfig();
  const dotSize =
    size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const textSize =
    size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-xs' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${config.textClass} ${textSize}`}>
      <span className="relative flex items-center justify-center shrink-0">
        {showPulse && (status === 'WARNING' || status === 'CRITICAL' || status === 'HEALTHY') && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.colorClass}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${config.colorClass}`} />
      </span>
      <span>{label || config.defaultLabel}</span>
    </span>
  );
};
