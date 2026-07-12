import { getAdminToken } from './admin-session';

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1');

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export class ApiError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || 'API error', data.details);
  return data.data as T;
}

/* ── Shared types ─────────────────────────────────────────────────────────── */

export type ApiScrTier = {
  _id: string;
  name: string;
  pricePaise: number;
  capacity: number;
  sold: number;
  description: string;
  salesEndDate: string | null;
  isDisabled: boolean;
  showIds: string[];
};

export type ApiScrShow = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'expired' | 'cancelled';
};

export type ApiScrEvent = {
  _id: string;
  title: string;
  description: string;
  slug: string;
  image: string;
  poster: string;
  videoUrl: string;
  galleryImages: string[];
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  venueName: string;
  location: string;
  locationUrl: string;
  categories: string[];
  subCategories: string[];
  languages: string[];
  tiers: ApiScrTier[];
  shows: ApiScrShow[];
  contacts: { name: string; email: string; phone: string }[];
  payout: { gstin: string; accountNumber: string; ifsc: string; accountType: string };
  extraSections: { type: string; content: string }[];
  isIndoor: boolean | null;
  isSeated: boolean | null;
  kidFriendly: boolean | null;
  petFriendly: boolean | null;
  minAgeEntry: number;
  minAgePaid: number;
  gatesOpenBefore: number;
  ownRestaurant: boolean;
  venueInstagram: string;
  showOrganiser: boolean;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiScrListResponse = {
  events: ApiScrEvent[];
  total: number;
  page: number;
  limit: number;
};

export type CreateScrEventPayload = {
  title: string;
  description: string;
  categories: string[];
  subCategories: string[];
  languages: string[];
  venueName: string;
  location: string;
  locationUrl?: string;
  ownRestaurant: boolean | null;
  venueInstagram: string;
  gatesOpenBefore: number;
  isIndoor: boolean | null;
  isSeated: boolean | null;
  kidFriendly: boolean | null;
  petFriendly: boolean | null;
  minAgeEntry: number;
  minAgePaid: number;
  shows: { date: string; startTime: string; endTime: string }[];
  tiers: { _id?: string; name: string; pricePaise: number; capacity: number; description: string; salesEndDate?: string | null; isDisabled?: boolean; showIds?: string[] }[];
  contacts: { name: string; email: string; phone: string }[];
  payout: { gstin: string; accountNumber: string; ifsc: string; accountType: 'savings' | 'current' };
  extraSections: { type: string; content: string }[];
  image: string;
  poster: string;
  videoUrl: string;
  galleryImages: string[];
  showOrganiser?: boolean;
};

export type ScrTierStat = {
  tierId:       string;
  tierName:     string;
  capacity:     number;
  sold:         number;
  pricePaise:   number;
  revenuePaise: number;
};

export type ScrAnalyticsData = {
  totalRevenuePaise: number;
  totalCapacity:     number;
  totalTicketsSold:  number;
  confirmedCount:    number;
  usedCount:         number;
  pendingCount:      number;
  cancelledCount:    number;
  checkInRate:       number;
  tierStats:         ScrTierStat[];
};

export type ScrAdminTicket = {
  _id:               string;
  entryCode:         string;
  status:            'pending' | 'confirmed' | 'used' | 'cancelled';
  totalPaise:        number;
  bookedAt:          string;
  usedAt:            string | null;
  cancelledAt:       string | null;
  lineItems:         { tierName: string; quantity: number; pricePaise: number }[];
  player:            { _id: string; name: string; email: string; phone: string } | null;
};

export type ScrAdminTicketsResponse = {
  tickets: ScrAdminTicket[];
  total:   number;
  page:    number;
  limit:   number;
};

export type ScrExportRow = {
  transactionType: string;
  brandName: string;
  registeredCompanyName: string;
  eventName: string;
  eventShow: string;
  showStartTime: string;
  showEndTime: string;
  showId: string;
  eventCategory: string;
  eventCity: string;
  venueName: string;
  billingEmail: string;
  userState: string;
  name: string;
  email: string;
  phone: string;
  transactionId: string;
  shortcode: string;
  transactionTime: string;
  transactionLastModifiedTime: string;
  ticketGroup: string;
  ticketName: string;
  ticketListPrice: number;
  numberOfTickets: number;
  seatNumber: string;
  redeemedStatus: string;
  printedStatus: string;
  grossAmount: number;
  discount: number;
  netAmount: number;
  discountType: string;
  discountCoupon: string;
  discountFundedBy: string;
  offlinePayment: string;
  cgstPct: number;
  cgstAmount: number;
  sgstPct: number;
  sgstAmount: number;
  igstPct: number;
  igstAmount: number;
  tax1Name: string;
  tax1Amount: string;
  tax1Pct: string;
  tax2Name: string;
  tax2Amount: string;
  tax2Pct: string;
  basePrice: number;
  commissionPct: number;
  commissionAmount: number;
  transactionSource: string;
  devicePlatform: string;
};

export type ScrExportResponse = {
  rows: ScrExportRow[];
  eventTitle: string;
};

export type ScrScanResult = {
  _id:        string;
  entryCode:  string;
  status:     string;
  usedAt:     string | null;
  totalPaise: number;
  lineItems:  { tierName: string; quantity: number; pricePaise: number }[];
  event:      { title: string; venueName: string; location: string };
  bookedAt:   string;
};

export type ScrCarousel = {
  _id:      string;
  title:    string;
  banner:   string;
  poster:   string;
  createdAt: string;
  updatedAt?: string;
};

/* ── API helpers ──────────────────────────────────────────────────────────── */

export const scrApi = {
  listAdmin: (params?: { search?: string; status?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page)   qs.set('page', String(params.page));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<ApiScrListResponse>(`/screening/admin/events${query}`);
  },

  createEvent: (payload: CreateScrEventPayload) =>
    apiFetch<ApiScrEvent>('/screening/admin/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getEvent: (id: string) =>
    apiFetch<ApiScrEvent>(`/screening/admin/events/${id}`),

  updateEvent: (id: string, payload: Partial<CreateScrEventPayload>) =>
    apiFetch<ApiScrEvent>(`/screening/admin/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  publishEvent: (id: string) =>
    apiFetch<ApiScrEvent>(`/screening/admin/events/${id}/publish`, { method: 'PATCH' }),

  cancelEvent: (id: string, reason: string) =>
    apiFetch<ApiScrEvent>(`/screening/admin/events/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  completeEvent: (id: string) =>
    apiFetch<ApiScrEvent>(`/screening/admin/events/${id}/complete`, { method: 'PATCH' }),

  deleteEvent: (id: string) =>
    apiFetch<null>(`/screening/admin/events/${id}`, { method: 'DELETE' }),

  getEventAnalytics: (id: string) =>
    apiFetch<ScrAnalyticsData>(`/screening/admin/events/${id}/analytics`),

  scanTicket: (entryCode: string, eventId?: string) =>
    apiFetch<ScrScanResult>(`/screening/admin/scan`, {
      method: 'POST',
      body: JSON.stringify({ entryCode, ...(eventId ? { eventId } : {}) }),
    }),

  listCarousels: () => apiFetch<ScrCarousel[]>(`/screening/admin/carousel`),

  createCarousel: (payload: { title: string; banner: string; poster: string }) =>
    apiFetch<ScrCarousel>(`/screening/admin/carousel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCarousel: (id: string) =>
    apiFetch<null>(`/screening/admin/carousel/${id}`, {
      method: 'DELETE',
    }),

  uploadImage: async (file: File): Promise<string> => {
    const token = getAdminToken();
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${BASE}/screening/admin/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');
    return (data.data as { url: string }).url;
  },

  exportTickets: (id: string) =>
    apiFetch<ScrExportResponse>(`/screening/admin/events/${id}/export`),

  getEventTickets: (id: string, params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page)   qs.set('page', String(params.page));
    if (params?.limit)  qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<ScrAdminTicketsResponse>(`/screening/admin/events/${id}/tickets${query}`);
  },
};

/* ── Transform API event → UI ScrEvent shape ─────────────────────────────── */

export type UIScrEvent = {
  id: string;
  title: string;
  venue: string;
  date: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  image: string;
  capacity: number;
  sold: number;
  pricePaise: number;
  contacts: { name: string; email: string; phone: string }[];
  showOrganiser: boolean;
};

export function toUIScrEvent(e: ApiScrEvent): UIScrEvent {
  const firstShow = e.shows[0];
  let dateLabel = 'TBD';
  if (firstShow) {
    const d = new Date(firstShow.date);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    dateLabel = `${dateStr} | ${firstShow.startTime}`;
  }
  const capacity   = e.tiers.reduce((s, t) => s + t.capacity, 0);
  const sold       = e.tiers.reduce((s, t) => s + t.sold, 0);
  const pricePaise = e.tiers.length > 0 ? Math.min(...e.tiers.map(t => t.pricePaise)) : 0;
  return {
    id:         e._id,
    title:      e.title,
    venue:      [e.venueName, e.location].filter(Boolean).join(', '),
    date:       dateLabel,
    status:     e.status,
    image:      e.image,
    capacity,
    sold,
    pricePaise,
    contacts:      e.contacts || [],
    showOrganiser: e.showOrganiser ?? false,
  };
}
