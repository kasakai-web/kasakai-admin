/* GET /admin/analytics and /admin/analytics/games — the shapes
   admin.analytics.controller.js returns. Percentages are 0–100 with one decimal,
   or null where the base was empty. There is no average fill anywhere: how games
   went is a COUNT of games that struggled (`under*` — played under the fill line,
   or cancelled for any reason) out of those played or cancelled (`judged`), plus
   the median / 25th percentile fill of the `filled` games that have one. */

export type AreaStatus = "good" | "watch" | "concern" | "insufficient";
export type Severity = "good" | "watch" | "concern" | "info";

/** Which evidence block a finding points at — the panel scrolls to it. */
export type EvidenceSection =
  | "daily" | "monthly" | "status" | "fill" | "metros" | "venues"
  | "organisers" | "slots" | "upcoming";

/** A drill-down filter — the games one number is made of. */
export type Slice = {
  day?: string;
  month?: string;
  weekday?: number;
  daypart?: string;
  metroKey?: string;
  turf?: string;
  organiser?: string;
  format?: string;
  visibility?: string;
  bucket?: string;
  /** Fill bucket as the game stood 24 hours before kick-off. */
  bucket24?: string;
  status?: string;
  under?: boolean;
  upcoming?: boolean;
  atRisk?: boolean;
};

export type Area = {
  key: string;
  title: string;
  status: AreaStatus;
  verdict?: string;
  figure: number | null;
  figureLabel: string | null;
  figureUnit?: "%";
  change: { value: number; unit: "%" | "pp"; against: string; better: "higher" | "lower" } | null;
  summary: string;
};

export type PlayerRef = { id: string; name: string };

/** One ranked finding. `S` is the topic's set of evidence blocks it can point at. */
export type Finding<S extends string = EvidenceSection> = {
  severity: Severity;
  section: S;
  title: string;
  detail: string;
  metric: { value: number; unit: string } | null;
  slice: Slice | null;
  sliceLabel: string | null;
  /** The players a finding is about — each opens their report. */
  players?: PlayerRef[];
  /** Its evidence is a list rather than a chart — "players": the unique-player lists. */
  list?: "players";
  /** Players topic: the list naming everyone it is about, pre-filtered to `tag`. */
  playerList?: { kind: PlayerListKind; tag?: string };
};
export type Insight = Finding<EvidenceSection>;

/** Struggled share and fill quantiles — carried by every group of games. */
export type FillStats = {
  /** Played or cancelled — the base of the struggled share. */
  judged: number;
  /** Struggled: played under the fill line, or cancelled (automatically or by the organiser). */
  underCount: number;
  underPct: number | null;
  /** Games with a final fill (played, or auto-cancelled) — what the quantiles cover. */
  filled: number;
  medianFillPct: number | null;
  p25FillPct: number | null;
};

export type BreakdownRow = FillStats & {
  label: string;
  games: number;
  completed: number;
  cancelled: number;
  autoCancelled: number;
  /** Played under the fill line — the struggled games that were not cancelled. */
  underCompleted: number;
  upcoming: number;
  seatsFilled: number;
  /** Waitlist joins on every game in the row, upcoming ones included. */
  waitlistEntries: number;
  cancellationRatePct: number | null;
  key?: string | null;
  id?: string;
  metro?: string | null;
  /** Venues only: the locality from the venue's address. */
  area?: string | null;
};

export type SlotRow = BreakdownRow & {
  weekday: number;
  daypart: "morning" | "afternoon" | "evening" | "night";
  fullGames: number;
};

export type MonthRow = BreakdownRow & { month: string };

/** One IST play day; days with no games are zeros, not gaps. */
export type DayRow = {
  day: string;
  games: number;
  completed: number;
  cancelled: number;
  autoCancelled: number;
  underCompleted: number;
  seatsSold: number;
};

export type FillBucket = { key: string; label: string; under: boolean; games: number };

export type CompactGames = FillStats & {
  run: number;
  completed: number;
  cancelled: number;
  decided: number;
  uniquePlayers: number;
};

export type GamesMetrics = {
  totals: {
    total: number; nonDraft: number; run: number; upcoming: number;
    completed: number; cancelled: number; autoCancelled: number; decided: number;
    cancellationRatePct: number | null; uniquePlayers: number; seatsFilled: number;
    byStatus: Record<string, number>;
  };
  fill: FillStats & {
    underCompleted: number;
    cancelled: number;
    autoCancelled: number;
    fullGames: number;
    waitlistEntries: number;
    /** The finished-game buckets, then "Cancelled by organiser" last. */
    buckets: FillBucket[];
    /** Finished games that existed 24h before kick-off and were not called off by then. */
    judged24: number;
    medianFill24Pct: number | null;
    buckets24: FillBucket[];
  };
  upcoming: { games: number; atRisk: number; atRiskSoon: number };
  daily: { days: DayRow[]; capped: boolean };
  monthly: MonthRow[];
  breakdowns: {
    metros: BreakdownRow[];
    venues: BreakdownRow[];
    organisers: BreakdownRow[];
    formats: BreakdownRow[];
    visibility: BreakdownRow[];
    slots: SlotRow[];
  };
};

export type AnalyticsData = {
  generatedAt: string;
  filters: {
    from: string | null; to: string | null; metro: string | null; metroLabel: string | null;
    turf: string | null; organiser: string | null;
  };
  conclusions: { headline: string; areas: Area[]; insights: Insight[] };
  comparison: {
    none: boolean;
    label: string;
    recentLabel: string;
    recent: { games: CompactGames; start: string; end: string };
    prior: { games: CompactGames; start: string; end: string };
  };
  games: GamesMetrics;
  /** The engine's thresholds — the page uses the same cuts it judges with. */
  thresholds?: { MIN_GAMES: number; UNDER_FILL_PCT: number };
};

export type AnalyticsResponse = { success: boolean; data?: AnalyticsData; message?: string };

export type DrillRow = {
  id: string;
  title: string;
  scheduledAt: string;
  venue: string | null;
  city: string | null;
  organiser: string | null;
  format: string | null;
  status: string;
  seats: number;
  totalSlots: number;
  minPlayers: number;
  fillPct: number | null;
  /** How full it was 24h before kick-off; null where there was no such moment. */
  fill24Pct: number | null;
  under: boolean;
  autoCancelled: boolean;
  upcoming: boolean;
  atRisk: boolean;
  cancelReason: string | null;
  waitlistEntries: number;
};

export type DrillResponse = {
  success: boolean;
  data?: { total: number; page: number; pages: number; limit: number; rows: DrillRow[] };
  message?: string;
};

/** GET /admin/analytics/unique-players. `tag` compares a player with the other window. */
export type UniquePlayer = {
  id: string | null;
  name: string;
  phone: string | null;
  games: number;
  lastGameAt: string | null;
  tag?: "new" | "returning" | "stopped";
};
export type UniquePlayersData =
  | { compare: true; label: string; recentLabel: string; recent: UniquePlayer[]; prior: UniquePlayer[] }
  | { compare: false; players: UniquePlayer[] };

/** What the page is narrowed to — the chips above the verdict. */
export type PageFilters = {
  metro: string;
  turf: { id: string; label: string } | null;
  organiser: { id: string; label: string } | null;
};

// ── GET /admin/analytics/players and /admin/analytics/players/:id ────────────
// admin.playerAnalytics.controller.js. Money is paise; percentages 0–100 or null.

export type PlayerSection = "signups" | "ratings" | "top" | "weekly";

/** Keys of LISTS in admin.playerAnalytics.controller.js. */
export type PlayerListKind =
  | "accounts" | "signups" | "activation" | "retention" | "active" | "firstGame"
  | "quiet" | "awaiting" | "rated" | "monthSignups" | "monthFirst" | "monthActive";

/** GET /admin/analytics/players/list */
export type PlayerListData = {
  kind: PlayerListKind;
  total: number;
  rows: {
    id: string; name: string; phone: string | null; joinedAt: string | null; verified: boolean;
    games: number; gamesInRange: number; firstGameAt: string | null; lastGameAt: string | null;
    conduct: number | null; tag: string | null;
  }[];
};

export type Conclusions<S extends string = EvidenceSection> = { headline: string; areas: Area[]; insights: Finding<S>[] };

export type PlayersOverview = {
  generatedAt: string;
  /** The page's range (null ends = open) and the trend windows in words. */
  window: { from: string | null; to: string | null; recentLabel: string; priorLabel: string; figureLabel: string };
  conclusions: Conclusions<PlayerSection>;
  totals: {
    players: number; verified: number; signups30: number; signupsPrior30: number;
    played: number; playedPct: number | null; eligible: number; activationPct: number | null;
    active30: number; activePrior30: number; repeatBase: number; repeatPct: number | null;
    /** Of repeatBase: back for a second game within 30 days of their first. */
    secondIn30Pct: number | null;
    medianDaysToFirstGame: number | null; rated: number; avgConduct: number | null; avgGameplay: number | null;
    payers: number; payersPct: number | null; topUpPaise: number; topUp30Paise: number; topUpPrior30Paise: number;
  };
  monthly: { month: string; signups: number; firstGames: number; active: number }[];
  /** Last 12 IST weeks (Monday start), oldest first; each names up to 50 of its first-timers. */
  weekly: { week: string; current: boolean; firstGames: number; players: { id: string; name: string; games: number }[] }[];
  gamesDistribution: { key: string; label: string; players: number }[];
  ratingDistribution: { key: string; label: string; players: number }[];
  topPlayers: {
    id: string; name: string; profileImage: string | null; games: number; lastPlayedAt: string | null;
    joinedAt: string | null; conduct: number | null; gameplay: number | null; topUpPaise: number;
  }[];
};

export type PlayerGameRow = {
  id: string; title: string; format: string | null; status: string | null; scheduledAt: string | null;
  venue: string | null; organiserName: string | null; feeInPaise: number;
  registered: boolean; attended: string; attendanceMarked: boolean; paymentStatus: string | null;
  amountPaidPaise: number; backedOut: boolean; backoutType: string | null; removed: boolean; optedOut: boolean;
  guestCount: number; passBenefitPaise: number; discountPaise: number;
  backoutFeeChargedPaise: number; backoutFeeReturned: boolean;
};

export type PlayerReportData = {
  generatedAt: string;
  conclusions: Conclusions<never>;
  profile: {
    id: string; name: string; phone: string; email: string | null; profileImage: string | null;
    isVerified: boolean; location: string | null; joinedAt: string | null; daysSinceJoined: number | null;
    referralCode: string | null; invitedCount: number;
    preferences: { positions: string[]; preferredFormat: string | null; skillLevel: string | null };
  };
  activity: {
    bookings: number; gamesPlayed: number; present: number; noShows: number; absent: number;
    attendancePct: number | null; backouts: number; optedOut: number; removed: number; cancelledOnThem: number;
    upcoming: number; guestsBrought: number; firstPlayedAt: string | null; lastPlayedAt: string | null;
    daysSinceLastGame: number | null; daysToFirstGame: number | null; gamesPerMonth: number | null; feedbackGiven: number;
  };
  money: {
    topUpPaise: number; topUps: number; lastTopUpAt: string | null; bonusPaise: number;
    adminCreditPaise: number; adminDebitPaise: number; directPaise: number; gameSpendPaise: number;
    refundPaise: number; backoutFeePaise: number; netGameSpendPaise: number; passPurchasePaise: number;
    discountSavedPaise: number; discountedGames: number; passCoveredPaise: number; passCoveredGames: number;
    balancePaise: number; lockedPaise: number;
  };
  passes: {
    id: string; name: string; code: string; source: string; status: string;
    activatesAt: string | null; expiresAt: string | null; pricePaidPaise: number; games: number;
    coveredPaise: number; netPaise: number; remainingGames: number | null; remainingPaise: number | null;
  }[];
  legacyPass: { label: string; startDate?: string | null; expiryDate?: string | null } | null;
  ratings: {
    conduct: number | null; gameplay: number | null; count: number;
    byOrganiser: { organiser: string; conduct: number | null; gameplay: number | null; gamesObserved: number; lastRatedAt: string | null }[];
    skill: { gameplay: number; confidence: number; sampleSize: number } | null;
    peer: { avg: number | null; count: number };
    given: { count: number; game: number | null; organiser: number | null; venue: number | null };
  };
  monthly: { month: string; games: number }[];
  favourites: Record<"venues" | "organisers" | "formats" | "slots", { label: string; games: number }[]>;
  games: PlayerGameRow[];
};

export type ApiResponse<T> = { success: boolean; data?: T; message?: string };
