export const ADMIN_SESSION_KEY = "adminPortalSession";

type AdminSession = {
  token:     string;
  adminId:   string;
  name:      string;
  email:     string;
  role:      string;
  loggedInAt: string;
};

export function saveAdminSession(data: Omit<AdminSession, "loggedInAt">) {
  const payload: AdminSession = {
    ...data,
    loggedInAt: new Date().toISOString(),
  };
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(payload));
}

export function getAdminSession(): AdminSession | null {
  const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function getAdminToken(): string | null {
  return getAdminSession()?.token ?? null;
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}
