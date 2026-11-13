import React from 'react';
import { NavigationTab } from '../../context/FileManagerContext';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { CloudFile } from '../../types';
import { MultiCloudDashboardView } from '../Dashboard/MultiCloudDashboardView';
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
