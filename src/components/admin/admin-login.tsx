"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminSession, saveAdminSession } from "@/lib/admin-session";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "http://localhost:5000/api/v1";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getAdminSession()) {
      router.replace("/dashboard");
      return;
    } else setReady(true);
  }, [router]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed. Check your credentials.");
        return;
      }

      saveAdminSession({
        token: data.token,
        adminId: data.admin.id,
        name: data.admin.name,
        email: data.admin.email,
        role: data.admin.role,
      });

      router.replace("/dashboard");
    } catch {
      setError("Cannot reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <main className="relative grid min-h-screen place-items-center px-[1.2rem] py-8">
      <div className="pointer-events-none absolute inset-0 bg-[image:radial-gradient(circle_at_8%_6%,rgba(73,148,245,0.16),transparent_30%),radial-gradient(circle_at_92%_92%,rgba(31,197,140,0.12),transparent_32%),linear-gradient(140deg,#060b0f_0%,#0b1318_48%,#101a22_100%),repeating-linear-gradient(45deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02)_1px,transparent_1px,transparent_14px)]" />
      <div className="relative grid w-[min(1080px,100%)] grid-cols-[1.1fr_0.9fr] overflow-hidden rounded-4xl border border-[#24313b] bg-[image:linear-gradient(160deg,rgba(18,26,31,0.95),rgba(16,24,30,0.96))] shadow-[0_24px_80px_rgba(3,7,8,0.6)] max-[1024px]:grid-cols-1">
        {/* ── Brand panel ── */}
        <section className="p-10 max-[640px]:p-4">
          <div className="mb-4 inline-flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 flex-col overflow-hidden border-[1.5px] border-[#2a2a2a]">
              <div className="flex flex-1 items-center justify-center bg-[#f4f8f9]">
                <span className="font-mono text-[8.5px] font-extrabold leading-none tracking-[0.1em] text-black">
                  KASA
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center border-t-[1.5px] border-t-[#2a2a2a] bg-black">
                <span className="font-mono text-[8.5px] font-extrabold leading-none tracking-[0.1em] text-[#f4f8f9]">
                  KAI
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-0 leading-none">
              <p className="m-0 font-mono text-[16px] font-extrabold leading-none tracking-[0.14em] text-[#f4f8f9]">
                KASA
              </p>
              <p className="m-0 font-mono text-[16px] font-extrabold leading-none tracking-[0.14em] text-muted">
                KAI
              </p>
            </div>
          </div>
          <p className="mt-4 inline-flex w-fit rounded-full border border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.14)] px-[0.7rem] py-[0.3rem] text-[0.72rem] font-bold uppercase leading-[1.65] tracking-[0.18em] text-muted">
            Kasa Kai Admin
          </p>
          <h1 className="mt-[1.2rem] font-display text-[clamp(2rem,3vw,3rem)] leading-[1.08] tracking-[-0.02em]">
            Control the platform from one command center.
          </h1>
          <p className="mt-4 leading-[1.65] text-muted">
            Monitor approvals, events, payouts, and system health from a single
            operational dashboard designed for high-volume moderation.
          </p>
          <div className="mt-8 grid gap-[0.8rem]">
            <article className="rounded-[0.9rem] border border-[#24313b] bg-[rgba(18,26,31,0.72)] px-4 py-[0.9rem]">
              <strong className="block font-display text-[1.3rem]">3.4k+</strong>
              <span className="mt-1 block text-[0.9rem] text-muted">Daily active players</span>
            </article>
            <article className="rounded-[0.9rem] border border-[#24313b] bg-[rgba(18,26,31,0.72)] px-4 py-[0.9rem]">
              <strong className="block font-display text-[1.3rem]">146</strong>
              <span className="mt-1 block text-[0.9rem] text-muted">Live events monitored</span>
            </article>
            <article className="rounded-[0.9rem] border border-[#24313b] bg-[rgba(18,26,31,0.72)] px-4 py-[0.9rem]">
              <strong className="block font-display text-[1.3rem]">99.95%</strong>
              <span className="mt-1 block text-[0.9rem] text-muted">Service uptime this quarter</span>
            </article>
          </div>
        </section>

        {/* ── Login card ── */}
        <section className="grid place-items-center border-l border-[#24313b] p-8 max-[1024px]:border-l-0 max-[1024px]:border-t max-[640px]:p-4">
          <div className="w-full rounded-[1.2rem] border border-[#24313b] bg-[rgba(16,24,30,0.9)] p-6">
            <h2 className="font-display text-[1.6rem]">Sign in</h2>
            <p className="mb-[1.2rem] mt-[0.6rem] text-muted">
              Use your admin credentials to open the dashboard.
            </p>

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="admin-email"
                className="mb-[0.38rem] block text-[0.84rem] text-[#d9e3ea]"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="text"
                placeholder="admin@kasakai.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                className="mb-4 w-full rounded-[0.8rem] border border-[#2f3f4c] bg-[rgba(10,16,21,0.88)] px-[0.9rem] py-[0.72rem] text-[#ecfffa] outline-none focus:border-[rgba(73,148,245,0.8)] focus:shadow-[0_0_0_4px_rgba(73,148,245,0.18)]"
              />

              <label
                htmlFor="admin-password"
                className="mb-[0.38rem] block text-[0.84rem] text-[#d9e3ea]"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                className="mb-4 w-full rounded-[0.8rem] border border-[#2f3f4c] bg-[rgba(10,16,21,0.88)] px-[0.9rem] py-[0.72rem] text-[#ecfffa] outline-none focus:border-[rgba(73,148,245,0.8)] focus:shadow-[0_0_0_4px_rgba(73,148,245,0.18)]"
              />

              {error && (
                <div className="mb-4 rounded-[0.8rem] border border-[rgba(241,118,127,0.36)] bg-[rgba(178,39,52,0.2)] px-[0.7rem] py-[0.58rem] text-[0.88rem] text-[#ffd2d6]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-[0.84rem] border-0 bg-[image:linear-gradient(120deg,#4b8fe8,#3174cd)] p-[0.8rem] font-extrabold uppercase tracking-[0.1em] text-[#f4f8f9]"
              >
                {loading ? "Signing in…" : "Login to dashboard"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
