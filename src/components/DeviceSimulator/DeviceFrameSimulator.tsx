import React, { useState, useMemo, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  X,
  Split,
  Eye,
  Sliders,
  Check,
  ChevronDown,
  Wifi,
  Battery,
  Signal,
  Monitor,
  Sparkles,
} from 'lucide-react';
import { useFileManager } from '../../context/FileManagerContext';
import { useTheme } from '../../context/ThemeContext';
import { Navbar } from '../Navbar';
import { Sidebar } from '../Sidebar';
import { ViewRouter } from '../Router/ViewRouter';
import { MobileBottomNav } from '../MobileBottomNav';
import { ModalManagerState } from '../../hooks/useModalManager';

export interface DevicePreset {
  id: string;
  name: string;
  category: 'mobile' | 'tablet' | 'desktop';
  width: number;
  height: number;
  borderRadius: number;
  bezelStyle: 'island' | 'punchhole' | 'classic' | 'tablet' | 'macbook' | 'monitor';
  dpr: string;
  ratio: string;
  description: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: 'iphone16pro',
    name: 'iPhone 16 Pro',
    category: 'mobile',
    width: 393,
    height: 852,
    borderRadius: 52,
    bezelStyle: 'island',
    dpr: '3.0x',
    ratio: '19.5:9',
    description: 'Flagship compact iOS viewport with Dynamic Island',
  },
  {
    id: 'pixel8',
    name: 'Google Pixel 8',
    category: 'mobile',
    width: 412,
    height: 915,
    borderRadius: 44,
    bezelStyle: 'punchhole',
    dpr: '2.6x',
    ratio: '20:9',
    description: 'Modern Android tall viewport with centered camera',
  },
  {
    id: 'iphonese',
    name: 'iPhone SE (3rd Gen)',
    category: 'mobile',
    width: 375,
    height: 667,
    borderRadius: 36,
    bezelStyle: 'classic',
    dpr: '2.0x',
    ratio: '16:9',
    description: 'Classic small screen touch form factor',
  },
  {
    id: 'ipadpro11',
    name: 'iPad Pro 11"',
    category: 'tablet',
    width: 834,
    height: 1194,
    borderRadius: 34,
    bezelStyle: 'tablet',
    dpr: '2.0x',
    ratio: '4:3',
    description: 'Pro productivity tablet with split sidebar navigation',
  },
  {
    id: 'ipadmini',
    name: 'iPad Mini 6',
    category: 'tablet',
    width: 744,
    height: 1133,
    borderRadius: 28,
    bezelStyle: 'tablet',
    dpr: '2.0x',
    ratio: '3:2',
    description: 'Compact handheld tablet with high density layout',
  },
  {
    id: 'macbookair',
    name: 'MacBook Air 13"',
    category: 'desktop',
    width: 1280,
    height: 832,
    borderRadius: 18,
    bezelStyle: 'macbook',
    dpr: '2.0x',
    ratio: '16:10',
    description: 'Standard laptop viewport with full multi-column dashboard',
  },
  {
    id: 'desktop1440',
    name: 'Studio Display 1440p',
    category: 'desktop',
    width: 1440,
    height: 900,
    borderRadius: 12,
    bezelStyle: 'monitor',
    dpr: '1.0x',
    ratio: '16:10',
    description: 'Ultra-wide workstation monitoring console',
  },
];

interface DeviceFrameSimulatorProps {
  modalManager: ModalManagerState;
  onExit: () => void;
}

export const DeviceFrameSimulator: React.FC<DeviceFrameSimulatorProps> = ({
  modalManager,
  onExit,
}) => {
  const { currentTab } = useFileManager();
  const { resolvedTheme } = useTheme();

  // Primary Selected Device
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('iphone16pro');
  // Secondary Device for Dual Side-by-Side Comparison
  const [secondaryDeviceId, setSecondaryDeviceId] = useState<string>('ipadpro11');
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);

  // Orientation: portrait or landscape
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  // Zoom scaling
  const [zoomPercent, setZoomPercent] = useState<number>(85);
  // Show realistic hardware bezel
  const [showBezel, setShowBezel] = useState<boolean>(true);
  // Show system status bar
  const [showStatusBar, setShowStatusBar] = useState<boolean>(true);

  // Active Category Filter
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'mobile' | 'tablet' | 'desktop'>('ALL');

  const primaryDevice = useMemo(
    () => DEVICE_PRESETS.find((d) => d.id === selectedDeviceId) || DEVICE_PRESETS[0],
    [selectedDeviceId]
  );

  const secondaryDevice = useMemo(
    () => DEVICE_PRESETS.find((d) => d.id === secondaryDeviceId) || DEVICE_PRESETS[3],
    [secondaryDeviceId]
  );

  // Compute dimensions factoring in orientation
  const getDimensions = (device: DevicePreset, landscape: boolean) => {
    return {
      width: landscape ? Math.max(device.width, device.height) : Math.min(device.width, device.height),
      height: landscape ? Math.min(device.width, device.height) : Math.max(device.width, device.height),
    };
  };

  const primaryDim = getDimensions(primaryDevice, isLandscape);
  const secondaryDim = getDimensions(secondaryDevice, isLandscape);

  // Filtered devices list for quick selector
  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'ALL') return DEVICE_PRESETS;
    return DEVICE_PRESETS.filter((d) => d.category === categoryFilter);
  }, [categoryFilter]);

  // Handle ESC key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Render internal app viewport
  const renderAppInsideFrame = (device: DevicePreset, width: number) => {
    const isMobileViewport = width < 768;

    return (
      <div className="flex flex-col h-full w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none">
        {/* Navigation Bar inside frame */}
        <Navbar
          onOpenUpload={modalManager.openUpload}
          onOpenAddAccount={modalManager.openAddAccount}
          onOpenCommandPalette={modalManager.openCommandPalette}
          onOpenShortcuts={modalManager.openShortcuts}
        />

        {/* Content area: Sidebar + Main router for tablet/desktop, or straight router for mobile */}
        <div className="flex flex-1 overflow-hidden relative">
          {!isMobileViewport && (
            <Sidebar
              onOpenAddAccount={modalManager.openAddAccount}
              onOpenTour={modalManager.openTour}
            />
          )}

          <main className="flex-1 overflow-y-auto relative flex flex-col">
            <ViewRouter
              currentTab={currentTab}
              onOpenUpload={modalManager.openUpload}
              onOpenNewFolder={modalManager.openNewFolder}
              onOpenDetails={modalManager.setInspectedFile}
              onOpenQuickLook={modalManager.setQuickLookFile}
              onOpenMove={modalManager.setMoveTarget}
              onOpenAddAccount={modalManager.openAddAccount}
            />
          </main>
        </div>

        {/* Bottom Navigation for mobile screens */}
        {isMobileViewport && (
          <MobileBottomNav onOpenMoreMenu={modalManager.openMoreDrawer} />
        )}
      </div>
    );
  };

  // Render a Single Device Frame Container
  const renderDeviceCard = (
    device: DevicePreset,
    dim: { width: number; height: number },
    label?: string
  ) => {
    const scale = zoomPercent / 100;

    return (
      <div className="flex flex-col items-center">
        {/* Device Header Tag */}
        <div className="mb-3 flex items-center gap-2 text-xs font-mono text-slate-400 select-none">
          {label && <span className="font-bold text-blue-400">{label}:</span>}
          <span className="font-semibold text-slate-200">{device.name}</span>
          <span>·</span>
          <span>
            {dim.width} × {dim.height} px
          </span>
          <span>·</span>
          <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
            {device.dpr}
          </span>
        </div>

        {/* Device Canvas Frame */}
        <div
          style={{
            width: `${dim.width * scale}px`,
            height: `${dim.height * scale}px`,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="relative flex items-center justify-center shrink-0"
        >
          <div
            style={{
              width: `${dim.width}px`,
              height: `${dim.height}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              borderRadius: showBezel ? `${device.borderRadius}px` : '16px',
            }}
            className={`flex flex-col overflow-hidden bg-white dark:bg-slate-950 shadow-2xl relative transition-all duration-200 ${
              showBezel
                ? 'border-[10px] border-slate-850 dark:border-slate-800 ring-1 ring-white/10'
                : 'border border-slate-700/80'
            }`}
          >
            {/* Realistic Hardware Bezel Top Elements */}
            {showBezel && showStatusBar && (
              <div className="h-10 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between px-6 text-xs text-slate-700 dark:text-slate-300 font-semibold shrink-0 select-none relative z-20">
                {/* Simulated Time */}
                <span className="font-mono text-[11px] font-bold">9:41</span>

                {/* iPhone Dynamic Island */}
                {device.bezelStyle === 'island' && !isLandscape && (
                  <div className="w-28 h-6 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-1.5 flex items-center justify-end px-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
                  </div>
                )}

                {/* Android Punch Hole Camera */}
                {device.bezelStyle === 'punchhole' && !isLandscape && (
                  <div className="w-3.5 h-3.5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-2.5 ring-1 ring-slate-800" />
                )}

                {/* Classic Home indicator / notch */}
                {device.bezelStyle === 'classic' && (
                  <div className="w-16 h-1 bg-slate-400/50 rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
                )}

                {/* System Icons */}
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Signal className="w-3.5 h-3.5" />
                  <Wifi className="w-3.5 h-3.5" />
                  <Battery className="w-4 h-4" />
                </div>
              </div>
            )}

            {/* Inner Real App Viewport */}
            <div className="flex-1 overflow-hidden relative">
              {renderAppInsideFrame(device, dim.width)}
            </div>

            {/* iOS Bottom Gesture Bar */}
            {showBezel && device.category === 'mobile' && !isLandscape && (
              <div className="h-4 bg-transparent flex items-center justify-center pointer-events-none absolute bottom-1 left-0 right-0 z-30">
                <div className="w-32 h-1 bg-slate-400 dark:bg-slate-600 rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col text-white select-none overflow-hidden animate-in fade-in duration-150">
      {/* 1. Top Enterprise Device Switcher & Simulator Control Toolbar */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-lg">
        {/* Left: Device Selection Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-tight text-white block">
                Device & Frame Studio
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Multi-Viewport Simulation
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {/* Quick Category Tabs */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 text-xs font-medium">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Devices
            </button>
            <button
              onClick={() => setCategoryFilter('mobile')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                categoryFilter === 'mobile'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Phones</span>
            </button>
            <button
              onClick={() => setCategoryFilter('tablet')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                categoryFilter === 'tablet'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablets</span>
            </button>
            <button
              onClick={() => setCategoryFilter('desktop')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                categoryFilter === 'desktop'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          </div>

          {/* Primary Device Dropdown */}
          <div className="relative">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 outline-none font-semibold focus:border-blue-500 cursor-pointer"
            >
              {filteredPresets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.width}×{d.height})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Controls (Orientation, Bezel, Zoom, Split Mode) */}
        <div className="flex items-center gap-2">
          {/* Dual Compare Mode Toggle */}
          <button
            onClick={() => setIsCompareMode(!isCompareMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isCompareMode
                ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                : 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Toggle Split-Screen Device Comparison"
          >
            <Split className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare 2 Frames</span>
          </button>

          {/* Secondary Device Selector when in comparison mode */}
          {isCompareMode && (
            <select
              value={secondaryDeviceId}
              onChange={(e) => setSecondaryDeviceId(e.target.value)}
              className="bg-slate-800 border border-blue-500 text-blue-200 text-xs rounded-xl px-2.5 py-1.5 outline-none font-semibold cursor-pointer animate-in fade-in duration-150"
            >
              {DEVICE_PRESETS.map((d) => (
                <option key={d.id} value={d.id}>
                  Compare: {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Orientation Toggle */}
          <button
            onClick={() => setIsLandscape(!isLandscape)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            title="Rotate Device Orientation"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isLandscape ? 'Landscape' : 'Portrait'}</span>
          </button>

          {/* Bezel Toggle */}
          <button
            onClick={() => setShowBezel(!showBezel)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer ${
              showBezel
                ? 'bg-slate-800 border-slate-600 text-slate-200'
                : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Realistic Device Bezel vs Borderless Window"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Bezel</span>
          </button>

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-850 border border-slate-700 rounded-xl px-2 py-1 text-xs">
            <button
              onClick={() => setZoomPercent((z) => Math.max(50, z - 10))}
              className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] w-10 text-center font-semibold text-slate-300">
              {zoomPercent}%
            </span>

            <button
              onClick={() => setZoomPercent((z) => Math.min(125, z + 10))}
              className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setZoomPercent(75)}
              className="text-[10px] text-blue-400 hover:text-blue-300 ml-1 px-1 font-mono cursor-pointer"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Right: Exit / Return to Full Screen */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:border-rose-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer"
            title="Exit Frame Studio (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Studio</span>
          </button>
        </div>
      </header>

      {/* 2. Device Canvas Work Area */}
      <div className="flex-1 overflow-auto p-6 sm:p-10 flex items-center justify-center">
        {isCompareMode ? (
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {renderDeviceCard(primaryDevice, primaryDim, 'Frame A')}
            <div className="h-96 w-px bg-slate-800 hidden xl:block" />
            {renderDeviceCard(secondaryDevice, secondaryDim, 'Frame B')}
          </div>
        ) : (
          renderDeviceCard(primaryDevice, primaryDim)
        )}
      </div>

      {/* 3. Bottom Quick Specs Footer */}
      <footer className="h-9 bg-slate-900/90 border-t border-slate-800 px-6 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-slate-300 font-semibold">{primaryDevice.name}</span>
          <span>·</span>
          <span>{primaryDevice.description}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Viewport: {primaryDim.width} × {primaryDim.height}px</span>
          <span>·</span>
          <span>Ratio: {primaryDevice.ratio}</span>
          <span>·</span>
          <span>Press ESC or 'M' to exit</span>
        </div>
      </footer>
    </div>
  );
};
