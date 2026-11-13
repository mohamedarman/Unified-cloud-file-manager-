import React, { useState, useMemo } from 'react';
import {
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Copy,
  Check,
  Search,
  Table as TableIcon,
  FileCode,
  Volume2,
} from 'lucide-react';
import { CloudFile } from '../../types';
import { getFileTypeDetails } from './FileIcon';
import { humanReadableBytes } from '../../utils/formatters';

interface FilePreviewPaneProps {
  file: CloudFile;
}

export const FilePreviewPane: React.FC<FilePreviewPaneProps> = ({ file }) => {
  const meta = getFileTypeDetails(file.mimeType, file.name, file.isFolder);

  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [textSearch, setTextSearch] = useState<string>('');

  const realTextContent = useMemo(() => {
    if (typeof file.previewText === 'string' && file.previewText.trim().length > 0) {
      return file.previewText;
    }
    return null;
  }, [file.previewText]);

  const parsedCsvRows = useMemo(() => {
    if (!realTextContent) return null;
    const lines = realTextContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) return null;
    return lines.slice(0, 100).map((line) => line.split(','));
  }, [realTextContent]);

  const textLines = useMemo(() => {
    return realTextContent ? realTextContent.split('\n') : [];
  }, [realTextContent]);

  const filteredLines = useMemo(() => {
    if (!textSearch.trim()) return textLines;
    const term = textSearch.toLowerCase();
    return textLines.filter((line) => line.toLowerCase().includes(term));
  }, [textLines, textSearch]);

  const handleCopyText = (content: string) => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isImage =
    (meta.category === 'image' && Boolean(file.contentDataUrl || file.thumbnailLink)) ||
    Boolean(file.thumbnailLink);
  const isPdf = meta.category === 'pdf';
  const isAudio = meta.category === 'audio';
  const isVideo = meta.category === 'video';
  const isSpreadsheet = meta.category === 'spreadsheet';
  const isTextOrCode =
    meta.category === 'document' ||
    meta.category === 'code' ||
    meta.category === 'data' ||
    file.mimeType.includes('text') ||
    file.mimeType.includes('json');

  const imageSrc = file.contentDataUrl || file.thumbnailLink;
  const hasRealPreviewData =
    (isImage && Boolean(imageSrc)) ||
    (isAudio && Boolean(file.contentDataUrl)) ||
    (isVideo && Boolean(file.contentDataUrl)) ||
    (isPdf && Boolean(file.contentDataUrl)) ||
    (isSpreadsheet && Boolean(parsedCsvRows)) ||
    (isTextOrCode && Boolean(realTextContent));

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900/5 dark:bg-slate-900 overflow-hidden transition-all duration-200 flex flex-col ${
        isExpanded ? 'fixed inset-4 z-50 bg-white dark:bg-slate-900 shadow-2xl border-slate-300' : 'w-full'
      }`}
    >
      {/* Top Preview Control Bar */}
      <div className="bg-slate-100/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border uppercase tracking-wider ${meta.bgLightClass} ${meta.borderClass} ${meta.textColorClass}`}
          >
            {meta.badgeText}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
            {meta.label} Preview
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            {hasRealPreviewData ? '(Cached Content)' : '(No Local Bytes)'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {isImage && Boolean(imageSrc) && (
            <>
              <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-slate-600 dark:text-slate-300">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[10px] font-mono text-slate-700 dark:text-slate-200 font-medium">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {realTextContent && (
            <button
              onClick={() => handleCopyText(realTextContent)}
              className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-200 font-medium transition"
              title="Copy Content"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
            title={isExpanded ? 'Minimize Preview' : 'Expand Preview'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Preview Viewport */}
      <div
        className={`relative overflow-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/[0.03] dark:bg-slate-950/60 ${
          isExpanded ? 'flex-1 min-h-[500px]' : 'h-72 sm:h-80'
        }`}
      >
        {/* 1. REAL IMAGE PREVIEW */}
        {isImage && imageSrc && (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={imageSrc}
              alt={file.name}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
            />
          </div>
        )}

        {/* 2. REAL PDF DATA PREVIEW */}
        {isPdf && file.contentDataUrl && (
          <iframe
            src={file.contentDataUrl}
            title={file.name}
            className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
          />
        )}

        {/* 3. REAL SPREADSHEET / CSV PREVIEW */}
        {isSpreadsheet && parsedCsvRows && (
          <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <TableIcon className="w-4 h-4 text-emerald-600" />
                <span>CSV Table Preview</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {parsedCsvRows.length} rows
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase font-mono">
                    <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-8 text-center">#</th>
                    {parsedCsvRows[0].map((header, hIdx) => (
                      <th key={hIdx} className="p-2 border-r border-slate-200 dark:border-slate-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {parsedCsvRows.slice(1).map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td className="p-2 text-center text-slate-400 bg-slate-50 dark:bg-slate-850">
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 text-slate-700 dark:text-slate-300">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. REAL CODE & TEXT DOCUMENT PREVIEW */}
        {isTextOrCode && !isPdf && !isSpreadsheet && realTextContent && (
          <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 text-slate-200">
            <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono text-[11px] text-slate-300">{file.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
                  <input
                    type="text"
                    value={textSearch}
                    onChange={(e) => setTextSearch(e.target.value)}
                    placeholder="Find in file..."
                    className="pl-6 pr-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md text-[10px] text-slate-200 outline-none focus:border-blue-500 w-28 sm:w-36"
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                  {textLines.length} lines
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed select-text space-y-0.5">
              {filteredLines.map((line, idx) => (
                <div key={idx} className="flex items-start gap-3 hover:bg-slate-800/40 px-1 rounded">
                  <span className="text-slate-600 w-6 text-right shrink-0 select-none text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="text-slate-300 break-all whitespace-pre-wrap">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. REAL AUDIO PREVIEW */}
        {isAudio && file.contentDataUrl && (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <Volume2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                  {file.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {humanReadableBytes(file.sizeBytes)}
                </p>
              </div>
            </div>
            <audio controls src={file.contentDataUrl} className="w-full" />
          </div>
        )}

        {/* 6. REAL VIDEO PREVIEW */}
        {isVideo && file.contentDataUrl && (
          <video
            controls
            src={file.contentDataUrl}
            className="max-h-full max-w-full rounded-lg shadow-sm"
          />
        )}

        {/* HONEST UNAVAILABLE STATE WHEN BYTES ARE NOT CACHED LOCALLY */}
        {!hasRealPreviewData && (
          <div className="text-center p-6 space-y-2">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border ${meta.bgLightClass} ${meta.borderClass}`}
            >
              <FileText className={`w-7 h-7 ${meta.colorClass}`} />
            </div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{file.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Live preview content is not cached locally. Download the file or pin it offline from a connected provider account to inspect its contents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
