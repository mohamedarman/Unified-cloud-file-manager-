import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  HardDrive,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Cloud,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { PROVIDERS, ProviderId } from '../../types';
import { humanReadableBytes } from '../../utils/formatters';

export const StorageVisualizer: React.FC = () => {
  const { accounts, quotas, files } = useFileManager();
  const [activeChartTab, setActiveChartTab] = useState<'both' | 'providers' | 'types'>('both');

  // 1. Compute Provider Breakdown (Used vs Free GB)
  const providerData = useMemo(() => {
    return (Object.keys(PROVIDERS) as ProviderId[]).map((pId) => {
      const prov = PROVIDERS[pId];
      const accs = accounts.filter((a) => a.provider === pId);

      const usedBytes = accs.reduce(
        (sum, a) => sum + (quotas[a.localId]?.usedBytes || 0),
        0
      );
      const limitBytes = accs.reduce(
        (sum, a) => sum + (quotas[a.localId]?.limitBytes || 0),
        0
      );
      const freeBytes = Math.max(0, limitBytes - usedBytes);

      return {
        providerId: pId,
        name: prov.shortName,
        fullName: prov.name,
        accountsCount: accs.length,
        usedGB: +(usedBytes / (1024 ** 3)).toFixed(1),
        freeGB: +(freeBytes / (1024 ** 3)).toFixed(1),
        totalGB: +(limitBytes / (1024 ** 3)).toFixed(1),
        usedBytes,
        limitBytes,
        color: prov.brandColor,
      };
    });
  }, [accounts, quotas]);

  // Overall sums
  const totalUsedBytes = useMemo(
    () => Object.values(quotas).reduce((sum, q) => sum + (q.usedBytes || 0), 0),
    [quotas]
  );
  const totalLimitBytes = useMemo(
    () => Object.values(quotas).reduce((sum, q) => sum + (q.limitBytes || 0), 0),
    [quotas]
  );
  const totalFreeBytes = Math.max(0, totalLimitBytes - totalUsedBytes);
  const overallUsedPct =
    totalLimitBytes > 0
      ? Math.round((totalUsedBytes / totalLimitBytes) * 100)
      : 0;

  // 2. Compute File Type Storage Distribution
  const fileTypeData = useMemo(() => {
    let docsBytes = 0;
    let imagesBytes = 0;
    let videosBytes = 0;
    let audioBytes = 0;
    let codeArchiveBytes = 0;
    let otherBytes = 0;

    let docsCount = 0;
    let imagesCount = 0;
    let videosCount = 0;
    let audioCount = 0;
    let codeArchiveCount = 0;
    let otherCount = 0;

    files.forEach((file) => {
      if (file.isFolder || file.isTrashed) return;
      const size = file.sizeBytes || 1024 * 1024;
      const mime = (file.mimeType || '').toLowerCase();
      const name = (file.name || '').toLowerCase();

      if (
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('sheet') ||
        mime.includes('presentation') ||
        mime.includes('text/') ||
        name.endsWith('.pdf') ||
        name.endsWith('.docx') ||
        name.endsWith('.xlsx')
      ) {
        docsBytes += size;
        docsCount++;
      } else if (
        mime.startsWith('image/') ||
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.webp')
      ) {
        imagesBytes += size;
        imagesCount++;
      } else if (
        mime.startsWith('video/') ||
        name.endsWith('.mp4') ||
        name.endsWith('.mov') ||
        name.endsWith('.mkv')
      ) {
        videosBytes += size;
        videosCount++;
      } else if (
        mime.startsWith('audio/') ||
        mime.includes('audio') ||
        name.endsWith('.mp3') ||
        name.endsWith('.wav') ||
        name.endsWith('.m4a')
      ) {
        audioBytes += size;
        audioCount++;
      } else if (
        mime.includes('zip') ||
        mime.includes('tar') ||
        mime.includes('json') ||
        mime.includes('javascript') ||
        mime.includes('typescript') ||
        name.endsWith('.zip') ||
        name.endsWith('.ts')
      ) {
        codeArchiveBytes += size;
        codeArchiveCount++;
      } else {
        otherBytes += size;
        otherCount++;
      }
    });

    // Provide weighted values for visual richness
    return [
      {
        name: 'Videos & Media',
        valueGB: +(videosBytes / 1024 / 1024).toFixed(1),
        bytes: videosBytes,
        count: videosCount,
        color: '#9333EA', // purple-600
        icon: Video,
      },
      {
        name: 'Photos & Images',
        valueGB: +(imagesBytes / 1024 / 1024).toFixed(1),
        bytes: imagesBytes,
        count: imagesCount,
        color: '#E11D48', // rose-600
        icon: ImageIcon,
      },
      {
        name: 'Documents & PDFs',
        valueGB: +(docsBytes / 1024 / 1024).toFixed(1),
        bytes: docsBytes,
        count: docsCount,
        color: '#2563EB', // blue-600
        icon: FileText,
      },
      {
        name: 'Audio & Music',
        valueGB: +(audioBytes / 1024 / 1024).toFixed(1),
        bytes: audioBytes,
        count: audioCount,
        color: '#D97706', // amber-600
        icon: Music,
      },
      {
        name: 'Code & Archives',
        valueGB: +(codeArchiveBytes / 1024 / 1024).toFixed(1),
        bytes: codeArchiveBytes,
        count: codeArchiveCount,
        color: '#0891B2', // cyan-600
        icon: Archive,
      },
    ].filter((item) => item.bytes > 0);
  }, [files]);

  // Custom Provider Tooltip
  const CustomProviderTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800">
          <p className="font-bold flex items-center gap-1.5 text-white">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span>{data.fullName}</span>
          </p>
          <div className="space-y-0.5 text-slate-300 font-mono text-[11px]">
            <p>
              Used:{' '}
              <strong className="text-white">
                {humanReadableBytes(data.usedBytes)}
              </strong>{' '}
              ({data.usedGB} GB)
            </p>
            <p>
              Free:{' '}
              <strong className="text-emerald-400">
                {humanReadableBytes(data.limitBytes - data.usedBytes)}
              </strong>
            </p>
            <p>
              Total Quota:{' '}
              <strong className="text-white">
                {humanReadableBytes(data.limitBytes)}
              </strong>
            </p>
          </div>
          <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            {data.accountsCount} authorized accounts connected
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom File Type Tooltip
  const CustomTypeTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalFileBytes = fileTypeData.reduce((acc, d) => acc + d.bytes, 0);
      const pct =
        totalFileBytes > 0
          ? Math.round((data.bytes / totalFileBytes) * 100)
          : 0;

      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800">
          <p className="font-bold flex items-center gap-1.5 text-white">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span>{data.name}</span>
          </p>
          <div className="space-y-0.5 text-slate-300 font-mono text-[11px]">
            <p>
              Volume:{' '}
              <strong className="text-white">
                {humanReadableBytes(data.bytes)}
              </strong>{' '}
              ({pct}%)
            </p>
            <p>
              Items:{' '}
              <strong className="text-blue-400">{data.count} files</strong>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-6">
      {/* Header and Toggle Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Multi-Cloud Storage Visualizer (Recharts)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time telemetry breakdown by cloud provider and file classification
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveChartTab('both')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeChartTab === 'both'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveChartTab('providers')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeChartTab === 'providers'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cloud Providers
          </button>
          <button
            onClick={() => setActiveChartTab('types')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeChartTab === 'types'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            File Formats
          </button>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
            Total Used Storage
          </span>
          <p className="text-xl font-bold text-blue-950 font-mono">
            {humanReadableBytes(totalUsedBytes)}
          </p>
          <span className="text-[11px] text-blue-700 font-medium">
            {overallUsedPct}% of aggregate quota
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
            Available Free Space
          </span>
          <p className="text-xl font-bold text-emerald-950 font-mono">
            {humanReadableBytes(totalFreeBytes)}
          </p>
          <span className="text-[11px] text-emerald-700 font-medium">
            Across {accounts.length} authorized accounts
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider block">
            Total Aggregated Capacity
          </span>
          <p className="text-xl font-bold text-purple-950 font-mono">
            {humanReadableBytes(totalLimitBytes)}
          </p>
          <span className="text-[11px] text-purple-700 font-medium">
            Owned across 4 cloud ecosystems
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
            Indexed Cloud Files
          </span>
          <p className="text-xl font-bold text-amber-950 font-mono">
            {files.filter((f) => !f.isTrashed && !f.isFolder).length}
          </p>
          <span className="text-[11px] text-amber-700 font-medium">
            Synchronized metadata items
          </span>
        </div>
      </div>

      {/* Charts Section */}
      <div
        className={`grid gap-6 ${
          activeChartTab === 'both'
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1'
        }`}
      >
        {/* CHART 1: Recharts Bar Chart (Cloud Provider Breakdown) */}
        {(activeChartTab === 'both' || activeChartTab === 'providers') && (
          <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Usage by Cloud Provider (GB)</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Stacked: Used vs Available
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={providerData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    unit=" GB"
                  />
                  <Tooltip content={<CustomProviderTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                  />
                  <Bar
                    dataKey="usedGB"
                    name="Used (GB)"
                    stackId="quota"
                    fill="#3B82F6"
                    radius={[0, 0, 4, 4]}
                  >
                    {providerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="freeGB"
                    name="Free Available (GB)"
                    stackId="quota"
                    fill="#E2E8F0"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 2: Recharts Donut Pie Chart (File Type Breakdown) */}
        {(activeChartTab === 'both' || activeChartTab === 'types') && (
          <div className="space-y-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <PieChartIcon className="w-4 h-4 text-purple-600" />
                <span>File Format Distribution</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                By consumed storage volume
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="h-full w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fileTypeData}
                      dataKey="bytes"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {fileTypeData.map((entry, index) => (
                        <Cell key={`type-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTypeTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Custom Legend & File Details */}
              <div className="w-full sm:w-1/2 space-y-2 text-xs">
                {fileTypeData.map((type, idx) => {
                  const Icon = type.icon;
                  const totalFileBytes = fileTypeData.reduce(
                    (acc, d) => acc + d.bytes,
                    0
                  );
                  const pct =
                    totalFileBytes > 0
                      ? Math.round((type.bytes / totalFileBytes) * 100)
                      : 0;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 hover:border-slate-200 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: type.color }}
                        />
                        <span className="font-medium text-slate-800 truncate">
                          {type.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono text-[11px] text-slate-600">
                        <span>{humanReadableBytes(type.bytes)}</span>
                        <span className="text-slate-400 ml-1.5">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
