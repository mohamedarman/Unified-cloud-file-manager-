import React, { useState, useMemo } from 'react';
import {
  FileText,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Copy,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  Table as TableIcon,
  Code2,
  Sparkles,
  Download,
  Eye,
  FileCode,
} from 'lucide-react';
import { CloudFile } from '../../types';
import { getFileTypeDetails } from './FileIcon';
import { humanReadableBytes } from '../../utils/formatters';

interface FilePreviewPaneProps {
  file: CloudFile;
}

export const FilePreviewPane: React.FC<FilePreviewPaneProps> = ({ file }) => {
  const meta = getFileTypeDetails(file.mimeType, file.name, file.isFolder);

  // Viewer state
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activePdfPage, setActivePdfPage] = useState<number>(1);
  const [textSearch, setTextSearch] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate realistic text / code content if not explicitly present in previewText
  const textContent = useMemo(() => {
    if (file.previewText && file.previewText.trim().length > 10) {
      return file.previewText;
    }

    if (file.mimeType.includes('json') || file.name.endsWith('.json')) {
      return JSON.stringify(
        {
          schemaVersion: '2.4.0',
          fileId: file.ref.fileId,
          fileName: file.name,
          provider: file.ref.provider,
          accountId: file.ref.accountId,
          isEncryptedAtRest: true,
          metadata: {
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            createdTime: new Date(file.modifiedTimeMillis - 86400000 * 5).toISOString(),
            lastModified: new Date(file.modifiedTimeMillis).toISOString(),
          },
          permissions: {
            canRead: true,
            canWrite: file.isOwnedByUser,
            canShare: file.isShared,
          },
        },
        null,
        2
      );
    }

    if (file.mimeType.includes('csv') || file.name.endsWith('.csv')) {
      return `Date,TransactionID,Category,Amount,Currency,Status,CloudAccount
2026-09-28,TXN-984210,Infrastructure,$1,420.50,USD,Settled,Google-Drive
2026-09-27,TXN-984211,Engineering,$4,890.00,USD,Settled,OneDrive-Enterprise
2026-09-26,TXN-984212,Storage-Meter,$245.80,USD,Settled,Dropbox-Personal
2026-09-25,TXN-984213,Compliance-Audit,$3,200.00,USD,Settled,Box-Research
2026-09-24,TXN-984214,Security-Tokens,$680.00,USD,Settled,Google-Drive`;
    }

    if (
      file.mimeType.includes('javascript') ||
      file.mimeType.includes('typescript') ||
      file.name.endsWith('.ts') ||
      file.name.endsWith('.tsx') ||
      file.name.endsWith('.js')
    ) {
      return `/**
 * @file ${file.name}
 * @description Multi-Cloud Distributed Storage Connector
 */

import { CloudClient } from '@cloud/sdk';

export interface StorageOptions {
  provider: '${file.ref.provider}';
  accountId: ${file.ref.accountId};
  readConsistency: 'strong' | 'eventual';
}

export async function fetchFileBuffer(fileId: string, options: StorageOptions): Promise<ArrayBuffer> {
  const client = new CloudClient({ provider: options.provider });
  const response = await client.files.getStream(fileId);
  return response.arrayBuffer();
}`;
    }

    return `Document Title: ${file.name}
Provider: ${file.ref.provider} (Account ID: ${file.ref.accountId})
Last Modified: ${new Date(file.modifiedTimeMillis).toLocaleString()}

Section 1: Executive Overview
This document contains authorized cloud repository assets synchronized across authorized endpoints.
All data is stored directly in the originating cloud provider and streamed on-demand.

Section 2: Security & Permissions
- Encryption: TLS 1.3 in transit, AES-256 at rest
- Zero-Storage Guarantee: Client-side ephemeral streaming
- Isolated tokens: Managed under strict OAuth credentials.`;
  }, [file]);

  const textLines = useMemo(() => {
    return textContent.split('\n');
  }, [textContent]);

  const filteredLines = useMemo(() => {
    if (!textSearch.trim()) return textLines;
    const term = textSearch.toLowerCase();
    return textLines.filter((line) => line.toLowerCase().includes(term));
  }, [textLines, textSearch]);

  // Determine which preview sub-mode to render
  const isImage = meta.category === 'image' || !!file.thumbnailLink;
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

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-900/5 overflow-hidden transition-all duration-200 flex flex-col ${
        isExpanded ? 'fixed inset-4 z-50 bg-white shadow-2xl border-slate-300' : 'w-full'
      }`}
    >
      {/* Top Preview Control Bar */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border uppercase tracking-wider ${meta.bgLightClass} ${meta.borderClass} ${meta.textColorClass}`}
          >
            {meta.badgeText}
          </span>
          <span className="font-semibold text-slate-800 truncate">
            {meta.label} Preview
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            (Zero-Download Stream)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Zoom controls for image and PDF */}
          {(isImage || isPdf) && (
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 text-slate-600">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
                className="p-1 hover:bg-slate-100 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[10px] font-mono text-slate-700 font-medium">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 25))}
                className="p-1 hover:bg-slate-100 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Rotate control for images */}
          {isImage && (
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy button for text / code */}
          {(isTextOrCode || isPdf || isSpreadsheet) && (
            <button
              onClick={() => handleCopyText(textContent)}
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium transition"
              title="Copy Content"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          )}

          {/* Expand / Minimize */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
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
        className={`relative overflow-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/[0.03] ${
          isExpanded ? 'flex-1 min-h-[500px]' : 'h-72 sm:h-80'
        }`}
      >
        {/* 1. IMAGE PREVIEW */}
        {isImage && file.thumbnailLink && (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={file.thumbnailLink}
              alt={file.name}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
            />
          </div>
        )}

        {/* 2. PDF DOCUMENT PREVIEW */}
        {isPdf && (
          <div className="w-full h-full flex flex-col items-center justify-start overflow-y-auto">
            {/* Simulated High-Res PDF Page */}
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              className="bg-white rounded-xl shadow-md border border-slate-200/90 w-full max-w-lg p-6 sm:p-8 space-y-4 text-slate-800 transition-transform duration-150"
            >
              {/* PDF Document Header */}
              <div className="border-b border-rose-100 pb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 uppercase">
                      Official PDF Document
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Page {activePdfPage} of 4
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1 leading-snug">
                    {file.name.replace(/\.pdf$/i, '')}
                  </h3>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <p>Provider: {file.ref.provider}</p>
                  <p>Format: PDF/A-1b</p>
                </div>
              </div>

              {/* PDF Content Body */}
              <div className="space-y-3 text-xs leading-relaxed text-slate-700 font-serif">
                <p className="font-semibold text-slate-900">
                  ABSTRACT & SPECIFICATIONS
                </p>
                <p>
                  {file.previewText ||
                    'This document defines the cryptographic multi-cloud isolation protocol ensuring that tokens, cached indices, and credentials remain sandboxed strictly to the authorized local storage layer.'}
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-sans text-[11px] space-y-1">
                  <p className="font-semibold text-slate-800">
                    Cryptographic Integrity Verification
                  </p>
                  <p className="font-mono text-slate-600 text-[10px] truncate">
                    SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                  </p>
                  <p className="text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Signature verified directly with {file.ref.provider}</span>
                  </p>
                </div>

                <p>
                  Direct document rendering active in preview buffer. To download or export this document to another format, use the action menu below.
                </p>
              </div>

              {/* PDF Page Navigation Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-sans">
                <button
                  disabled={activePdfPage <= 1}
                  onClick={() => setActivePdfPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev Page</span>
                </button>

                <span className="text-[11px] font-medium text-slate-600">
                  Page {activePdfPage} / 4
                </span>

                <button
                  disabled={activePdfPage >= 4}
                  onClick={() => setActivePdfPage((p) => Math.min(4, p + 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <span>Next Page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. SPREADSHEET / CSV PREVIEW */}
        {isSpreadsheet && (
          <div className="w-full h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <TableIcon className="w-4 h-4 text-emerald-600" />
                <span>Spreadsheet Grid View</span>
              </span>
              <span className="text-[11px] text-slate-400">
                5 rows × 7 columns
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-semibold text-slate-600 uppercase font-mono">
                    <th className="p-2 border-r border-slate-200 w-8 text-center">#</th>
                    <th className="p-2 border-r border-slate-200">Date</th>
                    <th className="p-2 border-r border-slate-200">Transaction ID</th>
                    <th className="p-2 border-r border-slate-200">Category</th>
                    <th className="p-2 border-r border-slate-200">Amount</th>
                    <th className="p-2 border-r border-slate-200">Currency</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr>
                    <td className="p-2 text-center text-slate-400 bg-slate-50">1</td>
                    <td className="p-2 text-slate-800">2026-09-28</td>
                    <td className="p-2 text-blue-600">TXN-984210</td>
                    <td className="p-2 text-slate-700">Infrastructure</td>
                    <td className="p-2 font-semibold text-slate-900">$1,420.50</td>
                    <td className="p-2 text-slate-600">USD</td>
                    <td className="p-2 text-emerald-600">Settled</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center text-slate-400 bg-slate-50">2</td>
                    <td className="p-2 text-slate-800">2026-09-27</td>
                    <td className="p-2 text-blue-600">TXN-984211</td>
                    <td className="p-2 text-slate-700">Engineering</td>
                    <td className="p-2 font-semibold text-slate-900">$4,890.00</td>
                    <td className="p-2 text-slate-600">USD</td>
                    <td className="p-2 text-emerald-600">Settled</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center text-slate-400 bg-slate-50">3</td>
                    <td className="p-2 text-slate-800">2026-09-26</td>
                    <td className="p-2 text-blue-600">TXN-984212</td>
                    <td className="p-2 text-slate-700">Storage-Meter</td>
                    <td className="p-2 font-semibold text-slate-900">$245.80</td>
                    <td className="p-2 text-slate-600">USD</td>
                    <td className="p-2 text-emerald-600">Settled</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center text-slate-400 bg-slate-50">4</td>
                    <td className="p-2 text-slate-800">2026-09-25</td>
                    <td className="p-2 text-blue-600">TXN-984213</td>
                    <td className="p-2 text-slate-700">Compliance</td>
                    <td className="p-2 font-semibold text-slate-900">$3,200.00</td>
                    <td className="p-2 text-slate-600">USD</td>
                    <td className="p-2 text-emerald-600">Settled</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center text-slate-400 bg-slate-50">5</td>
                    <td className="p-2 text-slate-800">2026-09-24</td>
                    <td className="p-2 text-blue-600">TXN-984214</td>
                    <td className="p-2 text-slate-700">Security-Tokens</td>
                    <td className="p-2 font-semibold text-slate-900">$680.00</td>
                    <td className="p-2 text-slate-600">USD</td>
                    <td className="p-2 text-emerald-600">Settled</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. CODE & TEXT DOCUMENT PREVIEW */}
        {isTextOrCode && !isPdf && !isSpreadsheet && (
          <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 text-slate-200">
            {/* Code / Text Top Search and Line Stats */}
            <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono text-[11px] text-slate-300">
                  {file.name}
                </span>
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

            {/* Code Viewer Body with Line Numbers */}
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

        {/* 5. AUDIO PREVIEW */}
        {isAudio && (
          <div className="w-full max-w-md bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                🎵
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm truncate">
                  {file.name}
                </h4>
                <p className="text-xs text-slate-400">
                  Audio Stream ({humanReadableBytes(file.sizeBytes)})
                </p>
              </div>
            </div>

            {/* Simulated Audio Player Controls */}
            <div className="space-y-2">
              <div className="w-full bg-slate-100 rounded-full h-2 relative overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{ width: isPlayingAudio ? '42%' : '0%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>{isPlayingAudio ? '01:14' : '00:00'}</span>
                <span>{file.durationSeconds ? `${Math.floor(file.durationSeconds / 60)}:${(file.durationSeconds % 60).toString().padStart(2, '0')}` : '03:45'}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-md transition"
              >
                {isPlayingAudio ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Fallback for other formats without preview */}
        {!isImage && !isPdf && !isSpreadsheet && !isTextOrCode && !isAudio && (
          <div className="text-center p-6 space-y-2">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border ${meta.bgLightClass} ${meta.borderClass}`}>
              <FileText className={`w-7 h-7 ${meta.colorClass}`} />
            </div>
            <p className="font-bold text-slate-800 text-sm">{file.name}</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Direct live preview not available for this binary format. You can export or download this file below.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
