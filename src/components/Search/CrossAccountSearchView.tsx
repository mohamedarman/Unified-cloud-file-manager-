import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Layers,
  FileQuestion,
  Filter,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudFile, ProviderId, PROVIDERS, cacheKey } from '../../types';
import { FileItemCard } from '../FileBrowser/FileItemCard';
import { FileItemRow } from '../FileBrowser/FileItemRow';

interface CrossAccountSearchViewProps {
  onOpenDetails: (file: CloudFile) => void;
}

export const CrossAccountSearchView: React.FC<CrossAccountSearchViewProps> = ({
  onOpenDetails,
}) => {
  const { files, accounts, searchQuery, setSearchQuery, viewMode } = useFileManager();

  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'ALL'>('ALL');
  const [selectedMimeType, setSelectedMimeType] = useState<string>('ALL');

  const suggestedQueries = [
    'Roadmap',
    'Budget',
    'Strategy',
    'Autumn',
    'Tax',
    'Research',
    'Dataset',
    'Presentation',
  ];

  // Perform search across all accounts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const q = searchQuery.toLowerCase().trim();

    return files.filter((file) => {
      if (file.isTrashed) return false;

      // Provider filter
      if (selectedProvider !== 'ALL' && file.ref.provider !== selectedProvider) {
        return false;
      }

      // MIME type filter
      if (selectedMimeType === 'DOCS') {
        if (
          file.isFolder ||
          (!file.mimeType.includes('document') &&
            !file.mimeType.includes('sheet') &&
            !file.mimeType.includes('presentation') &&
            !file.mimeType.includes('pdf'))
        ) {
          return false;
        }
      } else if (selectedMimeType === 'MEDIA') {
        if (
          file.isFolder ||
          (!file.mimeType.startsWith('image/') && !file.mimeType.startsWith('video/'))
        ) {
          return false;
        }
      }

      return (
        file.name.toLowerCase().includes(q) ||
        file.mimeType.toLowerCase().includes(q) ||
        (file.previewText && file.previewText.toLowerCase().includes(q))
      );
    });
  }, [files, searchQuery, selectedProvider, selectedMimeType]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {/* Search Header */}
      <div className="max-w-2xl mx-auto space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight text-center">
          Unified Multi-Cloud Search
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Instant cross-account recall across Google Drive, OneDrive, Dropbox, and Box
        </p>

        {/* Big Search Input */}
        <div className="relative flex items-center shadow-xs">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all connected cloud accounts..."
            autoFocus
            className="w-full pl-11 pr-10 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl outline-none transition shadow-xs placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Suggested Queries */}
        {!searchQuery && (
          <div className="pt-2 text-center">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mr-2">Try searching:</span>
            <div className="inline-flex flex-wrap gap-1.5 justify-center mt-1">
              {suggestedQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => setSearchQuery(q)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition shadow-2xs cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {searchQuery && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {/* Provider Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                onClick={() => setSelectedProvider('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedProvider === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                All Providers ({accounts.length})
              </button>

              {(Object.keys(PROVIDERS) as ProviderId[]).map((pId) => {
                const prov = PROVIDERS[pId];
                const count = files.filter((f) => f.ref.provider === pId && !f.isTrashed).length;
                if (count === 0) return null;

                return (
                  <button
                    key={pId}
                    onClick={() => setSelectedProvider(pId)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                      selectedProvider === pId
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: prov.brandColor }}
                    />
                    <span>{prov.shortName}</span>
                  </button>
                );
              })}
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedMimeType('ALL')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  selectedMimeType === 'ALL'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setSelectedMimeType('DOCS')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  selectedMimeType === 'DOCS'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Docs
              </button>
              <button
                onClick={() => setSelectedMimeType('MEDIA')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  selectedMimeType === 'MEDIA'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Media
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results View */}
      {searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Found <strong>{searchResults.length}</strong> matching files across connected clouds
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Provider fan-out with QuotaGovernor rate ceiling
            </span>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <FileQuestion className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No matching files found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Try refining your search keyword or changing the provider filter.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {searchResults.map((file) => (
                <FileItemCard
                  key={cacheKey(file.ref)}
                  file={file}
                  onOpenDetails={onOpenDetails}
                  onDoubleClick={onOpenDetails}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <tbody>
                  {searchResults.map((file) => (
                    <FileItemRow
                      key={cacheKey(file.ref)}
                      file={file}
                      onOpenDetails={onOpenDetails}
                      onDoubleClick={onOpenDetails}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
