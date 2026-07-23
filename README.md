# Kasa Kai — Admin Portal

Platform administration interface for Kasa Kai. Admins monitor and manage the entire platform: users, organisers, games, payments, venues, notifications, communities, feedback, disputes, and the standalone screening/streaming event business.

> **Port:** `3002`  
> **Audience:** Platform Admins only

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Key Screens & Routes](#key-screens--routes)
- [Authentication](#authentication)
- [Dashboard Sections](#dashboard-sections)
- [Screening Management](#screening-management)
- [Excel Exports](#excel-exports)
- [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2 |
| UI library | React | 19.2 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 · CSS Modules |
| Excel export | ExcelJS | 4.4 (styled exports with branded headers) |
| Excel parsing | SheetJS (xlsx) | 0.18 |
| Linter | ESLint + eslint-config-next | 9 / 16.2 |

---

## Features

### People management
- List, search, and filter all players
- List and manage organisers
- **Profile photos** shown in circular avatars (initial-letter fallback if missing); **click a photo to enlarge it** in a centered lightbox
- Player rating displayed as **separate Conduct & Gameplay columns** — each the real average of organiser-submitted ratings, "—" when unrated (no default values)
- View profile details, game history, wallet balance per user
- Deactivate / reactivate accounts
- Performance: All Users / Organisers use a short client-side cache + lazy-loaded images; backend uses MongoDB aggregations

### Game management
- View all games across all organisers (status, registrations, revenue)
- Filter by status, date, organiser, venue
- View detailed registration and waitlist per game

### Payments & finance
- View all payment transactions across the platform
- Player wallets + manual wallet adjustment (in-app credit/debit with note)
- Per-game financial breakdown (registrations, refunds, net revenue)
- Cross-platform finance overview
- **Wallet Recharge Offers** — panel at the top of Player Wallets to set a flat bonus per recharge tier (₹500–999, ₹1000–1499, ₹1500–1999, ₹2000+), with an enable/disable toggle. Values persist and are editable; bonus auto-credits to the in-app wallet on recharge (never a bank account)

### Feedback & disputes
- View all player feedback and ratings — two tabs: **Player → Platform** and **Organiser → Players**
- Filter feedback by organiser, turf, **game (name + date, so same-named games on different dates stay distinct)**, and date range
- Manage reported disputes

### Notifications
- Send platform-wide or targeted notifications to players/organisers
- View notification history

### Communities & venues
- Manage community groups
- CRUD on turfs / venues

### Screening / streaming events
- Full CRUD for screening events (create, edit, publish, cancel)
- View and manage guest lists per event
- Analytics: tickets sold, revenue, attendance
- QR scan attendance tracking
- Finance overview for the streaming business

### Excel exports
- Styled XLSX exports with branded headers, column formatting, and totals
- Available for: player lists, payment reports, game summaries, screening finance

---

## Architecture

```
admin-portal/
└── src/
    ├── app/                               # Next.js 16 App Router
    │   ├── layout.tsx                     # Root layout
    │   ├── page.tsx                       # Redirect to /dashboard or /login
    │   ├── login/                         # Admin login
    │   └── dashboard/
    │       ├── layout.tsx                 # Dashboard shell (sidebar + topbar)
    │       ├── page.tsx                   # Dashboard entry
    │       └── streaming/                 # Streaming / screening sub-section
    │           ├── [id]/                  # Screening event detail
    │           ├── create-new-event/      # Create screening event wizard
    │           ├── finance/               # Streaming finance
    │           └── guests/                # Guest list management
    ├── components/
    │   └── admin/
    │       ├── admin-login.tsx            # Login form
    │       ├── dashboard-shell.tsx        # Layout wrapper (sidebar + content area)
    │       ├── icon.tsx
    │       └── dashboard/
    │           ├── constants.ts           # Section definitions and navigation config
    │           ├── content-sections.tsx   # Section-by-section content renderer
    │           ├── detail-panel.tsx       # Right-side detail panel
    │           ├── sidebar.tsx            # Navigation sidebar
    │           ├── topbar.tsx             # Top bar with search and user info
    │           ├── notifications/         # Notification send and history UI
    │           └── screening/             # Full screening admin UI
    │               ├── AnalyticsPage.tsx
    │               ├── AttendeesPage.tsx
    │               ├── CreateForm.tsx
    │               ├── EventCard.tsx
    │               ├── ManagePage.tsx
    │               └── ViewPage.tsx
    ├── context/                           # React context providers (auth, etc.)
    ├── lib/                               # Utility functions
    └── types/                             # Shared TypeScript type definitions
```

---

## Dashboard Sections

The admin dashboard is a single-page app with a sidebar for navigation. Each section is rendered inside the content area:

| Section key | Title | What it contains |
|---|---|---|
| `dashboard` | Dashboard | Platform overview stats (total users, games, revenue) |
| `users` | All Users | Player list — search, filter, view profile, deactivate |
| `organisers` | Organisers | Organiser list — manage accounts, view game history |
| `games` | Games & Events | All games — status, registrations, revenue per game |
| `payments` | Payments | All payment transactions across the platform |
| `finance` | Finance | Revenue summaries, refund totals, net earnings |
| `notifications` | Notifications | Send bulk or targeted notifications |
| `feedback` | Feedback | All player ratings and comments |
| `disputes` | Disputes | Flagged issues between players and organisers |
| `communities` | Communities | Community group management |
| `venues` | Venues & Turfs | Venue CRUD |
| `scr-events` | Screening Events | Create, edit, publish, cancel screening events |
| `scr-guests` | Guest List | Attendees per screening event; check-in status |
| `scr-finance` | Streaming Finance | Revenue from ticket sales; per-event breakdown |

---

## Directory Structure (key files)

```
src/components/admin/dashboard/constants.ts
  — Defines dashboardSections[], sectionTitles{}, sectionPaths{}
  — Import these to keep sidebar and routing consistent

src/components/admin/dashboard/content-sections.tsx
  — Master renderer: maps section key → React component
  — Add new sections here

src/components/admin/dashboard/screening/
  ├── CreateForm.tsx      # 5-step wizard: details → images → schedule → pricing → publish
  ├── ManagePage.tsx      # Event list with status filters
  ├── ViewPage.tsx        # Event detail + registration list
  ├── AttendeesPage.tsx   # Attendee check-in / QR scan status
  └── AnalyticsPage.tsx   # Tickets sold, revenue, check-in rate
```

---

## Environment Variables

Create `admin-portal/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

In production:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.kasakai.in/api/v1
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- Backend server running on port 5000 (see `kasakai-backend/README.md`)
- An admin account in the database (create with `node scripts/createAdmin.js` in the backend)

### Install

```bash
cd admin-portal
npm install
```

### Run in development

```bash
npm run dev      # Binds to port 3002
```

Open [http://localhost:3002](http://localhost:3002).

### Build for production

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Key Screens & Routes

| Route | Description |
|---|---|
| `/` | Redirect to `/dashboard` or `/login` |
| `/login` | Admin login (email + password) |
| `/dashboard` | Main admin dashboard |
| `/dashboard/streaming` | Screening event list |
| `/dashboard/streaming/create-new-event` | 5-step screening event creation wizard |
| `/dashboard/streaming/[id]` | Single screening event detail and management |
| `/dashboard/streaming/finance` | Streaming revenue and finance overview |
| `/dashboard/streaming/guests` | Platform-wide guest list management |

---

## Authentication

### Login

1. Navigate to `/login`
2. Enter admin email and password
3. JWT returned → stored in `localStorage` as `authToken`

Admin accounts are created via the backend script:

```bash
cd kasakai-backend
node scripts/createAdmin.js
# or
node scripts/seed-admin.js
```

### JWT role check

The admin portal reads the JWT from `localStorage` on every navigation. If `role` is not `"admin"`, the user is redirected to `/login`. Admin JWTs are issued by the same backend auth flow but with `role: "admin"` in the payload.

### Password reset

Use the backend script to reset an admin password directly in the database:

```bash
cd kasakai-backend
node scripts/reset-admin-password.js
```

---

## Screening Management

The screening module is a self-contained business unit within the platform for cinema-style or live-streaming events.

### Creating a screening event (5-step wizard)

1. **Details** — title, description, venue, date/time, category
2. **Images** — cover photo upload (JPEG/PNG/WebP, max 2 MB via backend Multer)
3. **Schedule** — doors open time, show time, end time
4. **Pricing** — ticket tiers (name, price, quantity per tier)
5. **Publish** — review and publish (sets status to `open`)

### Managing an event

- **View** — see registration stats, revenue, attendee list
- **Attendees** — check-in status from QR door scan; manual override available
- **Analytics** — tickets sold vs capacity, revenue by tier, check-in rate
- **Cancel** — removes event, triggers refunds

### Guest list

The `scr-guests` section gives a platform-wide view of all ticket holders across all events, with search and export.

---

## Excel Exports

The admin portal generates styled XLSX files using **ExcelJS** (not the legacy SpreadsheetML format):

- Branded header row with platform colours
- Auto-width columns
- Formatted number and currency cells
- Summary totals row at the bottom

Available exports:
- Player list
- Payment / transaction report
- Game financial summary
- Screening event finance report

To trigger an export, navigate to the relevant section and click the **Export** button. The file downloads directly in the browser.

---

## Deployment

### Environment (production)

```env
NEXT_PUBLIC_API_BASE_URL=https://api.kasakai.in/api/v1
```

### Build

```bash
npm run build
npm start
```

### Access control

The admin portal should **never be publicly accessible**. Recommended options:
- Deploy to an internal network or VPN-only subdomain
- Add IP allowlisting at the CDN/load-balancer level (e.g. Azure Front Door custom rules)
- Use Azure AD / OAuth in front of the portal for an additional auth layer

### CORS

The production backend `CORS_ORIGIN` must include the deployed admin portal URL, e.g. `https://admin.kasakai.in`.

### Creating the first admin account

Run this once after first deployment:

```bash
cd kasakai-backend
node scripts/createAdmin.js
```

Follow the prompts to set the email and password for the initial admin account.