import type { AdminDashboardData } from "@/types/admin";

export const adminDashboardData: AdminDashboardData = {
  adminName: "Kasa Kai Super Admin",
  navItems: [
    { id: "overview", label: "Overview", icon: "Grid", href: "/dashboard" },
    { id: "organisers", label: "Organisers", icon: "Users", href: "#" },
    { id: "events", label: "Events", icon: "Calendar", href: "#", badge: "18" },
    { id: "approvals", label: "Approvals", icon: "Shield", href: "#", badge: "7" },
    { id: "billing", label: "Billing", icon: "CreditCard", href: "#" },
    { id: "settings", label: "Settings", icon: "Sliders", href: "#" },
  ],
  statCards: [
    { id: "active-users", label: "Active users", value: "12,482", delta: "+8.4%", trend: "up" },
    { id: "live-events", label: "Live events", value: "146", delta: "+12.2%", trend: "up" },
    { id: "pending-approvals", label: "Pending approvals", value: "07", delta: "-2.1%", trend: "down" },
    { id: "gross-revenue", label: "Gross revenue", value: "$238,400", delta: "+14.7%", trend: "up" },
  ],
  revenueSeries: [
    { month: "Jan", amount: 28 },
    { month: "Feb", amount: 42 },
    { month: "Mar", amount: 38 },
    { month: "Apr", amount: 54 },
    { month: "May", amount: 67 },
    { month: "Jun", amount: 73 },
    { month: "Jul", amount: 81 },
  ],
  approvalQueue: [
    {
      id: "AQ-1021",
      name: "Moonlight Sports Club",
      role: "Organiser",
      submittedAt: "Today, 09:41",
      status: "pending",
    },
    {
      id: "AQ-1016",
      name: "Peakline Arena",
      role: "Venue",
      submittedAt: "Today, 08:09",
      status: "flagged",
    },
    {
      id: "AQ-1002",
      name: "Coastal League",
      role: "Organiser",
      submittedAt: "Yesterday, 18:26",
      status: "pending",
    },
  ],
  activities: [
    {
      id: "ACT-1",
      actor: "Aarav Sharma",
      action: "approved organiser",
      target: "Urban Hoops Delhi",
      timestamp: "6 min ago",
    },
    {
      id: "ACT-2",
      actor: "System",
      action: "flagged payout attempt",
      target: "Transaction #P23892",
      timestamp: "19 min ago",
    },
    {
      id: "ACT-3",
      actor: "Naina Verma",
      action: "updated compliance status",
      target: "Pulse Fitness",
      timestamp: "41 min ago",
    },
  ],
  alerts: [
    {
      id: "AL-1",
      title: "High chargeback ratio detected",
      severity: "critical",
      detail: "West region crossed the 2.8% threshold in the last 24 hours.",
    },
    {
      id: "AL-2",
      title: "KYC backlog building",
      severity: "warning",
      detail: "18 organiser verifications are waiting for first review.",
    },
    {
      id: "AL-3",
      title: "API latency recovered",
      severity: "info",
      detail: "P95 response time returned below 320ms after autoscaling.",
    },
  ],
};
