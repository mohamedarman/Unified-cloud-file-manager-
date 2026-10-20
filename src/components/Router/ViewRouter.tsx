import React, { Suspense, lazy } from 'react';
import { NavigationTab } from '../../context/FileManagerContext';
import { ViewSuspenseFallback } from '../common/ViewSuspenseFallback';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { CloudFile } from '../../types';

// Lazy-loaded views for optimal code-splitting and rapid initial load
const MultiCloudDashboardView = lazy(() =>
  import('../Dashboard/MultiCloudDashboardView').then((m) => ({ default: m.MultiCloudDashboardView }))
);
const InfrastructureOverviewView = lazy(() =>
  import('../Infrastructure/InfrastructureOverviewView').then((m) => ({ default: m.InfrastructureOverviewView }))
);
const TopologyView = lazy(() =>
  import('../Infrastructure/TopologyView').then((m) => ({ default: m.TopologyView }))
);
const CloudProvidersView = lazy(() =>
  import('../Providers/CloudProvidersView').then((m) => ({ default: m.CloudProvidersView }))
);
const ObservabilityView = lazy(() =>
  import('../Observability/ObservabilityView').then((m) => ({ default: m.ObservabilityView }))
);
const CostManagementView = lazy(() =>
  import('../Cost/CostManagementView').then((m) => ({ default: m.CostManagementView }))
);
const AutomationView = lazy(() =>
  import('../Automation/AutomationView').then((m) => ({ default: m.AutomationView }))
);
const FileBrowser = lazy(() =>
  import('../FileBrowser/FileBrowser').then((m) => ({ default: m.FileBrowser }))
);
const GalleryView = lazy(() =>
  import('../Gallery/GalleryView').then((m) => ({ default: m.GalleryView }))
);
const CrossAccountSearchView = lazy(() =>
  import('../Search/CrossAccountSearchView').then((m) => ({ default: m.CrossAccountSearchView }))
);
const AccountsCenterView = lazy(() =>
  import('../Accounts/AccountsCenterView').then((m) => ({ default: m.AccountsCenterView }))
);
const OfflineFilesView = lazy(() =>
  import('../Offline/OfflineFilesView').then((m) => ({ default: m.OfflineFilesView }))
);
const QuotaGovernorView = lazy(() =>
  import('../Quota/QuotaGovernorView').then((m) => ({ default: m.QuotaGovernorView }))
);
const PendingOperationsView = lazy(() =>
  import('../Operations/PendingOperationsView').then((m) => ({ default: m.PendingOperationsView }))
);
const SecurityAuditView = lazy(() =>
  import('../Security/SecurityAuditView').then((m) => ({ default: m.SecurityAuditView }))
);
const SettingsView = lazy(() =>
  import('../Settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const LegalComplianceView = lazy(() =>
  import('../Legal/LegalComplianceView').then((m) => ({ default: m.LegalComplianceView }))
);
const HelpSupportView = lazy(() =>
  import('../Help/HelpSupportView').then((m) => ({ default: m.HelpSupportView }))
);
const NotFoundView = lazy(() =>
  import('../common/NotFoundView').then((m) => ({ default: m.NotFoundView }))
);

interface ViewRouterProps {
  currentTab: NavigationTab;
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
  onOpenDetails: (file: CloudFile) => void;
  onOpenQuickLook: (file: CloudFile) => void;
  onOpenMove: (file: CloudFile) => void;
  onOpenAddAccount: () => void;
}

export const ViewRouter: React.FC<ViewRouterProps> = ({
  currentTab,
  onOpenUpload,
  onOpenNewFolder,
  onOpenDetails,
  onOpenQuickLook,
  onOpenMove,
  onOpenAddAccount,
}) => {
  const renderScreen = () => {
    switch (currentTab) {
      case 'files':
      case 'starred':
      case 'recent':
      case 'trash':
        return (
          <FileBrowser
            onOpenUpload={onOpenUpload}
            onOpenNewFolder={onOpenNewFolder}
            onOpenDetails={onOpenDetails}
            onOpenQuickLook={onOpenQuickLook}
            onOpenMove={onOpenMove}
            onOpenAddAccount={onOpenAddAccount}
          />
        );
      case 'gallery':
        return <GalleryView />;
      case 'search':
        return <CrossAccountSearchView onOpenDetails={onOpenDetails} />;
      case 'quotas':
        return <QuotaGovernorView />;
      case 'settings':
      case 'accounts':
        return <SettingsView />;
      case 'legal':
        return <LegalComplianceView />;
      case 'help':
        return <HelpSupportView />;
      default:
        return (
          <FileBrowser
            onOpenUpload={onOpenUpload}
            onOpenNewFolder={onOpenNewFolder}
            onOpenDetails={onOpenDetails}
            onOpenQuickLook={onOpenQuickLook}
            onOpenMove={onOpenMove}
          />
        );
    }
  };

  return (
    <ErrorBoundary fallbackTitle={`Error rendering ${currentTab} view`}>
      <Suspense fallback={<ViewSuspenseFallback />}>
        {renderScreen()}
      </Suspense>
    </ErrorBoundary>
  );
};
