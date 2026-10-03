import React, { useState } from 'react';
import {
  LayoutDashboard,
  Server,
  Cloud,
  Activity,
  FileText,
  AlertTriangle,
  Shield,
  DollarSign,
  Workflow,
  Folder,
  Settings,
  HelpCircle,
  Layers,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useFileManager, NavigationTab } from '../context/FileManagerContext';
import { useInfrastructure } from '../context/InfrastructureContext';

interface SidebarProps {
  onOpenAddAccount?: () => void;
  onOpenTour?: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ReactNode;
  count?: number;
  badge?: number;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const { currentTab, setCurrentTab, setCurrentFolderId, files } = useFileManager();
  const { alerts, resources } = useInfrastructure();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNav = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (tab === 'files') {
      setCurrentFolderId(null);
    }
  };

  const activeAlertsCount = alerts.filter((a) => a.status !== 'RESOLVED').length;

  const navSections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        {
          id: 'dashboard' as NavigationTab,
          label: 'Dashboard',
          icon: <LayoutDashboard className="w-4 h-4 shrink-0 text-blue-500" />,
        },
        {
          id: 'infra_topology' as NavigationTab,
          label: 'Topology Map',
          icon: <Layers className="w-4 h-4 shrink-0 text-indigo-500" />,
        },
      ],
    },
    {
      title: 'Infrastructure',
      items: [
        {
          id: 'infra_overview' as NavigationTab,
          label: 'Fleet Overview',
          icon: <Server className="w-4 h-4 shrink-0 text-emerald-500" />,
          count: resources.length,
        },
        {
          id: 'providers' as NavigationTab,
          label: 'Cloud Providers',
          icon: <Cloud className="w-4 h-4 shrink-0 text-sky-500" />,
        },
      ],
    },
    {
      title: 'Observability',
      items: [
        {
          id: 'monitoring_metrics' as NavigationTab,
          label: 'Live Metrics',
          icon: <Activity className="w-4 h-4 shrink-0 text-emerald-500" />,
        },
        {
          id: 'monitoring_logs' as NavigationTab,
          label: 'System Logs',
          icon: <FileText className="w-4 h-4 shrink-0 text-slate-400" />,
        },
        {
          id: 'monitoring_alerts' as NavigationTab,
          label: 'Alerts & Health',
          icon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />,
          badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
          badgeColor: 'text-amber-600 bg-amber-100 dark:bg-amber-950/80',
        },
      ],
    },
    {
      title: 'FinOps & Governance',
      items: [
        {
          id: 'cost_overview' as NavigationTab,
          label: 'Cost Management',
          icon: <DollarSign className="w-4 h-4 shrink-0 text-teal-500" />,
        },
        {
          id: 'automation_workflows' as NavigationTab,
          label: 'Runbooks & Automation',
          icon: <Workflow className="w-4 h-4 shrink-0 text-purple-500" />,
        },
        {
          id: 'security' as NavigationTab,
          label: 'Security & Audit',
          icon: <Shield className="w-4 h-4 shrink-0 text-blue-500" />,
        },
      ],
    },
    {
      title: 'Storage & Assets',
      items: [
        {
          id: 'files' as NavigationTab,
          label: 'Cloud Storage Files',
          icon: <Folder className="w-4 h-4 shrink-0 text-amber-500" />,
          count: files.filter((f) => !f.isTrashed).length,
        },
      ],
    },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-60'
      } bg-slate-50/70 dark:bg-slate-900/70 border-r border-slate-200/80 dark:border-slate-800 hidden md:flex flex-col shrink-0 min-h-[calc(100vh-53px)] select-none transition-all duration-200`}
    >
      {/* Sidebar Header & Collapse Toggle */}
      <div className="p-3 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Menu
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Nav Items */}
      <div className="p-2 flex-1 overflow-y-auto space-y-4">
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {sec.title}
              </div>
            )}
            {sec.items.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            isActive ? 'bg-white/20 text-white' : item.badgeColor
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.count !== undefined && (
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Footer Section */}
      <div className="p-2 border-t border-slate-200/80 dark:border-slate-800 space-y-0.5">
        <button
          onClick={() => handleNav('settings')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentTab === 'settings'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          }`}
          title="Platform Settings"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        <button
          onClick={() => handleNav('help')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentTab === 'help'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          }`}
          title="Help & Documentation"
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Help & Docs</span>}
        </button>
      </div>
    </aside>
  );
};
