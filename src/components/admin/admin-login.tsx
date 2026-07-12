"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminSession, saveAdminSession } from "@/lib/admin-session";
import styles from "./admin-login.module.css";

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
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <div className={styles.layout}>
        {/* ── Brand panel ── */}
        <section className={styles.brand}>
          <div className={styles.loginLogo}>
            <div className={styles.logoBlock}>
              <div className={styles.logoTop}>
                <span>KASA</span>
              </div>
              <div className={styles.logoBottom}>
                <span>KAI</span>
              </div>
            </div>
            <div className={styles.logoWordmark}>
              <p className={styles.logoWordTop}>KASA</p>
              <p className={styles.logoWordBottom}>KAI</p>
            </div>
          </div>
          <p className={styles.pill}>Kasa Kai Admin</p>
          <h1>Control the platform from one command center.</h1>
          <p>
            Monitor approvals, events, payouts, and system health from a single
            operational dashboard designed for high-volume moderation.
          </p>
          <div className={styles.metrics}>
            <article>
              <strong>3.4k+</strong>
              <span>Daily active players</span>
            </article>
            <article>
              <strong>146</strong>
              <span>Live events monitored</span>
            </article>
            <article>
              <strong>99.95%</strong>
              <span>Service uptime this quarter</span>
            </article>
          </div>
        </section>

        {/* ── Login card ── */}
        <section className={styles.cardWrap}>
          <div className={styles.card}>
            <h2>Sign in</h2>
            <p>Use your admin credentials to open the dashboard.</p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                type="text"
                placeholder="admin@kasakai.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />

              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />

              {error && <div className={styles.error}>{error}</div>}

              <button type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Login to dashboard"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
