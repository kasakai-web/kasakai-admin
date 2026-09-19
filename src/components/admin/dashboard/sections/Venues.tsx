"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useDashboard } from "@/context/dashboard-context";
import { getAdminToken } from "@/lib/admin-session";
import { resolveImageUrl, isOptimizableImageUrl } from "@/lib/resolve-image";
import {
  SECTION_HEAD, SECTION_TITLE, SECTION_SUB, STATS_GRID, STAT_CARD, STAT_LABEL, STAT_VALUE,
  STAT_DELTA, UP, DOWN, NEUTRAL, BADGE, BADGE_GREEN, BADGE_AMBER, BADGE_RED, BADGE_GRAY, TOOLBAR,
  SEARCH_INPUT, FILTER_SELECT, TABLE_WRAP, TABLE, ACTION_BTN, ACTIONS, TOPBAR_BTN,
  TOPBAR_BTN_PRIMARY, FORM_ERROR, LOADING_STATE, MODAL_OVERLAY, MODAL, MODAL_HEAD, MODAL_CLOSE,
  MODAL_FORM, MODAL_ACTIONS, FORM_GRID, FORM_LABEL, CHECKBOX_ROW, CHECK_LABEL,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { useClientPagination, useResetPageOnFilterChange } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { surfaceLabel } from "../shared/format";

// Turf
type TurfAddress = { line1: string; line2?: string; area: string; city: string; state: string; pincode: string; country?: string };
type Turf = {
  _id: string; name: string; shortName?: string; address: TurfAddress;
  surfaceType: string; numberOfPitches: number; pitchSizes: string[];
  hasFloodlights: boolean; hasChangingRooms: boolean; hasParking: boolean; hasRefreshments: boolean;
  contactPhone?: string; contactName?: string; googleMapsUrl?: string; parkingNotes?: string;
  photos?: string[];
  isVerified: boolean; isActive: boolean; totalGamesHosted: number; averageRating: number; createdAt: string;
  // Derived from address.city by the backend (utils/metro.js). `metro` is the
  // travel region players browse by — "Delhi NCR", not "Gurgaon". Read-only here:
  // the API recomputes it on every write and ignores it if sent.
  metro?: string | null; citySlug?: string | null;
};

// What a typed city string resolves to. `derived: true` means the registry has
// no entry for it, so it will end up as a city of its own in the player's picker.
type CityResolution = {
  metroSlug: string; metroLabel: string;
  citySlug: string; cityLabel: string;
  derived: boolean;
} | null;

type MetroGroup = { slug: string; label: string; state: string; cities: { slug: string; label: string }[] };

// Display label for a stored metro slug. Returns null for a slug the registry
// does not know — a city that grouped itself because nobody has added it to
// utils/metro.js yet, which the table flags rather than hides.
function metroLabelFor(slug: string | null | undefined, groups: MetroGroup[]): string | null {
  if (!slug) return null;
  return groups.find((g) => g.slug === slug)?.label ?? null;
}

const EMPTY_TURF_FORM = {
  name: "", shortName: "", surfaceType: "artificial_turf",
  numberOfPitches: 1, pitchSizes: ["medium"],
  hasFloodlights: true, hasChangingRooms: false, hasParking: false, hasRefreshments: false,
  contactPhone: "", contactName: "", googleMapsUrl: "", parkingNotes: "",
  photos: [] as string[],
  "address.line1": "", "address.line2": "", "address.area": "",
  "address.city": "", "address.state": "", "address.pincode": "",
};

type TurfForm = typeof EMPTY_TURF_FORM;

const MAX_VENUE_PHOTOS = 8;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Matches MAX_UPLOAD_BYTES in the backend's utils/imageValidation.js. The server
// still decides; rejecting here just saves the admin a pointless upload.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Upload one photo and return its stored URL.
 *
 * One request per file rather than a multi-file POST, so a single rejected
 * image reports its own reason without taking the rest of the batch with it.
 */
async function uploadVenuePhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch(`${API_BASE}/turfs/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAdminToken()}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || "Upload failed");
  return (data.data as { url: string }).url;
}

function VenuePhotoPicker({ photos, onChange, invalid }: {
  photos: string[];
  onChange: (next: string[]) => void;
  invalid: boolean;
}) {
  const [busy, setBusy] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Kept in sync every render so the sequential loop below always appends to the
  // current list rather than to a copy captured when the loop started.
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const handleFiles = async (fileList: FileList) => {
    const room = MAX_VENUE_PHOTOS - photos.length;
    const files = Array.from(fileList).slice(0, Math.max(0, room));
    if (files.length === 0) {
      setUploadError(`Up to ${MAX_VENUE_PHOTOS} photos.`);
      return;
    }
    setUploadError(null);

    for (const file of files) {
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
        setUploadError(`"${file.name}" isn't a JPEG, PNG or WebP.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setUploadError(`"${file.name}" is over 5 MB.`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const url = await uploadVenuePhoto(file);
        onChange([...photosRef.current, url]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  const full = photos.length >= MAX_VENUE_PHOTOS;

  return (
    <div className="mt-1">
      <span className="mb-[6px] block text-[12px] uppercase tracking-[0.05em] text-muted">
        Photos * <span className="normal-case tracking-normal opacity-60">({photos.length}/{MAX_VENUE_PHOTOS})</span>
      </span>

      {photos.length > 0 && (
        <div className="mb-[10px] flex flex-wrap gap-[10px]">
          {photos.map((url, i) => (
            <div key={url} className="relative">
              <Image
                src={resolveImageUrl(url)}
                alt={`Venue photo ${i + 1}`}
                width={128}
                height={88}
                unoptimized={!isOptimizableImageUrl(resolveImageUrl(url))}
                className="h-[88px] w-[128px] rounded-md border border-border-2 object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(photos.filter((p) => p !== url))}
                className="absolute -right-[6px] -top-[6px] flex h-[20px] w-[20px] cursor-pointer items-center justify-center rounded-full border border-border-2 bg-[#0b1114] text-[11px] leading-none text-muted hover:border-danger hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        className={`block rounded-[10px] border-[1.5px] border-dashed px-4 py-6 text-center transition-[border-color] duration-150 ${
          full ? "cursor-not-allowed opacity-50" : busy > 0 ? "cursor-wait" : "cursor-pointer"
        } ${invalid ? "border-danger" : "border-border-2"} bg-[#0b1114]`}
      >
        <input
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          multiple
          className="hidden"
          disabled={full || busy > 0}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            // Clear it so re-picking the same file fires change again.
            e.target.value = "";
          }}
        />
        {busy > 0 ? (
          <p className="m-0 text-[13px] text-muted">Uploading {busy} photo{busy === 1 ? "" : "s"}…</p>
        ) : full ? (
          <p className="m-0 text-[13px] text-muted">Maximum {MAX_VENUE_PHOTOS} photos reached</p>
        ) : (
          <>
            <p className="mb-1 text-[13px] font-semibold text-muted">
              {photos.length === 0 ? "Click to upload venue photos" : "Add more photos"}
            </p>
            <p className="m-0 text-[11px] text-muted opacity-60">JPEG, PNG or WebP · up to 5 MB each</p>
          </>
        )}
      </label>

      {uploadError && <p className="mt-[6px] text-[11px] text-danger">{uploadError}</p>}
    </div>
  );
}

function TurfModal({ initial, onClose, onSaved }: { initial?: Turf | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TurfForm>(
    initial
      ? {
          name: initial.name, shortName: initial.shortName ?? "", surfaceType: initial.surfaceType,
          numberOfPitches: initial.numberOfPitches, pitchSizes: initial.pitchSizes,
          hasFloodlights: initial.hasFloodlights, hasChangingRooms: initial.hasChangingRooms,
          hasParking: initial.hasParking, hasRefreshments: initial.hasRefreshments,
          contactPhone: initial.contactPhone ?? "", contactName: initial.contactName ?? "",
          googleMapsUrl: initial.googleMapsUrl ?? "", parkingNotes: initial.parkingNotes ?? "",
          photos: initial.photos ?? [],
          "address.line1": initial.address.line1, "address.line2": initial.address.line2 ?? "",
          "address.area": initial.address.area, "address.city": initial.address.city,
          "address.state": initial.address.state, "address.pincode": initial.address.pincode,
        }
      : { ...EMPTY_TURF_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  // Only set once Save has been pressed, so the two required fields are not
  // flagged red before the admin has had a chance to fill them in.
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const photosMissing = form.photos.length === 0;
  const mapsUrlMissing = !form.googleMapsUrl.trim();

  // ── City → metro preview ──────────────────────────────────────────────────
  // The city typed here decides which city's browse list this venue's games show
  // up in. That mapping is not obvious from the form ("Gurgaon" lands under
  // "Delhi NCR"), and a mistake is invisible until an organiser wonders why
  // nobody is joining — so the consequence is shown live, before saving.
  const [cityOptions, setCityOptions] = useState<MetroGroup[]>([]);
  // Tagged with the city it describes, so the preview is derived rather than
  // cleared from inside the effect — an emptied or edited field stops showing
  // the previous city's answer in the same render, with no extra setState.
  const [resolved, setResolved] = useState<{ city: string; value: CityResolution } | null>(null);
  const typedCity = form["address.city"];
  const resolution = resolved?.city === typedCity.trim() ? resolved.value : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/turfs/city-options`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
        const data = await res.json();
        if (!cancelled && data.success) setCityOptions(data.data.metros || []);
      } catch { /* the form still works; only the suggestions are missing */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced so a typed city does not fire a request per keystroke. Resolution
  // stays server-side — one implementation of the alias rules, not two.
  useEffect(() => {
    const city = typedCity.trim();
    if (!city) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`${API_BASE}/turfs/resolve-city?city=${encodeURIComponent(city)}`, {
          headers: { Authorization: `Bearer ${getAdminToken()}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) setResolved({ city, value: data.data });
      } catch { /* preview only */ }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [typedCity]);

  const set = (k: keyof TurfForm, v: string | number | boolean | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // A venue with no photo and no map link is one a player can neither judge
    // nor find, so neither can be left out. The server enforces this too — this
    // is only so the admin is told before the round trip.
    if (photosMissing || mapsUrlMissing) {
      setShowFieldErrors(true);
      setError(
        photosMissing && mapsUrlMissing
          ? "Add at least one photo and a location URL before saving."
          : photosMissing
          ? "Add at least one photo of the venue before saving."
          : "Enter the venue's location URL before saving.",
      );
      return;
    }

    setSaving(true);
    const body = {
      name: form.name, shortName: form.shortName || undefined,
      surfaceType: form.surfaceType, numberOfPitches: Number(form.numberOfPitches),
      pitchSizes: form.pitchSizes, hasFloodlights: form.hasFloodlights,
      hasChangingRooms: form.hasChangingRooms, hasParking: form.hasParking,
      hasRefreshments: form.hasRefreshments, contactPhone: form.contactPhone || undefined,
      contactName: form.contactName || undefined, googleMapsUrl: form.googleMapsUrl.trim(),
      parkingNotes: form.parkingNotes || undefined,
      photos: form.photos,
      address: {
        line1: form["address.line1"], line2: form["address.line2"] || "",
        area: form["address.area"], city: form["address.city"],
        state: form["address.state"], pincode: form["address.pincode"],
      },
    };
    try {
      const url    = initial ? `${API_BASE}/turfs/${initial._id}` : `${API_BASE}/turfs`;
      const method = initial ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save."); return; }
      onSaved();
    } catch { setError("Cannot reach the server."); }
    finally { setSaving(false); }
  };

  const inp = SEARCH_INPUT;

  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div className={MODAL} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className={SECTION_TITLE}>{initial ? "Edit Venue" : "Add Venue"}</div>
          <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={MODAL_FORM}>
          <div className={FORM_GRID}>
            <label className={FORM_LABEL}>Name *<input className={inp} value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
            <label className={FORM_LABEL}>Short Name<input className={inp} value={form.shortName} onChange={(e) => set("shortName", e.target.value)} /></label>
            <label className={FORM_LABEL}>Address Line 1 *<input className={inp} value={form["address.line1"]} onChange={(e) => set("address.line1", e.target.value)} required /></label>
            <label className={FORM_LABEL}>Address Line 2<input className={inp} value={form["address.line2"]} onChange={(e) => set("address.line2", e.target.value)} /></label>
            <label className={FORM_LABEL}>Area *<input className={inp} value={form["address.area"]} onChange={(e) => set("address.area", e.target.value)} required /></label>
            <label className={FORM_LABEL}>
              City *
              <input
                className={inp}
                value={form["address.city"]}
                onChange={(e) => set("address.city", e.target.value)}
                list="kk-city-options"
                placeholder="e.g. Gurugram"
                required
              />
              {/* Canonical spellings, so most venues never go through the alias
                  path at all. Free text is still allowed — a new city has to be
                  addable before someone can get round to registering it. */}
              <datalist id="kk-city-options">
                {cityOptions.flatMap((m) =>
                  m.cities.map((c) => <option key={`${m.slug}-${c.slug}`} value={c.label}>{m.label}</option>)
                )}
              </datalist>
              {resolution && (
                <span className={`mt-[6px] block text-[11.5px] leading-snug ${resolution.derived ? "text-warning!" : "text-muted!"}`}>
                  {resolution.derived ? (
                    <>
                      ⚠ Not a known city — players will see it as its own city,
                      “{resolution.cityLabel}”. If it belongs to an existing one
                      (e.g. Gurgaon → Delhi NCR), use that city&apos;s name, or add it
                      to the registry.
                    </>
                  ) : (
                    <>
                      Players will find this venue under{" "}
                      <strong className="text-success!">{resolution.metroLabel}</strong>
                      {resolution.cityLabel !== resolution.metroLabel && <> › {resolution.cityLabel}</>}
                    </>
                  )}
                </span>
              )}
            </label>
            <label className={FORM_LABEL}>State *<input className={inp} value={form["address.state"]} onChange={(e) => set("address.state", e.target.value)} required /></label>
            <label className={FORM_LABEL}>Pincode *<input className={inp} value={form["address.pincode"]} onChange={(e) => set("address.pincode", e.target.value)} required /></label>
            <label className={FORM_LABEL}>
              Surface Type
              <select className={FILTER_SELECT} value={form.surfaceType} onChange={(e) => set("surfaceType", e.target.value)}>
                <option value="artificial_turf">Artificial Turf</option>
                <option value="natural_grass">Natural Grass</option>
                <option value="concrete">Concrete</option>
                <option value="indoor">Indoor</option>
              </select>
            </label>
            <label className={FORM_LABEL}>Pitches<input className={inp} type="number" min={1} value={form.numberOfPitches} onChange={(e) => set("numberOfPitches", Number(e.target.value))} /></label>
            <label className={FORM_LABEL}>Contact Name<input className={inp} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
            <label className={FORM_LABEL}>Contact Phone<input className={inp} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></label>
            <label className={FORM_LABEL}>
              Location URL *
              <input
                className={`${inp} ${showFieldErrors && mapsUrlMissing ? "border-danger!" : ""}`}
                value={form.googleMapsUrl}
                onChange={(e) => set("googleMapsUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
                aria-invalid={showFieldErrors && mapsUrlMissing}
              />
              {showFieldErrors && mapsUrlMissing && <span className="mt-[6px] block text-[11.5px] text-danger!">Required — players use this to find the venue.</span>}
            </label>
            <label className={FORM_LABEL}>Parking Notes<input className={inp} value={form.parkingNotes} onChange={(e) => set("parkingNotes", e.target.value)} /></label>
          </div>
          <VenuePhotoPicker
            photos={form.photos}
            onChange={(next) => set("photos", next)}
            invalid={showFieldErrors && photosMissing}
          />
          {showFieldErrors && photosMissing && (
            <p className="mt-[6px] text-[11.5px] text-danger!">
              Required — add at least one photo before saving.
            </p>
          )}

          <div className={CHECKBOX_ROW}>
            {(["hasFloodlights", "hasChangingRooms", "hasParking", "hasRefreshments"] as const).map((k) => (
              <label key={k} className={CHECK_LABEL}>
                <input type="checkbox" checked={form[k] as boolean} onChange={(e) => set(k, e.target.checked)} />
                {k.replace("has", "")}
              </label>
            ))}
          </div>
          {error && <div className={FORM_ERROR}>{error}</div>}
          <div className={MODAL_ACTIONS}>
            <button className={ACTION_BTN} type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="submit" disabled={saving}>
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Venue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Venues() {
  const { onOpenDetail } = useDashboard();
  const [modalTurf, setModalTurf]   = useState<Turf | null | "new">(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "discontinued">("all");
  // Only to turn a stored metro slug back into its display label. A slug with no
  // entry here is a derived metro — a city nobody has registered yet.
  const [cityOptions, setCityOptions] = useState<MetroGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/turfs/city-options`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
        const data = await res.json();
        if (!cancelled && data.success) setCityOptions(data.data.metros || []);
      } catch { /* falls back to showing the raw slug */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const { data: listBody, loading, error, refresh } = useAdminFetch<{ data?: Turf[] }>(
    "/turfs/admin/all",
    { errorMessage: "Failed to load turfs." },
  );
  // Stable identity, so the filter memo below re-runs only on a new response.
  const turfs = useMemo(() => listBody?.data ?? [], [listBody]);

  const adminAction = async (url: string, method = "PATCH") => {
    setActionLoading(url);
    try { await fetch(`${API_BASE}${url}`, { method, headers: { Authorization: `Bearer ${getAdminToken()}` } }); refresh(); }
    finally { setActionLoading(null); }
  };

  // Summary (over all venues) + filtered/sorted view (busiest venues first)
  const activeCount   = turfs.filter((t) => t.isActive).length;
  const totalGames    = turfs.reduce((s, t) => s + (t.totalGamesHosted || 0), 0);
  const filtered = useMemo(
    () =>
      turfs
        .filter((t) => {
          const q = search.trim().toLowerCase();
          const matchesSearch = !q || [t.name, t.address.area, t.address.city, t.address.state].join(" ").toLowerCase().includes(q);
          const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? t.isActive : !t.isActive);
          return matchesSearch && matchesStatus;
        })
        .sort((a, b) => (b.totalGamesHosted || 0) - (a.totalGamesHosted || 0)),
    [turfs, search, statusFilter],
  );

  // The endpoint hands back every venue at once, so the page is sliced here.
  const pager = useClientPagination(filtered, { defaultLimit: 25 });
  useResetPageOnFilterChange(pager.resetPage, [search, statusFilter]);

  return (
    <>
      <div className={SECTION_HEAD}>
        <div>
          <div className={SECTION_TITLE}>Venues &amp; Turfs</div>
          <div className={SECTION_SUB}>
            {loading ? "Loading…" : (search || statusFilter !== "all" ? `${filtered.length} of ${turfs.length} venues` : `${turfs.length} registered venues`)}
          </div>
        </div>
        <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button" onClick={() => setModalTurf("new")}>+ Add Venue</button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className={STATS_GRID}>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Venues</div><div className={STAT_VALUE}>{turfs.length}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Registered turfs</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Active</div><div className={STAT_VALUE}>{activeCount}</div><div className={`${STAT_DELTA} ${UP}`}>Open for games</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Discontinued</div><div className={STAT_VALUE}>{turfs.length - activeCount}</div><div className={`${STAT_DELTA} ${DOWN}`}>Not in use</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Games Hosted</div><div className={`${STAT_VALUE} text-warning!`}>{totalGames}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Across all venues</div></div>
        </div>
      )}

      {/* Filters */}
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search venue, area, city, state…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "discontinued")}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading ? (
        <div className={LOADING_STATE}>Loading venues…</div>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead><tr><th>Venue</th><th>Area</th><th>City</th><th>Browsed under</th><th>State</th><th>Surface</th><th>Pitches</th><th>Floodlights</th><th>Verified</th><th>Status</th><th>Games</th><th>Actions</th></tr></thead>
            <tbody>
              {pager.rows.length === 0 && <tr><td colSpan={12} className="p-8! text-center text-muted!">{turfs.length === 0 ? "No venues yet." : "No venues match the current filters."}</td></tr>}
              {pager.rows.map((t) => {
                const busy = actionLoading !== null;
                return (
                  <tr key={t._id} style={!t.isActive ? { opacity: 0.62 } : undefined}>
                    <td className="font-medium">{t.name}</td>
                    <td>{t.address.area}</td>
                    <td>{t.address.city}</td>
                    {/* The city players actually browse by. A venue showing "—"
                        predates the metro mapping and will not appear in any
                        city-filtered list — run scripts/migrate_turf_metro.js. */}
                    <td>
                      {t.metro
                        ? <span className={`${BADGE} ${metroLabelFor(t.metro, cityOptions) ? BADGE_GRAY : BADGE_AMBER}`}>
                            {metroLabelFor(t.metro, cityOptions) || t.metro}
                          </span>
                        : <span className={`${BADGE} ${BADGE_RED}`}>Unmapped</span>}
                    </td>
                    <td>{t.address.state}</td>
                    <td><span className={`${BADGE} ${BADGE_GRAY}`}>{surfaceLabel(t.surfaceType)}</span></td>
                    <td>{t.numberOfPitches}</td>
                    <td><span className={`${BADGE} ${t.hasFloodlights ? BADGE_GREEN : BADGE_GRAY}`}>{t.hasFloodlights ? "Yes" : "No"}</span></td>
                    <td><span className={`${BADGE} ${t.isVerified ? BADGE_GREEN : BADGE_AMBER}`}>{t.isVerified ? "Verified" : "Pending"}</span></td>
                    <td><span className={`${BADGE} ${t.isActive ? BADGE_GREEN : BADGE_RED}`}>{t.isActive ? "Active" : "Discontinued"}</span></td>
                    <td>
                      <span className={`inline-block min-w-[30px] rounded-md px-[9px] py-[3px] text-center text-[13px] font-bold ${(t.totalGamesHosted || 0) > 0 ? "bg-warning text-[#0b1114]" : "bg-[rgba(255,255,255,0.05)] text-muted"}`}>{t.totalGamesHosted || 0}</span>
                    </td>
                    <td>
                      <div className={ACTIONS}>
                        <button className={ACTION_BTN} type="button" onClick={() => setModalTurf(t)}>Edit</button>
                        {!t.isVerified && <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/verify`)}>Verify</button>}
                        {t.isActive
                          ? <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/discontinue`)}>Discontinue</button>
                          : <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/reactivate`)}>Reactivate</button>
                        }
                        <button className={ACTION_BTN} type="button" onClick={() => onOpenDetail(t.name)}>View</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <Pagination
          page={pager.page}
          limit={pager.limit}
          total={pager.total}
          onPageChange={pager.setPage}
          onLimitChange={pager.setLimit}
          label="venues"
        />
      )}

      {modalTurf !== null && (
        <TurfModal initial={modalTurf === "new" ? null : modalTurf} onClose={() => setModalTurf(null)} onSaved={() => { setModalTurf(null); refresh(); }} />
      )}
    </>
  );
}
