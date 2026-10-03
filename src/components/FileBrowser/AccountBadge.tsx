import React from 'react';
import { useFileManager } from '../../context/FileManagerContext';
import { LocalAccountId, PROVIDERS } from '../../types';

interface AccountBadgeProps {
  accountId: LocalAccountId;
  showEmail?: boolean;
  size?: 'sm' | 'md';
}

export const AccountBadge: React.FC<AccountBadgeProps> = ({
  accountId,
  showEmail = false,
  size = 'sm',
}) => {
  const { accounts } = useFileManager();
  const account = accounts.find((a) => a.localId === accountId);

  if (!account) return null;

  const provider = PROVIDERS[account.provider];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium shrink-0 text-slate-700 dark:text-slate-300 ${
        size === 'sm' ? 'text-[11px]' : 'text-xs'
      }`}
      title={`Stored in ${provider?.name || 'Cloud'}: ${account.displayEmail}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: account.color }}
      />
      <span className="font-semibold text-slate-800 dark:text-slate-200">
        {account.badgeLabel}
      </span>
      {showEmail && (
        <>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-400 dark:text-slate-500 font-normal hidden md:inline truncate max-w-[140px]">
            {account.displayEmail}
          </span>
        </>
      )}
    </span>
  );
};
