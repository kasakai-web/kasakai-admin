export const dashboardSections = [
  "dashboard",
  "users",
  "organisers",
  "games",
  "payments",
  "finance",
  "wallet-admin",
  "passes",
  "notifications",
  "feedback",
  "disputes",
  "communities",
  "venues",
  "scr-events",
  "scr-guests",
  "scr-finance",
  "scr-crousels",
] as const;

export type DashboardSection = (typeof dashboardSections)[number];

export const sectionTitles: Record<DashboardSection, string> = {
  dashboard:     "Dashboard",
  users:         "Players",
  organisers:    "Organisers",
  games:         "Games & Events",
  payments:      "Payments",
  finance:        "Finance",
  "wallet-admin": "Player Wallets",
  passes:        "Pass Management",
  notifications: "Notifications",
  feedback:      "Feedback",
  disputes:      "Disputes",
  communities:   "Communities",
  venues:        "Venues & Turfs",
  "scr-events":  "Screening Events",
  "scr-guests":  "Guest List",
  "scr-finance": "Streaming Finance",
  "scr-crousels": "Carousel Image",
};

export const sectionPaths: Record<DashboardSection, string> = {
  dashboard:     "Overview",
  users:         "People / Players",
  organisers:    "People / Organisers",
  games:         "Football / Games",
  payments:      "Football / Payments",
  finance:        "Football / Finance",
  "wallet-admin": "Football / Wallets",
  passes:        "Football / Passes",
  notifications:  "Football / Notifications",
  feedback:      "Football / Feedback",
  disputes:      "Football / Disputes",
  communities:   "Config / Communities",
  venues:        "Config / Venues",
  "scr-events":  "Streaming / Events",
  "scr-guests":  "Streaming / Guest List",
  "scr-finance": "Streaming / Finance",
  "scr-crousels": "Streaming / Crousels",
};

/* Every section is its own route, so its code only ships when you open it.
   This map is the single source of truth in both directions: the sidebar links
   through it, and the layout reads the active section back off the URL. */
export const sectionRoutes: Record<DashboardSection, string> = {
  dashboard:     "/dashboard",
  users:         "/dashboard/users",
  organisers:    "/dashboard/organisers",
  games:         "/dashboard/games",
  payments:      "/dashboard/payments",
  finance:       "/dashboard/finance",
  "wallet-admin": "/dashboard/wallets",
  passes:        "/dashboard/passes",
  notifications: "/dashboard/notifications",
  feedback:      "/dashboard/feedback",
  disputes:      "/dashboard/disputes",
  communities:   "/dashboard/communities",
  venues:        "/dashboard/venues",
  "scr-events":  "/dashboard/streaming",
  "scr-guests":  "/dashboard/streaming/guests",
  "scr-finance": "/dashboard/streaming/finance",
  "scr-crousels": "/dashboard/streaming/carousels",
};

/* Longest-prefix match, so /dashboard/streaming/guests resolves to the guest
   list rather than to Events, and /dashboard/streaming/<id>/scan still lights
   up Events. Falls back to the overview. */
export function sectionForPathname(pathname: string): DashboardSection {
  let best: DashboardSection = "dashboard";
  let bestLen = 0;
  for (const section of dashboardSections) {
    const route = sectionRoutes[section];
    if ((pathname === route || pathname.startsWith(`${route}/`)) && route.length > bestLen) {
      best = section;
      bestLen = route.length;
    }
  }
  return best;
}

export type SidebarItem = {
  section: DashboardSection;
  label: string;
  badge?: string;
  badgeTone?: "default" | "red";
  accent?: "teal" | "blue" | "amber";
};

export type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

export const sidebarGroups: SidebarGroup[] = [
  {
    label: "Overview",
    items: [{ section: "dashboard", label: "Dashboard" }],
  },
  {
    label: "People",
    items: [
      { section: "users",      label: "Players" },
      { section: "organisers", label: "Organisers", badge: "pending", badgeTone: "red" },
    ],
  },
  {
    label: "Football",
    items: [
      { section: "games",         label: "Games & Events" },
      { section: "payments",      label: "Payments" },
      { section: "finance",       label: "Finance" },
      { section: "wallet-admin", label: "Wallets" },
      { section: "passes",       label: "Passes" },
      { section: "notifications", label: "Notifications" },
      { section: "feedback",      label: "Feedback" },
      { section: "disputes",      label: "Disputes", badgeTone: "red" },
    ],
  },
  {
    label: "Streaming",
    items: [
      { section: "scr-events",  label: "Events",     accent: "teal"  },
      { section: "scr-guests",  label: "Guest List", accent: "blue"  },
      { section: "scr-finance", label: "Finance",    accent: "amber" },
       { section: "scr-crousels", label: "Carousel Image", accent: "blue" }
    ],
  },
  {
    label: "Config",
    items: [
      { section: "communities", label: "Communities" },
      { section: "venues",      label: "Venues / Turfs" },
    ],
  },
];
