import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Analytics } from "@/components/admin/dashboard/sections/Analytics";

// The sidebar's Analytics → Games / Players links; any other topic is a 404.
export const metadata: Metadata = { title: sectionTitles.analytics };
export const dynamicParams = false;
export const generateStaticParams = () => [{ topic: "games" }, { topic: "players" }];

export default async function AnalyticsTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  return <Analytics topic={topic} />;
}
