"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScrCreateEventForm } from "@/components/admin/dashboard/screening/CreateForm";
import { scrApi, type CreateScrEventPayload } from "@/lib/screening-api";

export default function CreateEventPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(payload: CreateScrEventPayload, status: 'draft' | 'published') {
    setApiError(null);
    try {
      const event = await scrApi.createEvent(payload);
      if (status === 'published') {
        await scrApi.publishEvent(event._id);
      }
      router.push('/dashboard/streaming');
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Failed to save event. Please try again.');
    }
  }

  return (
    <>
      {apiError && (
        <div style={{
          margin: "0 0 16px",
          padding: "12px 16px",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "8px",
          color: "#ef4444",
          fontSize: "13px",
          fontWeight: 600,
        }}>
          {apiError}
        </div>
      )}
      <ScrCreateEventForm
        onBack={() => router.push("/dashboard/streaming")}
        onSubmit={handleSubmit}
      />
    </>
  );
}
