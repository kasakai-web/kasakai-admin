export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string;
};

export type StatCard = {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
};

export type RevenuePoint = {
  month: string;
  amount: number;
};

export type ApprovalQueueItem = {
  id: string;
  name: string;
  role: "Organiser" | "Venue";
  submittedAt: string;
  status: "pending" | "flagged";
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
};

export type AlertItem = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  detail: string;
};

export type AdminDashboardData = {
  adminName: string;
  navItems: NavItem[];
  statCards: StatCard[];
  revenueSeries: RevenuePoint[];
  approvalQueue: ApprovalQueueItem[];
  activities: ActivityItem[];
  alerts: AlertItem[];
};
