import React, { useMemo, Suspense, lazy } from 'react';
import { useFileManager } from './context/FileManagerContext';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useModalManager } from './hooks/useModalManager';
import { useHotkeys } from './hooks/useHotkeys';
import { Toaster } from 'sonner';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ViewRouter } from './components/Router/ViewRouter';
import { ModalContainer } from './components/Modals/ModalContainer';
import { OperationalFooter } from './components/common/OperationalFooter';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DeviceFrameSimulator } from './components/DeviceSimulator/DeviceFrameSimulator';
import { CookieConsentBanner } from './components/common/CookieConsentBanner';
import { Wifi, Battery, Signal, Loader2 } from 'lucide-react';

const LoginPage = lazy(() => import('./components/Auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const TransferDrawer = lazy(() => import('./components/TransferDrawer').then((m) => ({ default: m.TransferDrawer })));

const AuthenticatedDashboard: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    isMobilePreview,
    setViewMode,
    setIsMobilePreview,
  } = useFileManager();

  const { resolvedTheme, toggleTheme } = useTheme();
  const modalManager = useModalManager();

  // Register clean enterprise keyboard shortcuts
  const hotkeyDefinitions = useMemo(
    () => [
      {
        combo: 'meta+k',
        handler: () => modalManager.toggleCommandPalette(),
      },
      {
        combo: 'ctrl+k',
        handler: () => modalManager.toggleCommandPalette(),
      },
      {
        combo: 'meta+u',
        handler: () => modalManager.openUpload(),
      },
      {
        combo: '?',
        handler: () => modalManager.openShortcuts(),
      },
      {
        combo: 't',
        handler: () => toggleTheme(),
      },
      {
        combo: 'm',
        handler: () => setIsMobilePreview(!isMobilePreview),
      },
      {
        combo: '1',
        handler: () => setViewMode('grid'),
      },
      {
        combo: '2',
        handler: () => setViewMode('list'),
      },
    ],
    [modalManager, toggleTheme, isMobilePreview, setIsMobilePreview, setViewMode]
  );

  useHotkeys(hotkeyDefinitions);

  return (
    <div
      className={`min-h-screen w-screen overflow-hidden ${
        resolvedTheme === 'dark' ? 'dark' : ''
      } bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors`}
    >
      {/* 1. Multi-Device Frame & Viewport Studio (triggered via 'M', Navbar, or Command Palette) */}
      {isMobilePreview && (
        <DeviceFrameSimulator
          modalManager={modalManager}
          onExit={() => setIsMobilePreview(false)}
        />
      )}

      {/* 2. Full Standard Responsive Layout */}
      {!isMobilePreview && (
        <div className="flex flex-col h-screen w-screen overflow-hidden">
          {/* Top Navbar */}
          <Navbar
            onOpenUpload={modalManager.openUpload}
            onOpenAddAccount={modalManager.openAddAccount}
            onOpenCommandPalette={modalManager.openCommandPalette}
            onOpenShortcuts={modalManager.openShortcuts}
          />

          {/* Main Layout Container */}
          <div className="flex flex-1 overflow-hidden">
            {/* Desktop Sidebar (collapsible) */}
            <Sidebar
              onOpenAddAccount={modalManager.openAddAccount}
              onOpenTour={modalManager.openTour}
            />

            {/* Main Content Area with Suspense and ErrorBoundary */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
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

          {/* Desktop Operational Status / Footer Bar */}
          <OperationalFooter
            onOpenCommandPalette={modalManager.openCommandPalette}
            onOpenShortcuts={modalManager.openShortcuts}
          />

          {/* Mobile Bottom Navigation Bar (visible on mobile screens only) */}
          <div className="md:hidden">
            <MobileBottomNav onOpenMoreMenu={modalManager.openMoreDrawer} />
          </div>
        </div>
      )}

      {/* Floating Transfer Monitor - Lazy Loaded */}
      <Suspense fallback={null}>
        <TransferDrawer />
      </Suspense>

      {/* Unified Modal Container */}
      <ModalContainer modalManager={modalManager} />

      {/* Storage and Cookie Consent Banner */}
      <CookieConsentBanner />

      {/* Toast Notification Container */}
      <Toaster richColors position="top-right" theme={resolvedTheme} />
    </div>
  );
};

export const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <>
        <Suspense
          fallback={
            <div className="min-h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          }
        >
          <LoginPage />
        </Suspense>
        <CookieConsentBanner />
      </>
    );
  }

  return <AuthenticatedDashboard />;
};

export default AppContent;
