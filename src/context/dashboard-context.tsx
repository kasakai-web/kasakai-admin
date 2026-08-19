"use client";

import { createContext, useContext } from "react";
import type { DashboardSection } from "@/components/admin/dashboard/constants";

type DashboardCtx = {
  activeSection: DashboardSection;
  onOpenDetail: (title: string) => void;
  onNavigate: (s: DashboardSection) => void;
};

export const DashboardContext = createContext<DashboardCtx>({
  activeSection: "dashboard",
  onOpenDetail: () => {},
  onNavigate: () => {},
});

export const useDashboard = () => useContext(DashboardContext);
