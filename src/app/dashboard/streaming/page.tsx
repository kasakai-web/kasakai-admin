import type { Metadata } from "next";
import { ScrEvents } from "@/components/admin/dashboard/screening";

export const metadata: Metadata = {
  title: "Screening Events | Kasa Kai Admin",
};

export default function StreamingPage() {
  return <ScrEvents />;
}
