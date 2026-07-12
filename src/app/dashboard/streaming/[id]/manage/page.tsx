"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { scrApi, toUIScrEvent } from "@/lib/screening-api";
import { ScrManageEventPage } from "@/components/admin/dashboard/screening/ManagePage";
import type { ScrEvent } from "@/components/admin/dashboard/screening/types";

export default function ManageEventPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [ev,      setEv]      = useState<ScrEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    scrApi.getEvent(id)
      .then(e => setEv(toUIScrEvent(e)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 40px" }}>
        <svg className="animate-spin" width="28" height="28" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="#5be6b2" strokeWidth="3" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0110 10" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (error || !ev) {
    return (
      <div style={{ padding: "80px 40px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
        {error || "Event not found."}
      </div>
    );
  }

  return <ScrManageEventPage ev={ev} onBack={() => router.push("/dashboard/streaming")} />;
}
