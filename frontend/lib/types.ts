export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId?: string;
}

export interface SecurityEvent {
  id: string;
  source: string;
  eventType: string;
  sourceIp: string | null;
  username: string | null;
  host: string | null;
  rawMessage: string;
  occurredAt: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: AlertStatus;
  ruleId: string;
  mitreTacticId: string | null;
  mitreTacticName: string | null;
  mitreTechniqueId: string | null;
  mitreTechniqueName: string | null;
  aiSummary: string | null;
  aiRecommendation: string | null;
  aiConfidence: number | null;
  acknowledgedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  events?: { event: SecurityEvent }[];
}

export interface DashboardOverview {
  kpis: { totalAlerts: number; openAlerts: number; criticalOpen: number; totalEvents: number };
  severityBreakdown: { severity: Severity; count: number }[];
  statusBreakdown: { status: AlertStatus; count: number }[];
  alertsOverTime: { date: string; count: number }[];
  mitreHeatmap: { tacticId: string; tacticName: string; count: number }[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
