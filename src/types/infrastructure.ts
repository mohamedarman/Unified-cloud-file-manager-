// Enterprise Multi-Cloud Infrastructure & Management Types

export type CloudPlatform = 'AWS' | 'AZURE' | 'GCP' | 'GOOGLE_DRIVE' | 'ONE_DRIVE' | 'DROPBOX' | 'BOX';

export type ResourceType =
  | 'COMPUTE'
  | 'STORAGE'
  | 'DATABASE'
  | 'NETWORK'
  | 'KUBERNETES'
  | 'SERVERLESS';

export type ResourceStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'CRITICAL'
  | 'STOPPED'
  | 'PROVISIONING';

export type CloudEnvironment = 'production' | 'staging' | 'development';

export interface CloudResource {
  id: string;
  name: string;
  type: ResourceType;
  provider: CloudPlatform;
  providerIcon?: string;
  region: string;
  environment: CloudEnvironment;
  status: ResourceStatus;
  statusMessage?: string;
  costMonthly: number;
  specs: {
    instanceType?: string;
    vCpu?: number;
    memoryGb?: number;
    storageGb?: number;
    engine?: string;
    engineVersion?: string;
    ipAddress?: string;
    vpcId?: string;
    clusterVersion?: string;
    nodesCount?: number;
    activeConnections?: number;
    iops?: number;
  };
  metrics: {
    cpuUsagePercent?: number;
    memoryUsagePercent?: number;
    diskUsagePercent?: number;
    networkInMbps?: number;
    networkOutMbps?: number;
    uptimePercentage?: number;
  };
  tags: Record<string, string>;
  createdAt: string;
  lastUpdated: string;
}

export interface CloudProviderAccount {
  id: string;
  provider: CloudPlatform;
  displayName: string;
  accountIdOrSub: string;
  status: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
  healthScore: number;
  environment: CloudEnvironment;
  resourceCount: number;
  estimatedMonthlyCost: number;
  activeWarningsCount: number;
  primaryRegion: string;
  lastSyncTimestamp: number;
  connectedSince: string;
}

export interface InfrastructureAlert {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  provider: CloudPlatform;
  resourceId: string;
  resourceName: string;
  message: string;
  recommendation: string;
  timestamp: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  metricThreshold?: string;
}

export interface InfrastructureLog {
  id: string;
  timestamp: string;
  timestampEpoch: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  provider: CloudPlatform;
  service: string;
  resourceName: string;
  message: string;
  traceId?: string;
}

export interface CostBreakdownItem {
  id: string;
  name: string;
  provider: CloudPlatform;
  currentSpend: number;
  budget: number;
  projectedSpend: number;
  percentageOfTotal: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  trendPercent: number;
}

export interface FinOpsRecommendation {
  id: string;
  title: string;
  resourceId: string;
  resourceName: string;
  provider: CloudPlatform;
  service: string;
  currentCost: number;
  estimatedMonthlySavings: number;
  type: 'IDLE_RESOURCE' | 'RIGHTSIZING' | 'RESERVED_INSTANCE' | 'STORAGE_TIERING';
  description: string;
  status: 'OPEN' | 'APPLIED' | 'DISMISSED';
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  triggerType: 'SCHEDULE' | 'EVENT' | 'THRESHOLD' | 'MANUAL';
  scheduleCron?: string;
  targetClouds: CloudPlatform[];
  status: 'ACTIVE' | 'PAUSED' | 'FAILED';
  lastRunTimestamp: number;
  lastRunStatus: 'SUCCESS' | 'FAILED' | 'RUNNING';
  executionCount: number;
  actionSummary: string;
}
