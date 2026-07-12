"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { scrApi, type ApiScrEvent } from "@/lib/screening-api";
import { ScrAttendeesPage } from "@/components/admin/dashboard/screening/AttendeesPage";

export default function AttendeesEventPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [event,   setEvent]   = useState<ApiScrEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    scrApi.getEvent(id)
      .then(e => setEvent(e))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

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

  if (error || !event) {
    return (
      <div style={{ padding: "80px 40px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
        {error || "Event not found."}
      </div>
    );
  }

  return (
    <ScrAttendeesPage
      event={event}
      onBack={() => router.push(`/dashboard/streaming/${id}/manage`)}
    />
  );
}
