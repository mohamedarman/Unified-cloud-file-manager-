import React from 'react';
import { Loader2 } from 'lucide-react';

export const ViewSuspenseFallback: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 p-6 space-y-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-850 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-850" />
            </div>
            <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-2.5 w-36 bg-slate-100 dark:bg-slate-850 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
        <span className="text-xs text-slate-400 font-mono">Initializing multi-cloud module...</span>
      </div>
    </div>
  );
};
