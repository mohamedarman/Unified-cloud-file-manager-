import React from 'react';
import { CloudPlatform } from '../../types/infrastructure';

interface CloudProviderBadgeProps {
  provider: CloudPlatform;
  size?: 'sm' | 'md';
  showFullName?: boolean;
}

export const CloudProviderBadge: React.FC<CloudProviderBadgeProps> = ({
  provider,
  size = 'md',
  showFullName = false,
}) => {
  const getProviderConfig = () => {
    switch (provider) {
      case 'AWS':
        return {
          short: 'AWS',
          full: 'Amazon Web Services',
          color: '#FF9900',
          textColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'AZURE':
        return {
          short: 'Azure',
          full: 'Microsoft Azure',
          color: '#0078D4',
          textColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'GCP':
        return {
          short: 'GCP',
          full: 'Google Cloud Platform',
          color: '#4285F4',
          textColor: 'text-sky-600 dark:text-sky-400',
        };
      case 'GOOGLE_DRIVE':
        return {
          short: 'Drive',
          full: 'Google Drive Enterprise',
          color: '#1A73E8',
          textColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'ONE_DRIVE':
        return {
          short: 'OneDrive',
          full: 'Microsoft OneDrive',
          color: '#0078D4',
          textColor: 'text-cyan-600 dark:text-cyan-400',
        };
      case 'DROPBOX':
        return {
          short: 'Dropbox',
          full: 'Dropbox Cloud',
          color: '#0061FF',
          textColor: 'text-indigo-600 dark:text-indigo-400',
        };
      case 'BOX':
        return {
          short: 'Box',
          full: 'Box Enterprise Vault',
          color: '#0061D5',
          textColor: 'text-blue-600 dark:text-blue-400',
        };
      default:
        return {
          short: provider,
          full: provider,
          color: '#64748B',
          textColor: 'text-slate-600 dark:text-slate-400',
        };
    }
  };

  const config = getProviderConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium shrink-0 ${
        size === 'sm' ? 'text-[11px]' : 'text-xs'
      }`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: config.color }}
      />
      <span className="font-semibold text-slate-800 dark:text-slate-200">
        {showFullName ? config.full : config.short}
      </span>
    </span>
  );
};
