import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CloudPlatform,
  CloudResource,
  CloudProviderAccount,
  InfrastructureAlert,
  InfrastructureLog,
  CostBreakdownItem,
  FinOpsRecommendation,
  AutomationWorkflow,
  CloudEnvironment,
} from '../types/infrastructure';
import {
  INITIAL_CLOUD_ACCOUNTS,
  INITIAL_RESOURCES,
  INITIAL_ALERTS,
  INITIAL_LOGS,
  INITIAL_COST_BREAKDOWN,
  INITIAL_RECOMMENDATIONS,
  INITIAL_WORKFLOWS,
} from '../data/mockInfrastructure';
import { toast } from 'sonner';

interface InfrastructureContextType {
  cloudAccounts: CloudProviderAccount[];
  resources: CloudResource[];
  alerts: InfrastructureAlert[];
  logs: InfrastructureLog[];
  costs: CostBreakdownItem[];
  recommendations: FinOpsRecommendation[];
  workflows: AutomationWorkflow[];

  // Filters & State
  selectedEnvironment: CloudEnvironment;
  setSelectedEnvironment: (env: CloudEnvironment) => void;
  selectedProviderFilter: 'ALL' | CloudPlatform;
  setSelectedProviderFilter: (p: 'ALL' | CloudPlatform) => void;
  selectedRegionFilter: string;
  setSelectedRegionFilter: (r: string) => void;
  selectedResource: CloudResource | null;
  setSelectedResource: (r: CloudResource | null) => void;

  // Actions
  toggleResourcePower: (resourceId: string) => void;
  rebootResource: (resourceId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  applyRecommendation: (recommendationId: string) => void;
  triggerWorkflow: (workflowId: string) => void;
  connectProvider: (provider: CloudPlatform, name: string, accountIdOrSub: string) => void;
  exportLogsAsJson: () => void;
}

const InfrastructureContext = createContext<InfrastructureContextType | undefined>(undefined);

export const InfrastructureProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cloudAccounts, setCloudAccounts] = useState<CloudProviderAccount[]>(() => {
    const saved = localStorage.getItem('ucfm_cloud_accounts_v1');
    return saved ? JSON.parse(saved) : INITIAL_CLOUD_ACCOUNTS;
  });

  const [resources, setResources] = useState<CloudResource[]>(() => {
    const saved = localStorage.getItem('ucfm_resources_v1');
    return saved ? JSON.parse(saved) : INITIAL_RESOURCES;
  });

  const [alerts, setAlerts] = useState<InfrastructureAlert[]>(() => {
    const saved = localStorage.getItem('ucfm_alerts_v1');
    return saved ? JSON.parse(saved) : INITIAL_ALERTS;
  });

  const [logs, setLogs] = useState<InfrastructureLog[]>(() => {
    const saved = localStorage.getItem('ucfm_logs_v1');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  const [costs, setCosts] = useState<CostBreakdownItem[]>(INITIAL_COST_BREAKDOWN);
  const [recommendations, setRecommendations] = useState<FinOpsRecommendation[]>(() => {
    const saved = localStorage.getItem('ucfm_recs_v1');
    return saved ? JSON.parse(saved) : INITIAL_RECOMMENDATIONS;
  });

  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(() => {
    const saved = localStorage.getItem('ucfm_workflows_v1');
    return saved ? JSON.parse(saved) : INITIAL_WORKFLOWS;
  });

  const [selectedEnvironment, setSelectedEnvironment] = useState<CloudEnvironment>('production');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<'ALL' | CloudPlatform>('ALL');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('ALL');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('ucfm_cloud_accounts_v1', JSON.stringify(cloudAccounts));
  }, [cloudAccounts]);

  useEffect(() => {
    localStorage.setItem('ucfm_resources_v1', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('ucfm_alerts_v1', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem('ucfm_logs_v1', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('ucfm_recs_v1', JSON.stringify(recommendations));
  }, [recommendations]);

  useEffect(() => {
    localStorage.setItem('ucfm_workflows_v1', JSON.stringify(workflows));
  }, [workflows]);

  // Operations
  const toggleResourcePower = (resourceId: string) => {
    setResources((prev) =>
      prev.map((r) => {
        if (r.id !== resourceId) return r;
        const willStop = r.status !== 'STOPPED';
        const newStatus = willStop ? 'STOPPED' : 'HEALTHY';
        const msg = willStop
          ? 'Instance stopped by user operator'
          : 'Instance running, metrics nominal';

        // Add log entry
        const newLog: InfrastructureLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString() + ' UTC',
          timestampEpoch: Date.now(),
          level: willStop ? 'WARN' : 'INFO',
          provider: r.provider,
          service: r.type,
          resourceName: r.name,
          message: `${willStop ? 'Power OFF signal sent' : 'Power ON & health check verified'} for ${r.name}`,
        };
        setLogs((l) => [newLog, ...l]);

        toast.success(
          `${r.name} is now ${willStop ? 'Stopped' : 'Starting up...'}`
        );

        return {
          ...r,
          status: newStatus,
          statusMessage: msg,
          metrics: {
            ...r.metrics,
            cpuUsagePercent: willStop ? 0 : 35,
            memoryUsagePercent: willStop ? 0 : 50,
          },
          lastUpdated: 'Just now',
        };
      })
    );
  };

  const rebootResource = (resourceId: string) => {
    const res = resources.find((r) => r.id === resourceId);
    if (!res) return;

    toast.info(`Reboot sequence initiated for ${res.name}`);

    const newLog: InfrastructureLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      timestampEpoch: Date.now(),
      level: 'INFO',
      provider: res.provider,
      service: res.type,
      resourceName: res.name,
      message: `Warm restart executed for ${res.name}. Health check verified in 4.2s.`,
    };
    setLogs((l) => [newLog, ...l]);

    setTimeout(() => {
      toast.success(`${res.name} reboot completed. Health check status: OK.`);
    }, 1200);
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a))
    );
    toast.success('Alert acknowledged');
  };

  const resolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'RESOLVED' } : a))
    );
    toast.success('Alert marked as resolved');
  };

  const applyRecommendation = (recommendationId: string) => {
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (!rec) return;

    setRecommendations((prev) =>
      prev.map((r) => (r.id === recommendationId ? { ...r, status: 'APPLIED' } : r))
    );

    // If it's an idle resource, stop it
    if (rec.type === 'IDLE_RESOURCE') {
      toggleResourcePower(rec.resourceId);
    }

    toast.success(
      `Applied optimization: "${rec.title}". Estimated monthly savings: $${rec.estimatedMonthlySavings}/mo.`
    );
  };

  const triggerWorkflow = (workflowId: string) => {
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;

    toast.info(`Triggering runbook: "${wf.name}"...`);

    setTimeout(() => {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId
            ? {
                ...w,
                lastRunTimestamp: Date.now(),
                lastRunStatus: 'SUCCESS',
                executionCount: w.executionCount + 1,
              }
            : w
        )
      );

      const newLog: InfrastructureLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString() + ' UTC',
        timestampEpoch: Date.now(),
        level: 'INFO',
        provider: wf.targetClouds[0] || 'AWS',
        service: 'Automation-Engine',
        resourceName: wf.name,
        message: `Workflow "${wf.name}" completed execution with code 0.`,
      };
      setLogs((l) => [newLog, ...l]);

      toast.success(`Workflow "${wf.name}" finished successfully.`);
    }, 1000);
  };

  const connectProvider = (
    provider: CloudPlatform,
    name: string,
    accountIdOrSub: string
  ) => {
    const newAccount: CloudProviderAccount = {
      id: `cpa-${Date.now()}`,
      provider,
      displayName: name,
      accountIdOrSub,
      status: 'CONNECTED',
      healthScore: 100,
      environment: selectedEnvironment,
      resourceCount: 8,
      estimatedMonthlyCost: 450,
      activeWarningsCount: 0,
      primaryRegion: 'us-east-1',
      lastSyncTimestamp: Date.now(),
      connectedSince: new Date().toISOString().split('T')[0],
    };

    setCloudAccounts((prev) => [...prev, newAccount]);
    toast.success(`Connected ${provider} provider account: ${name}`);
  };

  const exportLogsAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `multicloud-audit-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Exported infrastructure logs');
  };

  return (
    <InfrastructureContext.Provider
      value={{
        cloudAccounts,
        resources,
        alerts,
        logs,
        costs,
        recommendations,
        workflows,
        selectedEnvironment,
        setSelectedEnvironment,
        selectedProviderFilter,
        setSelectedProviderFilter,
        selectedRegionFilter,
        setSelectedRegionFilter,
        selectedResource,
        setSelectedResource,
        toggleResourcePower,
        rebootResource,
        acknowledgeAlert,
        resolveAlert,
        applyRecommendation,
        triggerWorkflow,
        connectProvider,
        exportLogsAsJson,
      }}
    >
      {children}
    </InfrastructureContext.Provider>
  );
};

export const useInfrastructure = (): InfrastructureContextType => {
  const context = useContext(InfrastructureContext);
  if (!context) {
    throw new Error('useInfrastructure must be used within an InfrastructureProvider');
  }
  return context;
};
