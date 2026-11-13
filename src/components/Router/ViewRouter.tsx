import React from 'react';
import { NavigationTab } from '../../context/FileManagerContext';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { CloudFile } from '../../types';
import { MultiCloudDashboardView } from '../Dashboard/MultiCloudDashboardView';
import { InfrastructureOverviewView } from '../Infrastructure/InfrastructureOverviewView';
import { TopologyView } from '../Infrastructure/TopologyView';
import { CloudProvidersView } from '../Providers/CloudProvidersView';
import { ObservabilityView } from '../Observability/ObservabilityView';
import { CostManagementView } from '../Cost/CostManagementView';
import { AutomationView } from '../Automation/AutomationView';
import { FileBrowser } from '../FileBrowser/FileBrowser';
import { GalleryView } from '../Gallery/GalleryView';
import { CrossAccountSearchView } from '../Search/CrossAccountSearchView';
import { AccountsCenterView } from '../Accounts/AccountsCenterView';
import { OfflineFilesView } from '../Offline/OfflineFilesView';
import { QuotaGovernorView } from '../Quota/QuotaGovernorView';
import { PendingOperationsView } from '../Operations/PendingOperationsView';
import { SecurityAuditView } from '../Security/SecurityAuditView';
import { SettingsView } from '../Settings/SettingsView';
import { LegalComplianceView } from '../Legal/LegalComplianceView';
import { HelpSupportView } from '../Help/HelpSupportView';
import { NotFoundView } from '../common/NotFoundView';

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
      case 'accounts':
        return <AccountsCenterView onOpenAddAccount={onOpenAddAccount} />;
      case 'quotas':
        return <QuotaGovernorView />;
      case 'operations':
        return <PendingOperationsView />;
      case 'offline':
        return <OfflineFilesView onOpenDetails={onOpenDetails} />;
      case 'security':
      case 'security_policies':
        return <SecurityAuditView />;
      case 'dashboard':
        return (
          <MultiCloudDashboardView
            onOpenAddAccount={onOpenAddAccount}
            onOpenUpload={onOpenUpload}
            onOpenNewFolder={onOpenNewFolder}
            onOpenDetails={onOpenDetails}
          />
        );
      case 'infra_overview':
      case 'infra_compute':
      case 'infra_storage':
      case 'infra_databases':
      case 'infra_networks':
      case 'infra_k8s':
        return <InfrastructureOverviewView />;
      case 'infra_topology':
        return <TopologyView />;
      case 'providers':
        return <CloudProvidersView />;
      case 'monitoring_metrics':
      case 'monitoring_logs':
      case 'monitoring_alerts':
      case 'monitoring_events':
        return <ObservabilityView />;
      case 'cost_overview':
      case 'cost_optimization':
        return <CostManagementView />;
      case 'automation_workflows':
        return <AutomationView />;
      case 'settings':
        return <SettingsView />;
      case 'legal':
        return <LegalComplianceView />;
      case 'help':
        return <HelpSupportView />;
      default:
        return <NotFoundView />;
    }
  };

  return (
    <ErrorBoundary fallbackTitle={`Error rendering ${currentTab} view`}>
      {renderScreen()}
    </ErrorBoundary>
  );
};
