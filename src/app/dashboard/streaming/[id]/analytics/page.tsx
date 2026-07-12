"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { scrApi, toUIScrEvent, type ApiScrEvent, type ScrAnalyticsData } from "@/lib/screening-api";
import { ScrAnalyticsPage } from "@/components/admin/dashboard/screening/AnalyticsPage";
import { scrStatusBadge } from "@/components/admin/dashboard/screening/types";

export default function AnalyticsEventPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [event,     setEvent]     = useState<ApiScrEvent | null>(null);
  const [analytics, setAnalytics] = useState<ScrAnalyticsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, an] = await Promise.all([scrApi.getEvent(id), scrApi.getEventAnalytics(id)]);
      setEvent(ev);
      setAnalytics(an);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 40px" }}>
        <svg className="animate-spin" width="28" height="28" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="3" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0110 10" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (error || !event || !analytics) {
    return (
      <div style={{ padding: "80px 40px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
        {error || "Event not found."}
      </div>
    );
  }

  const ev = toUIScrEvent(event);
  const badge = scrStatusBadge(ev.status);

  return (
    <ScrAnalyticsPage
      ev={ev}
      eventId={id}
      analytics={analytics}
      badge={badge}
      onBack={() => router.push("/dashboard/streaming")}
      onRefresh={load}
    />
  );
}
