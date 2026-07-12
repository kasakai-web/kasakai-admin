"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAdminToken } from "@/lib/admin-session";
import styles from "./NotificationBell.module.css";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000/api/v1").replace(/\/$/, "");

interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
}

const TYPE_ICON: Record<string, string> = {
  game_created:           "🏟️",
  game_registered:        "✅",
  game_cancelled:         "⛔",
  game_backout_player:    "↩️",
  game_backout_organiser: "📢",
  waitlist_joined:        "⏳",
  waitlist_spot:          "🔔",
  waitlist_approved:      "🎉",
  player_removed:         "❌",
  wallet_topup:           "💰",
  wallet_debit:           "💸",
  wallet_refund:          "💚",
  system:                 "ℹ️",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) setUnread(data.data?.count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 15_000);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  const fetchNotifications = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setNotifications(data.data?.notifications ?? []);
        setUnread(data.data?.unread ?? 0);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  const handleOpen = () => {
    setOpen((v) => {
      if (!v) fetchNotifications();
      return !v;
    });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (n: Notification) => {
    if (!n.isRead) {
      const token = getAdminToken();
      if (!token) return;
      try {
        await fetch(`${API_BASE}/notifications/${n._id}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications((prev) => prev.map((x) => x._id === n._id ? { ...x, isRead: true } : x));
        setUnread((c) => Math.max(0, c - 1));
      } catch {}
    }
  };

  const markAllRead = async () => {
    if (marking || unread === 0) return;
    setMarking(true);
    const token = getAdminToken();
    if (!token) { setMarking(false); return; }
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } catch {}
    finally { setMarking(false); }
  };

  return (
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        className={`${styles.btn}${open ? ` ${styles.active}` : ""}`}
        onClick={handleOpen}
        aria-label="Notifications"
        title="Notifications"
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel} ref={panelRef}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notifications</span>
            <button
              className={styles.markAll}
              onClick={markAllRead}
              disabled={marking || unread === 0}
              type="button"
            >
              {marking ? "Marking…" : "Mark all read"}
            </button>
          </div>

          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /></div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔔</span>
              <span className={styles.emptyText}>No notifications yet.</span>
            </div>
          ) : (
            <div className={styles.list}>
              {notifications.map((n) => (
                <button
                  key={n._id}
                  className={`${styles.item}${!n.isRead ? ` ${styles.unread}` : ""}`}
                  onClick={() => markRead(n)}
                  type="button"
                >
                  <span className={styles.icon}>{TYPE_ICON[n.type] ?? "ℹ️"}</span>
                  <span className={styles.content}>
                    <span className={styles.title}>{n.title}</span>
                    <span className={styles.body}>{n.body}</span>
                    <span className={styles.time}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && <span className={styles.dot} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
