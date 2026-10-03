import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Star,
  Info,
  Trash2,
  ExternalLink,
  Play,
} from 'lucide-react';
import { CloudFile } from '../../types';
import { useFileManager } from '../../context/FileManagerContext';
import { AccountBadge } from '../FileBrowser/AccountBadge';
import {
  humanReadableBytes,
  formatDate,
  formatDuration,
} from '../../utils/formatters';

interface MediaLightboxProps {
  mediaFiles: CloudFile[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  mediaFiles,
  currentIndex,
  onClose,
  onSelectIndex,
}) => {
  const { downloadFile, toggleStar, trashFile, accounts } = useFileManager();
  const [showInfo, setShowInfo] = useState(false);

  const currentMedia = mediaFiles[currentIndex];
  if (!currentMedia) return null;

  const isVideo = currentMedia.mimeType.startsWith('video/');
  const account = accounts.find((a) => a.localId === currentMedia.ref.accountId);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) onSelectIndex(currentIndex - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < mediaFiles.length - 1) onSelectIndex(currentIndex + 1);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between text-white animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AccountBadge accountId={currentMedia.ref.accountId} showEmail size="md" />
          <span className="font-medium text-sm truncate max-w-md" title={currentMedia.name}>
            {currentMedia.name}
          </span>
          <span className="text-xs text-white/50 hidden sm:inline">
            ({currentIndex + 1} of {mediaFiles.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleStar(currentMedia)}
            className={`p-2 rounded-full hover:bg-white/10 transition ${
              currentMedia.isStarred ? 'text-amber-400 fill-amber-400' : 'text-white/70'
            }`}
            title="Star"
          >
            <Star className={`w-4 h-4 ${currentMedia.isStarred ? 'fill-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => downloadFile(currentMedia)}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-full hover:bg-white/10 transition ${
              showInfo ? 'bg-white/20 text-white' : 'text-white/70'
            }`}
            title="Toggle Details"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              trashFile(currentMedia);
              onClose();
            }}
            className="p-2 rounded-full hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition"
            title="Move to Trash"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition ml-2"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-1 flex items-center justify-center relative p-4 overflow-hidden"
      >
        {/* Previous Button */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white transition z-20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Content */}
        <div className="max-h-full max-w-full flex items-center justify-center">
          {isVideo ? (
            <div className="relative flex flex-col items-center">
              <img
                src={currentMedia.thumbnailLink}
                alt={currentMedia.name}
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg hover:scale-105 transition cursor-pointer">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xs px-3 py-1 rounded text-xs">
                Duration: {formatDuration(currentMedia.durationSeconds)}
              </div>
            </div>
          ) : (
            <img
              src={currentMedia.thumbnailLink}
              alt={currentMedia.name}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
            />
          )}
        </div>

        {/* Next Button */}
        {currentIndex < mediaFiles.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white transition z-20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Side Info Drawer */}
        {showInfo && (
          <div className="absolute right-4 top-4 bottom-4 w-80 bg-slate-900/95 backdrop-blur-md rounded-xl border border-white/10 p-4 text-xs space-y-4 overflow-y-auto z-30 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 font-semibold text-white">
              <span>Media Details</span>
              <button onClick={() => setShowInfo(false)} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-white/50 block mb-0.5">Google Drive Account</span>
                <div className="font-medium text-white">{account?.displayName}</div>
                <div className="text-[11px] text-white/60">{account?.displayEmail}</div>
              </div>

              <div>
                <span className="text-white/50 block mb-0.5">File Name</span>
                <span className="text-white font-medium break-all">{currentMedia.name}</span>
              </div>

              <div>
                <span className="text-white/50 block mb-0.5">MIME Type</span>
                <span className="font-mono text-[11px] text-white/80">{currentMedia.mimeType}</span>
              </div>

              <div>
                <span className="text-white/50 block mb-0.5">File Size</span>
                <span>{humanReadableBytes(currentMedia.sizeBytes)}</span>
              </div>

              {currentMedia.dimensions && (
                <div>
                  <span className="text-white/50 block mb-0.5">Resolution</span>
                  <span>
                    {currentMedia.dimensions.width} × {currentMedia.dimensions.height} px
                  </span>
                </div>
              )}

              <div>
                <span className="text-white/50 block mb-0.5">Date Modified</span>
                <span>{formatDate(currentMedia.modifiedTimeMillis)}</span>
              </div>

              <div>
                <span className="text-white/50 block mb-0.5">Cloud File ID</span>
                <span className="font-mono text-[10px] text-white/60 break-all">
                  {currentMedia.ref.fileId}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Thumbnails Strip */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-2.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2 overflow-x-auto z-10"
      >
        {mediaFiles.map((m, idx) => (
          <button
            key={m.ref.fileId}
            onClick={() => onSelectIndex(idx)}
            className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition ${
              idx === currentIndex
                ? 'border-blue-500 scale-105 shadow-md'
                : 'border-transparent opacity-50 hover:opacity-100'
            }`}
          >
            <img src={m.thumbnailLink} alt={m.name} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};
