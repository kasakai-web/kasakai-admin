"use client";

import { createContext, useContext } from "react";
import type { DashboardSection } from "@/components/admin/dashboard/constants";

type DashboardCtx = {
  activeSection: DashboardSection;
  setActiveSection: (s: DashboardSection) => void;
  onOpenDetail: (title: string) => void;
  onNavigate: (s: DashboardSection) => void;
};

export const DashboardContext = createContext<DashboardCtx>({
  activeSection: "dashboard",
  setActiveSection: () => {},
  onOpenDetail: () => {},
  onNavigate: () => {},
});

export const useDashboard = () => useContext(DashboardContext);
