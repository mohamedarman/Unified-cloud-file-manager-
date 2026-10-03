import React from 'react';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Video,
  Music,
  FileCode,
  Archive,
  File,
  Code2,
  Table,
  Film,
  FileJson,
  FileBox,
  Binary,
} from 'lucide-react';

export interface FileTypeMeta {
  category: 'folder' | 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'image' | 'video' | 'audio' | 'code' | 'archive' | 'data' | 'generic';
  label: string;
  badgeText: string;
  colorClass: string;
  fillClass: string;
  bgLightClass: string;
  borderClass: string;
  ringClass: string;
  textColorClass: string;
}

/**
 * Returns comprehensive metadata, colors, badges, and Lucide icon configs for any MIME type and file extension.
 */
export function getFileTypeDetails(
  mimeType: string,
  fileName: string = '',
  isFolder: boolean = false
): FileTypeMeta {
  if (isFolder) {
    return {
      category: 'folder',
      label: 'Folder',
      badgeText: 'DIR',
      colorClass: 'text-amber-500',
      fillClass: 'fill-amber-500/20',
      bgLightClass: 'bg-amber-50/80',
      borderClass: 'border-amber-200/80',
      ringClass: 'ring-amber-400/30',
      textColorClass: 'text-amber-800',
    };
  }

  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  // 1. PDF
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return {
      category: 'pdf',
      label: 'PDF Document',
      badgeText: 'PDF',
      colorClass: 'text-rose-600',
      fillClass: 'fill-rose-500/10',
      bgLightClass: 'bg-rose-50/80',
      borderClass: 'border-rose-200/80',
      ringClass: 'ring-rose-400/30',
      textColorClass: 'text-rose-800',
    };
  }

  // 2. Spreadsheets & Tabular Data
  if (
    mime.includes('spreadsheet') ||
    mime.includes('sheet') ||
    mime.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv')
  ) {
    return {
      category: 'spreadsheet',
      label: 'Spreadsheet',
      badgeText: name.endsWith('.csv') ? 'CSV' : 'XLS',
      colorClass: 'text-emerald-600',
      fillClass: 'fill-emerald-500/10',
      bgLightClass: 'bg-emerald-50/80',
      borderClass: 'border-emerald-200/80',
      ringClass: 'ring-emerald-400/30',
      textColorClass: 'text-emerald-800',
    };
  }

  // 3. Presentations & Slide Decks
  if (
    mime.includes('presentation') ||
    mime.includes('slides') ||
    mime.includes('powerpoint') ||
    name.endsWith('.pptx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.key')
  ) {
    return {
      category: 'presentation',
      label: 'Presentation',
      badgeText: 'PPT',
      colorClass: 'text-amber-600',
      fillClass: 'fill-amber-500/10',
      bgLightClass: 'bg-amber-50/80',
      borderClass: 'border-amber-200/80',
      ringClass: 'ring-amber-400/30',
      textColorClass: 'text-amber-800',
    };
  }

  // 4. Word & Text Documents
  if (
    mime.includes('document') ||
    mime.includes('word') ||
    mime.includes('rtf') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    name.endsWith('.rtf') ||
    name.endsWith('.odt')
  ) {
    return {
      category: 'document',
      label: 'Document',
      badgeText: 'DOC',
      colorClass: 'text-blue-600',
      fillClass: 'fill-blue-500/10',
      bgLightClass: 'bg-blue-50/80',
      borderClass: 'border-blue-200/80',
      ringClass: 'ring-blue-400/30',
      textColorClass: 'text-blue-800',
    };
  }

  // 5. Source Code & Developer Files
  if (
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('python') ||
    mime.includes('html') ||
    mime.includes('css') ||
    mime.includes('xml') ||
    mime.includes('yaml') ||
    name.endsWith('.js') ||
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.jsx') ||
    name.endsWith('.py') ||
    name.endsWith('.json') ||
    name.endsWith('.html') ||
    name.endsWith('.css') ||
    name.endsWith('.sql') ||
    name.endsWith('.sh') ||
    name.endsWith('.yaml') ||
    name.endsWith('.yml')
  ) {
    return {
      category: 'code',
      label: 'Source Code',
      badgeText: name.split('.').pop()?.toUpperCase() || 'CODE',
      colorClass: 'text-indigo-600',
      fillClass: 'fill-indigo-500/10',
      bgLightClass: 'bg-indigo-50/80',
      borderClass: 'border-indigo-200/80',
      ringClass: 'ring-indigo-400/30',
      textColorClass: 'text-indigo-800',
    };
  }

  // 6. Images & Graphic Assets
  if (
    mime.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.svg') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif')
  ) {
    return {
      category: 'image',
      label: 'Image',
      badgeText: name.split('.').pop()?.toUpperCase() || 'IMG',
      colorClass: 'text-rose-500',
      fillClass: 'fill-rose-500/10',
      bgLightClass: 'bg-rose-50/80',
      borderClass: 'border-rose-200/80',
      ringClass: 'ring-rose-400/30',
      textColorClass: 'text-rose-800',
    };
  }

  // 7. Videos
  if (
    mime.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.mov') ||
    name.endsWith('.avi') ||
    name.endsWith('.mkv') ||
    name.endsWith('.webm')
  ) {
    return {
      category: 'video',
      label: 'Video',
      badgeText: 'VID',
      colorClass: 'text-purple-600',
      fillClass: 'fill-purple-500/10',
      bgLightClass: 'bg-purple-50/80',
      borderClass: 'border-purple-200/80',
      ringClass: 'ring-purple-400/30',
      textColorClass: 'text-purple-800',
    };
  }

  // 8. Audio & Soundtracks
  if (
    mime.startsWith('audio/') ||
    mime.includes('audio') ||
    name.endsWith('.mp3') ||
    name.endsWith('.m4a') ||
    name.endsWith('.wav') ||
    name.endsWith('.aac') ||
    name.endsWith('.flac') ||
    name.endsWith('.ogg')
  ) {
    return {
      category: 'audio',
      label: 'Audio',
      badgeText: 'AUD',
      colorClass: 'text-amber-500',
      fillClass: 'fill-amber-500/10',
      bgLightClass: 'bg-amber-50/80',
      borderClass: 'border-amber-200/80',
      ringClass: 'ring-amber-400/30',
      textColorClass: 'text-amber-800',
    };
  }

  // 9. Archives & Compressed Packages
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('gzip') ||
    mime.includes('rar') ||
    mime.includes('7z') ||
    name.endsWith('.zip') ||
    name.endsWith('.tar') ||
    name.endsWith('.gz') ||
    name.endsWith('.rar') ||
    name.endsWith('.7z')
  ) {
    return {
      category: 'archive',
      label: 'Archive',
      badgeText: 'ZIP',
      colorClass: 'text-cyan-600',
      fillClass: 'fill-cyan-500/10',
      bgLightClass: 'bg-cyan-50/80',
      borderClass: 'border-cyan-200/80',
      ringClass: 'ring-cyan-400/30',
      textColorClass: 'text-cyan-800',
    };
  }

  // 10. Plain text & Notes
  if (mime.includes('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return {
      category: 'document',
      label: 'Text File',
      badgeText: name.endsWith('.md') ? 'MD' : 'TXT',
      colorClass: 'text-slate-600',
      fillClass: 'fill-slate-500/10',
      bgLightClass: 'bg-slate-50/80',
      borderClass: 'border-slate-200/80',
      ringClass: 'ring-slate-400/30',
      textColorClass: 'text-slate-800',
    };
  }

  // Default generic file
  return {
    category: 'generic',
    label: 'File',
    badgeText: 'FILE',
    colorClass: 'text-slate-500',
    fillClass: 'fill-slate-500/10',
    bgLightClass: 'bg-slate-50/80',
    borderClass: 'border-slate-200/80',
    ringClass: 'ring-slate-400/30',
    textColorClass: 'text-slate-700',
  };
}

interface FileIconProps {
  mimeType: string;
  fileName?: string;
  isFolder: boolean;
  className?: string;
  showBadge?: boolean;
}

export const FileIcon: React.FC<FileIconProps> = ({
  mimeType,
  fileName = '',
  isFolder,
  className = 'w-5 h-5',
  showBadge = false,
}) => {
  const meta = getFileTypeDetails(mimeType, fileName, isFolder);

  const renderIcon = () => {
    switch (meta.category) {
      case 'folder':
        return <Folder className={`${className} ${meta.colorClass} ${meta.fillClass}`} />;
      case 'pdf':
        return <FileText className={`${className} ${meta.colorClass}`} />;
      case 'spreadsheet':
        return <FileSpreadsheet className={`${className} ${meta.colorClass}`} />;
      case 'presentation':
        return <Presentation className={`${className} ${meta.colorClass}`} />;
      case 'document':
        return <FileText className={`${className} ${meta.colorClass}`} />;
      case 'code':
        return <FileCode className={`${className} ${meta.colorClass}`} />;
      case 'image':
        return <ImageIcon className={`${className} ${meta.colorClass}`} />;
      case 'video':
        return <Video className={`${className} ${meta.colorClass}`} />;
      case 'audio':
        return <Music className={`${className} ${meta.colorClass}`} />;
      case 'archive':
        return <Archive className={`${className} ${meta.colorClass}`} />;
      default:
        return <File className={`${className} ${meta.colorClass}`} />;
    }
  };

  if (!showBadge) {
    return renderIcon();
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      {renderIcon()}
      <span
        className={`absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded leading-none ${meta.bgLightClass} ${meta.borderClass} ${meta.textColorClass} border shadow-2xs font-mono uppercase`}
      >
        {meta.badgeText}
      </span>
    </div>
  );
};
