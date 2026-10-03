import React, { useState, useMemo } from 'react';
import { Play, Image as ImageIcon, Calendar } from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { CloudFile, cacheKey } from '../../types';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import { getDateGroup, formatDuration } from '../../utils/formatters';
import { MediaLightbox } from './MediaLightbox';

export const GalleryView: React.FC = () => {
  const { files, activeAccountId } = useFileManager();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filter only media files (photos & videos) not in trash
  const mediaFiles = useMemo(() => {
    return files
      .filter((file) => {
        if (file.isTrashed || file.isFolder) return false;
        if (activeAccountId !== 'ALL' && file.ref.accountId !== activeAccountId) {
          return false;
        }
        return (
          file.mimeType.startsWith('image/') ||
          file.mimeType.startsWith('video/')
        );
      })
      .sort((a, b) => b.modifiedTimeMillis - a.modifiedTimeMillis);
  }, [files, activeAccountId]);

  // Group media by date (Today, Yesterday, This Week, This Month, Older)
  const groupedMedia = useMemo(() => {
    const groups: { title: string; items: CloudFile[] }[] = [];
    const map = new Map<string, CloudFile[]>();

    mediaFiles.forEach((file) => {
      const groupKey = getDateGroup(file.modifiedTimeMillis);
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(file);
    });

    map.forEach((items, title) => {
      groups.push({ title, items });
    });

    return groups;
  }, [mediaFiles]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Multi-Account Photo & Video Gallery
          </h2>
          <p className="text-xs text-slate-500">
            Chronological aggregation with per-item account attribution badge
          </p>
        </div>
        <div className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
          {mediaFiles.length} media items
        </div>
      </div>

      {/* Media Grid by Date Group */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {mediaFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center">
            <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
            <p className="font-medium text-slate-600">No photos or videos</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload photos or videos to your Google Accounts to view them here.
            </p>
          </div>
        ) : (
          groupedMedia.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 sticky top-0 bg-slate-50/90 backdrop-blur-xs py-1 z-10">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>{group.title}</span>
                <span className="text-xs font-normal text-slate-400">
                  ({group.items.length})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {group.items.map((file) => {
                  const globalIndex = mediaFiles.findIndex(
                    (m) => cacheKey(m.ref) === cacheKey(file.ref)
                  );
                  const isVideo = file.mimeType.startsWith('video/');

                  return (
                    <div
                      key={cacheKey(file.ref)}
                      onClick={() => setLightboxIndex(globalIndex)}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-slate-200 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200"
                    >
                      {/* Thumbnail Image */}
                      <img
                        src={file.thumbnailLink}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />

                      {/* Video indicator badge */}
                      {isVideo && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Play className="w-3 h-3 fill-white" />
                          <span>{formatDuration(file.durationSeconds)}</span>
                        </div>
                      )}

                      {/* Account Attribution Badge (bottom left) */}
                      <div className="absolute bottom-2 left-2 z-10">
                        <AccountBadge accountId={file.ref.accountId} />
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 text-white">
                        <span className="text-[11px] font-medium truncate drop-shadow-sm">
                          {file.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <MediaLightbox
          mediaFiles={mediaFiles}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSelectIndex={(newIdx) => setLightboxIndex(newIdx)}
        />
      )}
    </div>
  );
};
