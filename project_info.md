# Rentitout — Complete Project Audit

**Audit Date:** 2026-10-05

**Audit Purpose:**
Complete technical assessment of the existing Rentitout project before implementing missing functionality and preparing it for campus-placement demonstration.

---

## TABLE OF CONTENTS

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Project Tree](#2-project-tree)
3. [What Rentitout Currently Does](#3-what-rentitout-currently-does)
4. [User Roles](#4-user-roles)
5. [Authentication & Security Audit](#5-authentication--security-audit)
6. [Database Audit](#6-database-audit)
7. [API Audit](#7-api-audit)
8. [Frontend Audit](#8-frontend-audit)
9. [Rental Marketplace Workflow Audit](#9-rental-marketplace-workflow-audit)
10. [Active User / Realistic Data Audit](#10-active-user--realistic-data-audit)
11. [Admin Panel Audit](#11-admin-panel-audit)
12. [Image / File Upload Audit](#12-image--file-upload-audit)
13. [Search & Discovery Audit](#13-search--discovery-audit)
14. [Booking / Transaction Audit](#14-booking--transaction-audit)
15. [Notification & Communication Audit](#15-notification--communication-audit)
16. [Payment Audit](#16-payment-audit)
17. [Error & Edge Case Audit](#17-error--edge-case-audit)
18. [Performance Audit](#18-performance-audit)
19. [Mobile / Responsive Audit](#19-mobile--responsive-audit)
20. [Deployment Readiness](#20-deployment-readiness)
21. [Testing Audit](#21-testing-audit)
22. [Code Quality Audit](#22-code-quality-audit)
23. [Placement Project Quality Assessment](#23-placement-project-quality-assessment)
24. [Missing Features — Prioritized List](#24-missing-features--prioritized-list)
25. [Final Recommended Architecture](#25-final-recommended-architecture)
26. [Implementation Roadmap](#26-implementation-roadmap)
27. [Definition of Done](#27-rentitout--definition-of-done)
28. [Executive Summary](#executive-summary)

---

## 1. Tech Stack Overview

| Concern | Technology | Evidence |
|---|---|---|
| Frontend Framework | React 19 (TypeScript) | `package.json` — `"react": "^19.2.4"` |
| Build Tool | Vite 7 | `package.json` — `"vite": "^7.3.1"`, `vite.config.ts` |
| Language | TypeScript ~5.9 | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) | `package.json`, `src/index.css` — `@import "tailwindcss"` |
| UI Component Library | Radix UI primitives wrapped as shadcn/ui components | `components.json`, `src/components/ui/` (55 components) |
| State Management | Zustand 5 with `persist` middleware | `src/store/index.ts` |
| Routing | React Router DOM v7 | `src/App.tsx` |
| Backend / BaaS | Supabase (PostgreSQL + Auth + Storage + Realtime) | `src/lib/supabase.ts`, `.env` |
| Database | PostgreSQL (hosted on Supabase) | `supabase/migrations/` |
| ORM / Query | Supabase JS Client SDK (no ORM; direct PostgREST queries) | `src/lib/supabase.ts` |
| Authentication | Supabase Auth — Email + Password | `src/pages/Login.tsx`, `src/pages/Register.tsx` |
| Authorization | Supabase Row Level Security (RLS) policies | All migration files |
| Storage | Supabase Storage bucket `listing-images` | `src/pages/ListItem.tsx` lines 115–120 |
| Forms | React Hook Form + Zod validation | `src/pages/Register.tsx`, `src/pages/ListItem.tsx` |
| Icons | Lucide React | throughout all components |
| Notifications (UI) | Sonner toast library | `src/App.tsx` — `<Toaster />` |
| Fonts | Google Fonts: Sora, Inter, JetBrains Mono | `src/index.css` line 1 |
| Image Compression | Canvas API (custom utility) | `src/lib/utils.ts` — `compressImage()` |
| Geocoding | OpenStreetMap Nominatim (free) | `src/pages/ListItem.tsx` lines 96–106 |
| Real-time / Presence | Supabase Realtime channels | `src/pages/Messages.tsx` lines 63–90 |
| Date Utilities | date-fns | `src/lib/utils.ts` |
| Drag & Drop (upload) | react-dropzone | `src/pages/ListItem.tsx` |
| Full-Text Search | PostgreSQL `tsvector` + `plainto_tsquery` via Supabase RPC | `supabase/migrations/20260627110000_upgrades.sql` |
| Distance Sorting | Haversine formula in PostgreSQL function | same migration |
| Testing | Vitest + @testing-library/react + jsdom | `vitest.config.ts`, `src/components/__tests__/`, `src/lib/__tests__/` |
| Package Manager | npm | `package-lock.json` |
| Deployment Config | Vercel (SPA rewrite rule) | `vercel.json` |
| Payment | **NONE** | No evidence in any source file |
| Email/SMS Notifications | **NONE** (relies on Supabase built-in auth emails only) | No evidence in any source file |
| Maps / Embedded Map | **NONE** (coordinates stored but no map rendered) | No map component or library found |
| Admin Panel | **NONE** | No admin route, no admin role check, no admin table |
| OAuth / Social Login | **NONE** | Only email+password in auth files |
| Dark Mode | Implemented via `next-themes` + CSS variables | `src/components/theme-provider.tsx`, `src/index.css` |

---

## 2. Project Tree

```text
rentitout/                          ← Project root
├── .bolt/                          ← Bolt.new scaffold metadata (irrelevant to runtime)
├── .env                            ← Real Supabase URL + anon key (NEVER commit)
├── .env.example                    ← Template for env vars
├── .gitignore                      ← Standard Vite/Node gitignore
├── brain.md                        ← Developer/AI agent notes (project reference doc)
├── components.json                 ← shadcn/ui config (path aliases, style settings)
├── index.html                      ← Vite entry HTML (title: "RentItOut - Peer-to-Peer Rental Marketplace")
├── package.json                    ← Dependencies & scripts
├── vercel.json                     ← SPA rewrite: all paths → /index.html
├── vite.config.ts                  ← Vite config (React plugin, Tailwind plugin, @ alias)
├── vitest.config.ts                ← Test config (jsdom environment)
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│
├── public/                         ← Static assets (Vite default SVG logo only)
│
├── supabase/
│   └── migrations/
│       ├── 20260626165603_rentitout_schema.sql      ← V1: Full schema + seed (3 fake users, 10 listings)
│       ├── 20260626172457_rentitout_schema_v3.sql   ← V2: Duplicate/refinement of V1 schema
│       ├── 20260626172752_fix_listings_owner_fk.sql ← V3: FK fix on listings.owner_id
│       ├── 20260626173112_rentitout_schema.sql      ← V4: Schema + seed using real test user
│       └── 20260627110000_upgrades.sql              ← V5: lat/lng coords, FTS tsvector index,
│                                                         search_listings_advanced() RPC,
│                                                         Haversine distance function,
│                                                         tightened messages RLS
│
├── dist/                           ← Production build output (generated; not in git)
│
└── src/
    ├── main.tsx                    ← React DOM root render, mounts <App />
    ├── App.tsx                     ← All routes defined here; useAuth() initialized once
    ├── index.css                   ← Tailwind v4 import, CSS custom properties (design tokens),
    │                                  Google Fonts import, animation keyframes, utility classes
    │
    ├── lib/
    │   ├── supabase.ts             ← Supabase client, TypeScript types for all DB tables,
    │   │                              CATEGORIES/CONDITIONS constants, getConversationId()
    │   ├── utils.ts                ← cn(), formatPrice (INR), formatDate, getDaysBetween,
    │   │                              getCategoryIcon/Color, getConditionColor, getInitials,
    │   │                              truncate, timeAgo, compressImage()
    │   └── __tests__/
    │       └── utils.test.ts       ← 4 unit tests: getDaysBetween, formatPrice, getInitials
    │
    ├── hooks/
    │   ├── useAuth.ts              ← Singleton Supabase session init; populates Zustand store
    │   └── use-mobile.ts           ← Window width breakpoint hook (768px)
    │
    ├── store/
    │   └── index.ts                ← Zustand stores:
    │                                  - useAuthStore: user, profile, session, loading, signOut, refreshProfile
    │                                  - useUIStore: searchQuery, mobileMenuOpen
    │
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx  ← Redirects unauthenticated users to /login
    │   ├── layout/
    │   │   ├── Navbar.tsx          ← Fixed header; transparent on hero, solid on scroll;
    │   │   │                          auth-aware (login/register vs. user avatar dropdown)
    │   │   └── Footer.tsx          ← Static footer with nav links
    │   ├── listings/
    │   │   ├── ListingCard.tsx     ← Card UI with image, category badge, wishlist button,
    │   │   │                          price, location, owner avatar, rating
    │   │   └── ListingCardSkeleton.tsx ← Loading placeholder (used nowhere currently)
    │   ├── shared/
    │   │   ├── EmptyState.tsx      ← Generic empty state with icon, title, description, action
    │   │   ├── ScrollToTop.tsx     ← Scrolls window to top on route change
    │   │   ├── StarRating.tsx      ← Renders 1–5 filled stars
    │   │   └── UserAvatar.tsx      ← Avatar with initials fallback
    │   ├── ui/                     ← 55 shadcn/Radix UI primitive components
    │   │                              (button, input, select, dialog, dropdown, slider, etc.)
    │   ├── mode-toggle.tsx         ← Dark/light mode toggle (not wired into Navbar)
    │   └── theme-provider.tsx      ← next-themes ThemeProvider
    │
    └── pages/
        ├── Home.tsx                ← Landing page: hero + search, stats (hardcoded), how-it-works,
        │                              category pills, featured listings (real DB), trust section, CTA
        ├── Browse.tsx              ← Search + filter + sort + grid/list view;
        │                              calls search_listings_advanced() RPC
        ├── ListingDetail.tsx       ← Single listing: images carousel, description, owner card,
        │                              reviews, similar items, booking widget (date picker + submit)
        ├── ListItem.tsx            ← 3-step wizard: details → pricing → photos+location;
        │                              uploads to Supabase Storage, geocodes with Nominatim
        ├── EditListing.tsx         ← Edit form for existing listing (owner-only via owner_id check)
        ├── Messages.tsx            ← Conversations sidebar + chat pane;
        │                              Supabase Realtime presence for typing indicator
        ├── Login.tsx               ← Email+password login; redirect-after-login; demo credentials shown
        ├── Register.tsx            ← Full registration with Zod schema, password strength meter
        ├── ForgotPassword.tsx      ← Sends Supabase reset-password email
        ├── Verified.tsx            ← Post-email-verification landing; auto-redirects to dashboard
        ├── About.tsx               ← Static informational page
        └── Dashboard/
            ├── index.tsx           ← Dashboard layout with sidebar nav + pending request badge
            ├── Overview.tsx        ← Stats cards (listings, active rentals, pending requests, earned)
            │                          + recent booking activity feed
            ├── MyListings.tsx      ← Owner's listings with toggle active/pause + delete
            ├── MyRentals.tsx       ← Renter's booking history with status filter tabs + cancel
            ├── Requests.tsx        ← Incoming booking requests; Accept / Decline / Mark Completed
            └── Profile.tsx         ← Edit name, city, phone, bio; avatar change UI (non-functional)
```

---

## 3. What Rentitout Currently Does

### A. WORKING FEATURES

**User Registration**
- Evidence: `src/pages/Register.tsx` — calls `supabase.auth.signUp()`, passes `name` + `city` in metadata
- Zod validation schema enforces name ≥ 2 chars, email format, city ≥ 2 chars, password ≥ 8 chars, password confirmation match, terms checkbox
- Password strength meter component implemented
- On success: if session returned immediately → navigate to dashboard; otherwise → prompt email verification
- Auto-creates profile via DB trigger `handle_new_user()` (confirmed in all migration files)

**User Login**
- Evidence: `src/pages/Login.tsx` — calls `supabase.auth.signInWithPassword()`
- Handles "Invalid login credentials" and email-not-confirmed error messages
- Redirects to original protected route after login (`location.state.from`)
- Demo credentials hardcoded in UI (a test user from `.env`)

**Logout**
- Evidence: `src/store/index.ts` — `signOut()` calls `supabase.auth.signOut()`, clears store
- Wired in `Navbar.tsx` dropdown and `Dashboard/index.tsx` sidebar

**Session Persistence**
- Evidence: `src/store/index.ts` — Zustand `persist` middleware stores `user` + `profile` in `localStorage` under key `auth-storage`
- `src/hooks/useAuth.ts` — Singleton init pattern with module-level `initialized` flag; subscribes to `onAuthStateChange`

**Protected Routes**
- Evidence: `src/components/auth/ProtectedRoute.tsx` — reads from Zustand store, redirects to `/login` if no user

**Password Reset (Request)**
- Evidence: `src/pages/ForgotPassword.tsx` — calls `supabase.auth.resetPasswordForEmail()`
- Redirect URL points to `/reset-password` — **page does not exist** (PARTIALLY WORKING)

**Browse / Search Listings**
- Evidence: `src/pages/Browse.tsx` — calls `supabase.rpc('search_listings_advanced', {...})`
- Filters: category (multi-select checkboxes), price range (slider), condition, city (text)
- Sort: newest, price asc/desc, nearest (Haversine distance via geolocation)
- Grid/list view toggle
- Search query passed to PostgreSQL FTS (`tsvector`) — real full-text search

**View Listing Detail**
- Evidence: `src/pages/ListingDetail.tsx` — fetches listing + owner + reviews + similar items in parallel
- Image carousel with thumbnails
- Owner card showing name, city, verified badge, bio, member since
- Reviews displayed with star rating, timestamp
- Date picker for booking request

**Submit Booking Request**
- Evidence: `src/pages/ListingDetail.tsx` `handleBooking()` — inserts into `bookings` table
- Validates: user logged in, dates selected, user ≠ owner
- Calculates `total_days` and `total_price` client-side

**Manage Listings (Owner)**
- Evidence: `src/pages/Dashboard/MyListings.tsx` — fetches owner's listings, toggle `is_active`, delete
- Edit: `src/pages/EditListing.tsx` — owner_id ownership check before populating form

**Create Listing (3-step wizard)**
- Evidence: `src/pages/ListItem.tsx` — 3 steps: details, pricing, photos+location
- Image upload to Supabase Storage bucket `listing-images`
- Image compression via `compressImage()` (Canvas → WebP)
- Geocoding via Nominatim (free, no API key needed)
- Stores `lat`, `lng` for distance sorting

**Incoming Requests (Owner)**
- Evidence: `src/pages/Dashboard/Requests.tsx` — fetches bookings for owner's listings
- Accept / Decline buttons call `supabase.from('bookings').update({ status })`
- Mark as Completed button for accepted bookings
- Filter tabs: All / Pending / Accepted / Completed / Declined

**My Rentals (Renter)**
- Evidence: `src/pages/Dashboard/MyRentals.tsx` — fetches bookings where `renter_id = user.id`
- Status filter tabs, Cancel Request for PENDING bookings
- "Leave Review" button for COMPLETED (navigates to listing page — no modal)

**Dashboard Overview**
- Evidence: `src/pages/Dashboard/Overview.tsx` — real Supabase queries for listing count, active rentals, pending requests, total earned
- Recent activity feed showing incoming booking requests

**Profile Edit**
- Evidence: `src/pages/Dashboard/Profile.tsx` — updates `name`, `city`, `phone`, `bio` in profiles table
- Calls `refreshProfile()` on success

**Wishlist (Add/Remove)**
- Evidence: `src/components/listings/ListingCard.tsx` — heart button calls `supabase.from('wishlists').insert/delete`
- State is local to card; no dedicated wishlist page

**Messaging**
- Evidence: `src/pages/Messages.tsx` — full messaging system
- Conversation list loaded from messages table grouped by `conversation_id`
- Send messages, load conversation on click
- Supabase Realtime Presence channel for typing indicator (dots animation)
- "Message Owner" from listing detail page navigates to `/messages?with=&listing=`

**Pending Request Badge**
- Evidence: `src/pages/Dashboard/index.tsx` — loads pending booking count, displays badge on Requests nav item

---

### B. PARTIALLY WORKING FEATURES

**Password Reset (Complete Flow)**
- Status: PARTIALLY WORKING
- `ForgotPassword.tsx` sends email correctly
- BUT: redirect URL is `/reset-password` — **this page does not exist** in `App.tsx`
- User receives email link but lands on 404

**Avatar Upload**
- Status: PARTIALLY WORKING (UI only)
- `Profile.tsx` shows a camera icon button over the avatar
- Button has no `onClick` handler and no upload logic
- `avatar_url` field exists in DB; never updated via UI

**Email Verification Flow**
- Status: PARTIALLY WORKING
- Supabase sends verification email
- `/verified` page exists and looks good
- SMTP is not configured by default in Supabase — emails may not send without configuring custom SMTP in Supabase dashboard

**Reviews**
- Status: PARTIALLY WORKING
- Reviews are displayed on listing detail page (read works)
- "Leave Review" button in MyRentals navigates to listing detail page
- There is NO review submission form on listing detail or anywhere else
- `reviews` table exists with correct schema, but no INSERT UI exists

**Wishlist**
- Status: PARTIALLY WORKING
- Add/remove works from ListingCard
- No dedicated `/wishlist` page exists
- Wishlist state is not persisted across page loads (card re-renders fresh)
- No way to view all wishlisted items

**Messages — Real-time**
- Status: PARTIALLY WORKING
- Messages sent/received work on send
- Real-time new message delivery requires page to be open; no `supabase.channel().on('postgres_changes')` subscription for new incoming messages — user must reload to see new messages from the other side
- Typing indicator (presence) works correctly

**Dark Mode**
- Status: PARTIALLY WORKING
- `ThemeProvider` and `mode-toggle.tsx` component exist
- Dark mode CSS variables defined in `index.css`
- The toggle button is **not wired into the Navbar** — unreachable by users

---

### C. UI-ONLY / MOCK FEATURES

**Homepage Statistics ("2,400+ Items Listed", "1,800+ Renters", "50+ Cities")**
- Evidence: `src/pages/Home.tsx` lines 17–21 — `const STATS = [...]` hardcoded array
- These numbers are completely fabricated; not pulled from DB

**About Page Stats ("1,800+ verified users", "50+ cities")**
- Evidence: `src/pages/About.tsx` lines 32–33 — hardcoded strings
- No connection to any real data

**"Available" Badge on Listing Cards**
- Evidence: `src/components/listings/ListingCard.tsx` lines 88–92
- Always shows "Available" regardless of actual booking conflicts or owner's `is_active` status
- No availability check against bookings table

**"Verified" Badge on Profiles**
- Evidence: `src/lib/supabase.ts` — `is_verified: boolean` field exists in DB
- `Profile.tsx` displays it if true, `ListingDetail.tsx` shows checkmark if true
- There is NO mechanism to set `is_verified = true` — no admin action, no verification flow

**"Remember me" Checkbox on Login**
- Evidence: `src/pages/Login.tsx` line 126 — `<input type="checkbox" />` with no handler
- Purely decorative; does nothing

**Share Button on Listing Detail**
- Evidence: `src/pages/ListingDetail.tsx` line 111 — `<Share2>` icon in a button with no onClick

**View Count**
- Evidence: `listings.view_count` column exists in DB schema
- `view_count` is never incremented anywhere in the frontend

**Terms of Service / Privacy Policy Links**
- Evidence: `src/pages/Register.tsx` lines 230–233 — `href="#"` placeholder links

---

### D. BROKEN FEATURES

**Password Reset Complete (Reset page missing)**
- `/reset-password` route does not exist — user gets 404 after clicking email link
- Evidence: `App.tsx` — no route for `/reset-password`

**ListingCardSkeleton — Never Used**
- `src/components/listings/ListingCardSkeleton.tsx` exists but is imported nowhere
- Loading state in Home and Browse uses `<Spinner>` instead

**`axios` installed but unused**
- Evidence: `package.json` — `"axios": "^1.18.1"` installed
- No `import axios` found anywhere in source files — dead dependency

---

### E. COMPLETELY MISSING FEATURES

- Admin panel (any admin route, user management, moderation)
- Payment system (no payment provider, no transaction records)
- Review submission form / UI
- Real-time incoming message delivery (Postgres changes subscription)
- Notification system (in-app or email)
- Wishlist page / saved items view
- Availability calendar (blocking booked dates on the date picker)
- `/reset-password` page
- Avatar upload (functional)
- User public profile pages (`/profile/:id`)
- Booking conflict prevention (no check for overlapping dates)
- Pagination (browse results capped at 50 by RPC LIMIT)
- Terms of Service / Privacy Policy pages
- Dark mode toggle wired into UI
- Real platform statistics (dynamic counts)
- Rate limiting
- CSRF protection
- Soft deletion for listings/users

---

## 4. User Roles

Rentitout does **not** implement formal role-based access control. All authenticated users share identical database permissions, governed only by RLS ownership conditions.

### Guest (Unauthenticated)
**Can currently do:**
- View homepage, browse listings, view listing details
- View reviews, owner profiles (read-only)
- Visit About page, Login, Register, ForgotPassword pages

**Cannot do:**
- Anything that requires authentication

**Authorization enforcement:** Supabase RLS `TO anon` read policies on `profiles`, `listings`, `reviews`, `blocked_dates`

---

### Registered User (any logged-in user)
**Can currently do:**
- Everything Guest can do
- Create listings
- Submit booking requests (for others' listings)
- Manage their own listings (edit, delete, toggle active)
- Respond to booking requests for their own listings
- Message other users
- Edit their own profile (name, city, phone, bio)
- Add/remove wishlist items

**Should also be able to do:**
- Submit reviews (form missing)
- View wishlist page (page missing)
- Upload avatar (upload missing)

**Authorization enforcement:**
- `ProtectedRoute` for frontend routes
- RLS: `owner_id = auth.uid()` for listings update/delete
- RLS: `renter_id = auth.uid() OR listing owner` for bookings
- RLS: `auth.uid() = sender_id OR receiver_id` for messages

**Missing enforcement:**
- No check preventing owner from reviewing their own listing (RLS insert policy only checks `author_id = auth.uid()`, not that a completed booking exists with that user as renter)
- No min/max_days enforcement on booking creation

---

### Admin / Super Admin
**Status: COMPLETELY MISSING**
- No admin role, no admin database column, no admin routes, no admin dashboard
- No way to moderate listings, suspend users, approve verifications, or view platform analytics

---

## 5. Authentication & Security Audit

### Registration
| Check | Status | Evidence |
|---|---|---|
| Registration form exists | ✅ IMPLEMENTED | `src/pages/Register.tsx` |
| Zod client validation | ✅ IMPLEMENTED | schema in Register.tsx lines 16–26 |
| Password confirmation | ✅ IMPLEMENTED | `.refine()` in Zod schema |
| Supabase signUp called | ✅ IMPLEMENTED | line 73 |
| Profile auto-created | ✅ IMPLEMENTED | `handle_new_user()` trigger in migrations |
| Email verification required | ✅ IMPLEMENTED | `emailRedirectTo` set; message shown if no session |
| Duplicate email handling | ✅ IMPLEMENTED | error message "already registered" shown |
| SMTP configured | ⚠️ UNKNOWN — REQUIRES VERIFICATION | Supabase default SMTP may not be set up; code shows error message if SMTP fails (Register.tsx lines 85–87) |

### Login
| Check | Status | Evidence |
|---|---|---|
| Login form exists | ✅ IMPLEMENTED | `src/pages/Login.tsx` |
| Supabase signInWithPassword | ✅ IMPLEMENTED | line 21 |
| Error message handling | ✅ IMPLEMENTED | Invalid credentials, unconfirmed email |
| Redirect after login | ✅ IMPLEMENTED | `location.state.from` pattern |
| Console.log leaking credentials | ⚠️ RISKY | Login.tsx lines 18, 25 — `console.log('Form submitted', email, password)` and `console.log('Supabase response:', data, error)` — logs email/password to browser console |

### Session Management
| Check | Status | Evidence |
|---|---|---|
| Session stored in Zustand | ✅ IMPLEMENTED | `src/store/index.ts` |
| Session persisted to localStorage | ✅ IMPLEMENTED | `persist` middleware, key `auth-storage` |
| onAuthStateChange listener | ✅ IMPLEMENTED | `src/hooks/useAuth.ts` lines 39–58 |
| Token refresh | ✅ IMPLEMENTED | Supabase SDK handles JWT refresh automatically |
| Session cleanup on signOut | ✅ IMPLEMENTED | `signOut()` clears store + calls supabase.auth.signOut() |

### Password Reset
| Check | Status | Evidence |
|---|---|---|
| "Forgot password" page | ✅ IMPLEMENTED | `src/pages/ForgotPassword.tsx` |
| resetPasswordForEmail called | ✅ IMPLEMENTED | line 19 |
| Reset page exists | ❌ MISSING | `/reset-password` route is absent from `App.tsx` |

### Password Hashing
| Check | Status | Evidence |
|---|---|---|
| Password hashing | ✅ IMPLEMENTED | Handled entirely by Supabase Auth (bcrypt internally) |

### Protected Routes
| Check | Status | Evidence |
|---|---|---|
| Frontend route guard | ✅ IMPLEMENTED | `ProtectedRoute.tsx` |
| Loading state during auth check | ✅ IMPLEMENTED | Spinner shown while `loading: true` |

### Authorization (Backend)
| Check | Status | Evidence |
|---|---|---|
| RLS enabled on all tables | ✅ IMPLEMENTED | All migration files: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| Listing ownership enforced DB-side | ✅ IMPLEMENTED | RLS UPDATE/DELETE: `auth.uid() = owner_id` |
| Booking access scoped | ✅ IMPLEMENTED | RLS SELECT: `renter_id OR listing owner` |
| Messages scoped to participants | ✅ IMPLEMENTED | RLS SELECT + INSERT |
| Admin role / separate permissions | ❌ MISSING | No admin role anywhere |

### Security Risks / Issues
| Issue | Severity | Evidence |
|---|---|---|
| `console.log(email, password)` in Login.tsx | HIGH | `src/pages/Login.tsx` lines 18, 25 |
| Real credentials in `.env` (Supabase URL + anon key) | MEDIUM — note: anon key is public-safe by design | `.env` line 1–2 |
| Demo credentials displayed on Login page | MEDIUM | `src/pages/Login.tsx` lines 144–147 |
| `BOLT_TEST_USER_EMAIL` + `BOLT_TEST_USER_PASSWORD` in `.env` | LOW | `.env` lines 3–4 (test values, not production) |
| No rate limiting | HIGH | No middleware, no Supabase rate limit config visible |
| No input sanitization beyond Zod | MEDIUM | Zod validates format; no XSS sanitization on freetext fields |
| Booking: no duplicate/overlap check | HIGH | `handleBooking()` in ListingDetail.tsx — inserts without checking existing bookings |
| Review: no completed-booking verification in RLS | MEDIUM | reviews INSERT policy only checks `author_id = auth.uid()`, not booking status |
| No CSRF protection | LOW | Not applicable to Supabase JWT-based auth (stateless) |
| CORS | MANAGED BY SUPABASE | Supabase handles CORS for its own endpoints |

**Potential secrets found in source files:**
- `.env` — contains real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (these are Vite public env vars; anon key is safe to expose by design but URL reveals project ID)
- `.env` — contains `BOLT_TEST_USER_EMAIL` and `BOLT_TEST_USER_PASSWORD` (test account credentials)
- `src/pages/Login.tsx` lines 144–147 — demo credentials rendered visibly in the UI (test account email + password in plaintext)

---

## 6. Database Audit

### Database Type
PostgreSQL hosted on Supabase (project: `qdqtdzofmcgumimuelpf.supabase.co`)

### Tables & Schema

#### `profiles`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK → auth.users(id) ON DELETE CASCADE | Supabase auth user ID |
| name | text | NOT NULL DEFAULT '' | |
| avatar_url | text | nullable | Never updated via UI |
| phone | text | nullable | |
| city | text | NOT NULL DEFAULT '' | |
| bio | text | nullable | |
| is_verified | boolean | NOT NULL DEFAULT false | Never set to true via any UI |
| created_at | timestamptz | DEFAULT now() | |

#### `listings`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| title | text | NOT NULL | |
| description | text | NOT NULL DEFAULT '' | |
| category | text | NOT NULL DEFAULT 'Others' | One of 8 fixed values |
| condition | text | NOT NULL DEFAULT 'Good' | Excellent / Good / Fair |
| price_per_day | numeric(10,2) | NOT NULL DEFAULT 0 | |
| min_days | integer | NOT NULL DEFAULT 1 | |
| max_days | integer | NOT NULL DEFAULT 30 | |
| deposit | numeric(10,2) | nullable | |
| rules | text | nullable | |
| city | text | NOT NULL DEFAULT '' | |
| area | text | NOT NULL DEFAULT '' | |
| images | text[] | NOT NULL DEFAULT '{}' | Array of public storage URLs |
| is_active | boolean | NOT NULL DEFAULT true | |
| owner_id | uuid | NOT NULL FK → auth.users(id) ON DELETE CASCADE | |
| view_count | integer | NOT NULL DEFAULT 0 | Never incremented |
| lat | double precision | nullable | Added in upgrades migration |
| lng | double precision | nullable | Added in upgrades migration |
| fts | tsvector | GENERATED ALWAYS AS … STORED | FTS over title+desc+city+area |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | Updated manually in EditListing.tsx |

**Indexes:** `owner_id`, `category`, `city`, `is_active`, `created_at DESC`, `fts` (GIN)

#### `bookings`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| start_date | date | NOT NULL | |
| end_date | date | NOT NULL | |
| total_days | integer | NOT NULL | Calculated client-side |
| total_price | numeric(10,2) | NOT NULL | Calculated client-side |
| status | text | NOT NULL DEFAULT 'PENDING' | PENDING/ACCEPTED/DECLINED/COMPLETED/CANCELLED |
| message | text | nullable | Optional renter message |
| renter_id | uuid | NOT NULL FK → auth.users(id) ON DELETE CASCADE | |
| listing_id | uuid | NOT NULL FK → listings(id) ON DELETE CASCADE | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | Never updated on status change |

**Indexes:** `renter_id`, `listing_id`, `status`

**Missing:** No `payment_status` column, no `cancellation_reason`, `updated_at` not auto-updated on status change

#### `reviews`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| rating | integer | NOT NULL CHECK(1–5) | |
| comment | text | NOT NULL DEFAULT '' | |
| author_id | uuid | NOT NULL FK → auth.users(id) ON DELETE CASCADE | |
| listing_id | uuid | NOT NULL FK → listings(id) ON DELETE CASCADE | |
| booking_id | uuid | NOT NULL UNIQUE FK → bookings(id) ON DELETE CASCADE | One review per booking |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `listing_id`, `author_id`

**Note:** `booking_id UNIQUE` correctly enforces one review per booking, but RLS INSERT policy does NOT check that the booking status is COMPLETED or that `renter_id = author_id`

#### `messages`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| content | text | NOT NULL | |
| sender_id | uuid | NOT NULL FK → auth.users(id) ON DELETE CASCADE | |
| receiver_id | uuid | NOT NULL FK → auth.users(id) ON DELETE CASCADE | |
| conversation_id | text | NOT NULL | Deterministic: `LEAST(id1,id2) || '_' || GREATEST(id1,id2)` |
| listing_id | uuid | nullable FK → listings(id) ON DELETE SET NULL | Context listing |
| read | boolean | NOT NULL DEFAULT false | Never marked as read in UI |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `conversation_id`, `sender_id`, `receiver_id`

#### `blocked_dates`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| date | date | NOT NULL | |
| listing_id | uuid | NOT NULL FK → listings(id) ON DELETE CASCADE | |

**Status:** Table exists in DB but is never used by any frontend code

#### `wishlists`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | NOT NULL FK → auth.users(id) ON DELETE CASCADE | |
| listing_id | uuid | NOT NULL FK → listings(id) ON DELETE CASCADE | |
| created_at | timestamptz | DEFAULT now() | |
| (unique constraint) | | UNIQUE(user_id, listing_id) | |

**Status:** Table exists and is used by ListingCard; no wishlist page

### Entity Relationships

```text
auth.users (Supabase managed)
    └─── 1:1 ──→ profiles (trigger: handle_new_user)
                     │
                     ├─── 1:N ──→ listings (owner_id)
                     │                │
                     │                ├─── 1:N ──→ bookings (listing_id)
                     │                │                │
                     │                │                └─── 0:1 ──→ reviews (booking_id UNIQUE)
                     │                │
                     │                └─── 1:N ──→ blocked_dates (listing_id) [unused frontend]
                     │
                     ├─── 1:N ──→ bookings (renter_id)
                     ├─── 1:N ──→ reviews (author_id)
                     ├─── 1:N ──→ messages (sender_id)
                     ├─── 1:N ──→ messages (receiver_id)
                     └─── 1:N ──→ wishlists (user_id)
```

### PostgreSQL Functions / RPCs

| Function | Purpose | Status |
|---|---|---|
| `public.handle_new_user()` | Trigger: auto-creates profile on signup | ✅ Active |
| `calculate_distance(lat1,lon1,lat2,lon2)` | Haversine distance in miles | ✅ Active |
| `search_listings_advanced(...)` | FTS + filter + sort RPC called by Browse.tsx | ✅ Active |

### Seed Data
- V1 migration: 3 fake users (demo@rentitout.com, priya@rentitout.com, raj@rentitout.com) seeded directly into `auth.users` — these are likely invalid because Supabase Auth doesn't allow direct inserts without proper password hashing matching their internal format
- V4 migration: 10 sample listings seeded for the real test user (`bolt-test-1782494547377@test.local`) — these should be visible in the live database
- No seed bookings, reviews, or messages

### Missing Database Elements
- `notifications` table (no notification system)
- `admin_roles` table or `role` column on profiles
- `payment_transactions` table
- `cancellation_reason` on bookings
- `updated_at` trigger on bookings (currently only on listings)
- Composite index on `bookings(listing_id, start_date, end_date)` for overlap queries
- Constraint: prevent renter = owner on booking INSERT

---

## 7. API Audit

Rentitout has **no custom backend server**. All "API" calls are direct Supabase PostgREST queries or RPCs from the frontend using the JS client. The following table documents all database interactions found in source files.

| Method | Table / RPC | Purpose | Auth Required | Authorization | File | Status |
|---|---|---|---|---|---|---|
| SELECT | `listings` | Fetch featured listings (home page) | No | RLS: active only | `Home.tsx:37` | ✅ Working |
| RPC | `search_listings_advanced` | Browse search+filter+sort | No | RLS inside function | `Browse.tsx:62` | ✅ Working |
| SELECT | `listings` | Fetch single listing + owner | No | RLS: active or owner | `ListingDetail.tsx:42` | ✅ Working |
| SELECT | `reviews` | Fetch reviews for listing | No | Public RLS | `ListingDetail.tsx:43` | ✅ Working |
| SELECT | `listings` | Fetch similar listings | No | RLS: active | `ListingDetail.tsx:48` | ✅ Working |
| INSERT | `bookings` | Create booking request | Yes | RLS: renter_id = uid | `ListingDetail.tsx:66` | ✅ Working |
| INSERT | `listings` | Create new listing | Yes | RLS: owner = uid | `ListItem.tsx:131` | ✅ Working |
| UPDATE | `listings` | Edit listing | Yes | RLS: owner = uid | `EditListing.tsx:66` | ✅ Working |
| SELECT | `listings` | Owner's listings | Yes | Filtered by owner_id | `MyListings.tsx:39` | ✅ Working |
| UPDATE | `listings` | Toggle is_active | Yes | RLS: owner = uid | `MyListings.tsx:55` | ✅ Working |
| DELETE | `listings` | Delete listing | Yes | RLS: owner = uid | `MyListings.tsx:63` | ✅ Working |
| SELECT | `bookings` | Renter's bookings | Yes | RLS: renter_id = uid | `MyRentals.tsx:33` | ✅ Working |
| UPDATE | `bookings` | Cancel booking (CANCELLED) | Yes | RLS: renter_id = uid | `MyRentals.tsx:48` | ✅ Working |
| SELECT | `listings` | Owner's listing IDs | Yes | Filtered by owner_id | `Requests.tsx:36` | ✅ Working |
| SELECT | `bookings` | Incoming requests for owner | Yes | RLS: listing owner | `Requests.tsx:39` | ✅ Working |
| UPDATE | `bookings` | Accept/Decline/Complete | Yes | RLS: renter or owner | `Requests.tsx:50` | ✅ Working |
| SELECT | `profiles` | Own profile | Yes | RLS: public read | `useAuth.ts:26` | ✅ Working |
| UPDATE | `profiles` | Update profile | Yes | RLS: uid = id | `Profile.tsx:47` | ✅ Working |
| SELECT | `messages` | Load conversations | Yes | RLS: participant | `Messages.tsx:94` | ✅ Working |
| SELECT | `messages` | Load conversation messages | Yes | RLS: participant | `Messages.tsx:126` | ✅ Working |
| INSERT | `messages` | Send message | Yes | RLS: sender = uid | `Messages.tsx:154` | ✅ Working |
| INSERT | `wishlists` | Add to wishlist | Yes | RLS: user = uid | `ListingCard.tsx:39` | ✅ Working |
| DELETE | `wishlists` | Remove from wishlist | Yes | RLS: user = uid | `ListingCard.tsx:37` | ✅ Working |
| SELECT | `listings` | Pending count (dashboard) | Yes | owner_id filter | `Dashboard/index.tsx:31` | ✅ Working |
| SELECT | `listings` | Listing count | Yes | owner_id filter | `Overview.tsx:34` | ✅ Working |
| SELECT | `bookings` | Active rentals count | Yes | renter_id + status | `Overview.tsx:35` | ✅ Working |
| SELECT | `bookings` | Recent activity + earnings | Yes | listing_id IN owner's | `Overview.tsx:40–51` | ✅ Working |
| STORAGE upload | `listing-images` | Upload listing photo | Yes | Supabase Storage RLS | `ListItem.tsx:115` | ✅ Working |

### Missing API Operations
| Missing Operation | Why Needed |
|---|---|
| INSERT reviews | No review submission form/query |
| SELECT wishlists (full list) | No wishlist page |
| UPDATE profiles (avatar_url) | Avatar upload not implemented |
| SELECT/INSERT blocked_dates | Availability calendar not used |
| SELECT bookings (overlap check) | No conflict prevention |
| UPDATE listings (view_count++) | View count never incremented |
| Any admin operations | Admin panel entirely missing |
| Any payment operations | Payment system missing |
| UPDATE messages (read = true) | Read receipts never triggered |

---

## 8. Frontend Audit

### `/` — Home Page (`src/pages/Home.tsx`)
- **API calls:** SELECT listings (active, newest 8)
- **Working:** Featured listings grid (real data), category pill navigation, search → `/browse?q=`, hero CTA buttons
- **Mock/hardcoded:** Stats (2400+, 1800+, 50+), "How It Works" steps, Trust section
- **Missing:** Loading skeleton for listings (uses generic spinner), empty state if no listings
- **Responsiveness:** Good — responsive grid (1→2→3→4 cols), mobile hero

### `/browse` — Browse Page (`src/pages/Browse.tsx`)
- **API calls:** `search_listings_advanced` RPC
- **Working:** FTS search, category filter, price slider, condition filter, city filter, sort (newest/price/distance), grid/list toggle, active filter chips
- **Missing:** Pagination (LIMIT 50 hardcoded in SQL), empty state for no filters, URL state persistence on back-navigation
- **Bug:** `total` state set to `mappedListings.length` (same as listings.length) — redundant
- **Responsiveness:** Good — sidebar hides on mobile, Sheet component used for mobile filters

### `/listing/:id` — Listing Detail (`src/pages/ListingDetail.tsx`)
- **API calls:** SELECT listing+owner, SELECT reviews, SELECT similar listings, INSERT booking
- **Working:** Image carousel, owner card, reviews display, date picker, price calculation, booking submit, "Message Owner" button
- **Missing:** Availability calendar (blocked dates not fetched), duplicate booking prevention, min/max days enforcement, review submission form, share functionality
- **Mock:** "Available" badge always shown
- **Responsiveness:** Good — 5-col grid switches to single column on mobile

### `/list-item` — Create Listing (`src/pages/ListItem.tsx`)
- **API calls:** Nominatim geocode, Supabase Storage upload, INSERT listing
- **Working:** 3-step wizard with step-level Zod validation, drag-drop image upload, image compression, geocoding, listing creation
- **Missing:** Preview step, image reordering, duplicate listing detection

### `/edit-listing/:id` — Edit Listing (`src/pages/EditListing.tsx`)
- **API calls:** SELECT listing (with ownership check), UPDATE listing
- **Working:** Loads existing data, validates ownership client-side, saves changes
- **Missing:** Image editing (can't change/add/remove images), location re-geocoding

### `/messages` — Messages (`src/pages/Messages.tsx`)
- **API calls:** SELECT messages (conversations), SELECT messages (single conv), INSERT message, Realtime presence channel
- **Working:** Conversation list, message view, send, typing indicator
- **Missing:** Real-time incoming message delivery (no Postgres changes subscription), unread count badges, message read marking, mobile layout (conversation list hidden on small screens — but chat area shown alone; confusing UX when no conv selected on mobile), image/file attachments

### `/dashboard` — Dashboard Overview (`src/pages/Dashboard/Overview.tsx`)
- **API calls:** SELECT listing count, SELECT active rental count, SELECT recent bookings, SELECT completed booking prices
- **Working:** 4 stat cards (real data), recent activity feed, quick action buttons
- **Missing:** Earnings chart, activity graph, recommendations

### `/dashboard/my-listings` (`src/pages/Dashboard/MyListings.tsx`)
- **API calls:** SELECT own listings, UPDATE is_active, DELETE listing
- **Working:** List view, status toggle, delete with confirmation dialog
- **Missing:** View count per listing, booking count per listing, revenue per listing

### `/dashboard/my-rentals` (`src/pages/Dashboard/MyRentals.tsx`)
- **API calls:** SELECT bookings as renter, UPDATE status (cancel)
- **Working:** Booking list with listing thumbnail, date, price, status badge, filter tabs, cancel
- **Missing:** Actual review submission from "Leave Review" button (only navigates to listing detail)

### `/dashboard/requests` (`src/pages/Dashboard/Requests.tsx`)
- **API calls:** SELECT bookings for owner's listings, UPDATE booking status
- **Working:** Incoming request list, accept/decline/complete actions, filter tabs, pending count badge
- **Missing:** Notification to renter on status change, conflict detection

### `/dashboard/profile` (`src/pages/Dashboard/Profile.tsx`)
- **API calls:** UPDATE profiles
- **Working:** Name, city, phone, bio edit with form validation
- **Missing:** Avatar upload (camera button is UI-only), password change, email change, account deletion

### `/login`, `/register`, `/forgot-password`, `/verified`
- All work as documented in Section 3.

### Miscellaneous
- **Loading states:** Spinner shown in most pages ✅
- **Empty states:** `EmptyState` component used in Browse, MyListings, MyRentals, Requests, Messages ✅
- **Error states:** Toast notifications on failures ✅; no inline form error states for API failures
- **404:** Custom 404 page exists ✅
- **Navigation:** Navbar with scroll effect, mobile hamburger ✅
- **Footer:** Static ✅

---

## 9. Rental Marketplace Workflow Audit

| Step | Implemented? | Backend? | DB? | Frontend? | Issues |
|---|---|---|---|---|---|
| Visitor views listings | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | — |
| Register / Login | ✅ Yes | ✅ Yes (Supabase Auth) | ✅ Yes | ✅ Yes | Email SMTP may need config |
| Search listings | ✅ Yes | ✅ Yes (RPC) | ✅ Yes (FTS+indexes) | ✅ Yes | No pagination |
| View listing detail | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | No availability calendar |
| Check availability | ❌ No | ❌ No | ✅ Schema exists (blocked_dates + bookings) | ❌ No | No overlap check at all |
| Request/Book rental | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | No duplicate booking prevention |
| Owner sees request | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | No push notification |
| Owner approves/rejects | ✅ Yes | ✅ Yes (RLS update) | ✅ Yes | ✅ Yes | No notification to renter |
| Payment | ❌ MISSING | ❌ MISSING | ❌ MISSING | ❌ MISSING | Completely absent |
| Booking confirmed | ⚠️ Partial | ✅ Status set to ACCEPTED | ✅ Yes | ✅ Status shown | No notification, no email |
| Rental active | ⚠️ Partial | ✅ ACCEPTED status | ✅ Yes | ✅ Shown in MyRentals | No active rental tracking |
| Rental completed | ⚠️ Partial | ✅ Status set to COMPLETED | ✅ Yes | ✅ Owner can mark complete | No automatic completion |
| Review / Rating | ❌ No | ❌ No insert endpoint | ✅ Schema exists | ❌ No form | Reviews readable, not writable |
| Transaction history | ⚠️ Partial | ✅ Bookings query | ✅ Yes | ✅ MyRentals + Requests | No payment records |

---

## 10. Active User / Realistic Data Audit

### Existing Seed Data
- **V1 migration:** 3 fake users (demo@rentitout.com, priya@rentitout.com, raj@rentitout.com) seeded directly into `auth.users` — these are likely invalid because Supabase Auth doesn't allow direct inserts without proper password hashing matching their internal format
- **V4 migration:** 10 sample listings seeded for the real test user (`bolt-test-1782494547377@test.local`) — these should be visible in the live database
- **No seed bookings**
- **No seed reviews**
- **No seed messages**

### Reality
- The app can support multiple simultaneous users (RLS enforces isolation)
- Data is stored in Supabase PostgreSQL — persistent, not in-memory
- Listing images use Unsplash CDN URLs as placeholders (seed data)
- Stats on homepage are hardcoded (2,400+, 1,800+, 50+) — do not reflect real DB counts

### Demo Data Strategy (Recommended, not yet implemented)
1. Create 3–5 real Supabase auth users via Supabase Dashboard or Auth API with known passwords
2. Seed 15–20 realistic listings spread across Mumbai, Delhi, Bangalore
3. Create 5–8 bookings across various statuses (PENDING, ACCEPTED, COMPLETED, DECLINED)
4. Create 3–5 reviews for completed bookings
5. Create 2–3 conversation threads between users
6. Update homepage stats to be DB-driven (COUNT queries)

---

## 11. Admin Panel Audit

**Status: COMPLETELY MISSING**

There is no admin panel of any kind in the current codebase. Specifically:

| Feature | Status |
|---|---|
| Admin authentication / role | ❌ Missing — no `role` column, no admin flag |
| Admin-only routes | ❌ Missing |
| User management (list, suspend, delete) | ❌ Missing |
| Listing moderation (approve, remove) | ❌ Missing |
| Booking management | ❌ Missing |
| Review moderation | ❌ Missing |
| Category management | ❌ Missing |
| User verification | ❌ Missing (`is_verified` exists but nothing sets it) |
| Platform analytics | ❌ Missing |
| Platform settings | ❌ Missing |

**What would be needed minimum:**
1. Add `role` column to `profiles` table (values: `user`, `admin`)
2. Create `/admin` route protected by role check
3. Admin dashboard: user list, listing list, booking list, review list
4. Admin actions: verify user, deactivate listing, resolve disputes

---

## 12. Image / File Upload Audit

### Current Implementation
- **Upload mechanism:** `react-dropzone` in `src/pages/ListItem.tsx`
- **Storage:** Supabase Storage bucket `listing-images`
- **Path format:** `listings/{user.id}/{timestamp}-{random}.webp`
- **Compression:** `compressImage()` in `src/lib/utils.ts` — Canvas API → WebP at 80% quality, max width 1200px — **IMPLEMENTED AND WORKING**
- **File type validation:** `accept: { 'image/*': [] }` in dropzone config
- **File size limit:** `maxSize: 5 * 1024 * 1024` (5MB per file)
- **Multiple images:** Up to 5 per listing
- **Image deletion:** ❌ Not implemented — no `supabase.storage.remove()` call
- **Fallback on error:** Unsplash placeholder URL used if no images or if upload fails
- **Broken image handling:** `onError` fallback to Unsplash URL in ListingCard.tsx, ListingDetail.tsx, MyListings.tsx, MyRentals.tsx ✅

### What's Missing
- No image editing on EditListing.tsx (only text fields editable, not images)
- No image deletion from storage when listing is deleted (storage objects orphaned)
- No image optimization beyond compression (no CDN resizing, no WebP conversion for existing Unsplash URLs)
- Avatar upload: UI button exists in Profile.tsx but no upload logic

### Storage Bucket Requirements
- Bucket `listing-images` must exist in Supabase with public read policy
- If bucket doesn't exist or has wrong policy, uploads will fail silently (error caught but fallback used)

---

## 13. Search & Discovery Audit

### Search
| Feature | Status | Evidence |
|---|---|---|
| Text search (FTS) | ✅ IMPLEMENTED | `search_listings_advanced()` uses `fts @@ plainto_tsquery()` |
| Search fields covered | title, description, city, area | `fts` tsvector in upgrades migration |
| Search from home page | ✅ IMPLEMENTED | Navigates to `/browse?q=` |
| Search in browse page | ✅ IMPLEMENTED | Input updates `search` state → triggers RPC |

### Filters
| Filter | Status | Evidence |
|---|---|---|
| Category (multi-select) | ✅ IMPLEMENTED | `Browse.tsx` checkboxes → `categories` param |
| Price range (slider) | ✅ IMPLEMENTED | 0–5000 INR slider |
| Condition | ✅ IMPLEMENTED | Excellent/Good/Fair checkboxes |
| City | ✅ IMPLEMENTED | Text input → ILIKE query |
| Availability filter | ❌ MISSING | No date-based filter |

### Sorting
| Sort | Status | Evidence |
|---|---|---|
| Newest first | ✅ IMPLEMENTED | Default sort |
| Price low→high | ✅ IMPLEMENTED | |
| Price high→low | ✅ IMPLEMENTED | |
| Nearest to me | ✅ IMPLEMENTED | Haversine distance (requires geolocation permission) |

### Discovery
| Feature | Status |
|---|---|
| Category pills on homepage | ✅ Links to `/browse?category=X` |
| Similar items on listing detail | ✅ Fetches 4 items of same category |
| Wishlist | ⚠️ Can add but no dedicated page |
| Pagination | ❌ MISSING (hardcoded LIMIT 50) |
| Infinite scroll | ❌ MISSING |
| Search suggestions/autocomplete | ❌ MISSING |
| Recently viewed | ❌ MISSING |
| Recommended for you | ❌ MISSING |

---

## 14. Booking / Transaction Audit

### Booking Creation
- ✅ Date picker (HTML date inputs)
- ✅ Price calculation (client-side: days × price_per_day + deposit shown)
- ✅ Optional message to owner
- ✅ Owner cannot book own listing (client-side check)
- ❌ No min/max_days enforcement (e.g. if min_days=3 and user picks 1 day)
- ❌ No overlapping booking check (another user could book the same dates)
- ❌ No availability calendar (blocked dates not fetched or displayed)
- ❌ No end-date > start-date validation

### Booking Status Lifecycle
```text
PENDING → ACCEPTED → COMPLETED
       → DECLINED
       → CANCELLED (renter can cancel PENDING only)
```
- ✅ All 5 statuses defined
- ✅ ACCEPTED/DECLINED by owner in Requests.tsx
- ✅ COMPLETED by owner in Requests.tsx
- ✅ CANCELLED by renter in MyRentals.tsx
- ❌ No automatic status transitions (e.g. auto-complete after end_date passes)
- ❌ `updated_at` not updated when status changes (no trigger, no manual update)

### Race Conditions
- **CRITICAL:** Two renters can simultaneously book the same listing for the same dates. No DB constraint or CHECK prevents this.

### Payment
- ❌ No payment status column
- ❌ No payment integration
- ❌ No transaction records

---

## 15. Notification & Communication Audit

### In-App Notifications
| Feature | Status |
|---|---|
| Toast notifications (UI feedback) | ✅ Sonner toasts throughout app |
| In-app notification center | ❌ MISSING |
| Booking status change notification | ❌ MISSING (no notification system) |
| Unread message badge | ❌ MISSING (messages read field exists, never set) |
| Pending request badge in sidebar | ✅ IMPLEMENTED (`Dashboard/index.tsx` counts PENDING) |

### Email Notifications
| Feature | Status |
|---|---|
| Registration confirmation email | ✅ Via Supabase Auth (if SMTP configured) |
| Password reset email | ✅ Via Supabase Auth |
| Booking request notification to owner | ❌ MISSING |
| Booking accepted/declined notification to renter | ❌ MISSING |
| Any transactional email | ❌ MISSING |

### Messaging / Chat
| Feature | Status |
|---|---|
| Send/receive messages | ✅ IMPLEMENTED |
| Conversation grouping | ✅ IMPLEMENTED |
| Typing indicator | ✅ Supabase Presence |
| Real-time incoming messages | ❌ MISSING — no Postgres changes subscription |
| Read receipts | ❌ MISSING — `read` field exists but never updated |
| Unread count per conversation | ❌ MISSING |
| Message notifications | ❌ MISSING |
| Image/file in chat | ❌ MISSING |

---

## 16. Payment Audit

**Status: COMPLETELY MISSING**

There is no payment functionality of any kind in the current codebase.

| Item | Status |
|---|---|
| Payment provider | ❌ None (no Razorpay, Stripe, PayU, Cashfree, etc.) |
| Payment backend integration | ❌ None |
| Payment frontend | ❌ None |
| Order creation | ❌ None |
| Payment verification | ❌ None |
| Webhooks | ❌ None |
| Transaction records table | ❌ None |
| Refund handling | ❌ None |

**Note:** Homepage shows "Secure Payments" as a trust signal (`Home.tsx` lines 215–216) — this is entirely misleading as no payment system exists.

**Recommended for implementation:** Razorpay (India-focused, easy integration, test mode available)

---

## 17. Error & Edge Case Audit

| Scenario | Handling | Evidence |
|---|---|---|
| Invalid login | Toast error shown | `Login.tsx:26-34` |
| Email not verified | Specific error message shown | `Login.tsx:30-31` |
| Registration with existing email | Toast error shown | `Register.tsx:83-84` |
| API failure (general) | Toast error in most places | throughout |
| Listing not found | Navigate to /browse | `ListingDetail.tsx:45` |
| User unauthorized (frontend) | ProtectedRoute redirect | `ProtectedRoute.tsx` |
| Image upload failure | Fallback to Unsplash URL | `ListItem.tsx:127-129` |
| Geocoding failure | Silent warn; lat/lng null | `ListItem.tsx:104-106` |
| Broken image | onError fallback | All listing image elements |
| Own listing booking attempt | Toast error | `ListingDetail.tsx:64` |
| Network disconnect | ❌ No offline handling | — |
| Session expiry | ✅ Supabase auto-refreshes JWT | — |
| Booking date conflict | ❌ Not handled | No overlap check |
| End date before start date | ❌ Not validated | Only min HTML attribute set |
| Min/max days violation | ❌ Not validated | — |
| Delete listing with active bookings | ❌ No warning | `bookings` ON DELETE CASCADE — bookings silently deleted |
| Owner deletes active listing | ❌ No notification to renters | — |
| User deletes account | ❌ Not possible via UI | No account deletion feature |
| Payment failure | ❌ N/A — no payment | — |
| Empty search results | ✅ EmptyState shown | `Browse.tsx:297-306` |
| Form validation errors | ✅ Inline Zod errors | Registration, ListItem, Profile |
| API 401/403 | ❌ No generic error boundary | Raw error in some cases |

---

## 18. Performance Audit

| Issue | Severity | Evidence |
|---|---|---|
| N+1 potential: Dashboard/Overview fetches listing IDs then bookings | MEDIUM | `Overview.tsx:30-55` — two sequential queries; could be one JOIN |
| Browse results capped at 50 (no pagination) | MEDIUM | `search_listings_advanced()` `LIMIT 50` |
| No React.memo / useMemo on listing grids | LOW | ListingCard rerenders on every parent state change |
| `loadConversations()` called after every message send | LOW | `Messages.tsx:170` — refetches all conversations on send |
| No query caching (no React Query / SWR) | MEDIUM | Every page mount refetches all data |
| Unsplash images loaded at full size (w=800) | LOW | Could use srcset or lazy CDN |
| `compressImage()` blocks main thread briefly | LOW | Canvas operations are synchronous |
| FTS index exists | ✅ GOOD | GIN index on `fts` column |
| Listings indexes exist | ✅ GOOD | owner_id, category, city, is_active, created_at |
| No index on bookings(listing_id, start_date, end_date) | MEDIUM | Needed for overlap queries once implemented |
| `axios` bundled but unused | LOW | Dead weight in bundle |
| All listing images loaded eagerly on Home | LOW | `loading="lazy"` not set on Home.tsx image |

---

## 19. Mobile / Responsive Audit

| Page / Component | Mobile | Tablet | Desktop | Notes |
|---|---|---|---|---|
| Home | ✅ Good | ✅ Good | ✅ Good | Responsive grid, hero text scales |
| Browse | ✅ Good | ✅ Good | ✅ Good | Sidebar hidden, Sheet used for filters |
| ListingDetail | ✅ Good | ✅ Good | ✅ Good | 5-col → 1-col grid |
| ListItem | ✅ Good | ✅ Good | ✅ Good | Max-w-2xl centered |
| EditListing | ✅ Good | ✅ Good | ✅ Good | Same as ListItem |
| Messages | ⚠️ Poor | ✅ OK | ✅ Good | Conversation list hidden on mobile (`hidden sm:flex`); chat pane shown but selecting a conversation is not possible without list |
| Dashboard | ✅ Good | ✅ Good | ✅ Good | Mobile sidebar via overlay |
| Login/Register | ✅ Good | ✅ Good | ✅ Good | Split panel (left panel hidden on mobile) |
| Navbar | ✅ Good | ✅ Good | ✅ Good | Hamburger menu on mobile |
| ListingCard | ✅ Good | ✅ Good | ✅ Good | |

**Critical Mobile Issue:** Messages page on mobile — the conversation list uses `hidden sm:flex` which hides it completely on mobile. When arriving via "Message Owner" link with `?with=` param, a conversation loads, but the user has no way to switch conversations. Needs a back button or tab-based navigation on mobile.

---

## 20. Deployment Readiness

### Current Configuration
| Item | Status | Evidence |
|---|---|---|
| Production build script | ✅ `npm run build` (tsc + vite build) | `package.json:8` |
| SPA routing fix for Vercel | ✅ `vercel.json` rewrites all paths to `/index.html` | `vercel.json` |
| Environment variable handling | ✅ Vite `VITE_` prefix for public env vars | `.env`, `vite.config.ts` |
| `.env` in `.gitignore` | ✅ CONFIRMED | `.gitignore` |
| Production CORS | ✅ Managed by Supabase | Supabase project settings |
| Static file serving | ✅ Vite builds to `/dist` | |
| Custom domain support | ✅ Via Vercel | |
| Image storage production | ✅ Supabase Storage (CDN-backed) | |

### Missing for Production
- `.env.example` only has 2 variables; production deployment instructions missing
- No environment for staging vs production Supabase projects
- `console.log` statements in Login.tsx would be visible in production browser console
- No error monitoring (Sentry, etc.)
- No analytics (GA, Plausible, etc.)
- No health check endpoint (not applicable for pure frontend)

### Recommended Deployment Architecture
```text
Frontend (Static SPA)
  → Vercel (free tier sufficient)
  → vercel.json SPA rewrite ✅ already configured

Backend / Database / Auth / Storage
  → Supabase (hosted PostgreSQL + Auth + Storage + Realtime)
  → Already configured ✅

Recommended additions:
  → Razorpay for payments (Indian market)
  → Resend or SendGrid for transactional email (via Supabase Edge Functions)
  → Cloudflare R2 or Supabase Storage for images (already using Supabase Storage ✅)
```

---

## 21. Testing Audit

### Existing Tests
| Test File | Tests | Coverage |
|---|---|---|
| `src/lib/__tests__/utils.test.ts` | 4 unit tests | `getDaysBetween`, `formatPrice`, `getInitials` |
| `src/components/__tests__/ProtectedRoute.test.tsx` | 2 integration tests | Redirect when unauthenticated, render when authenticated |

### Test Configuration
- Framework: Vitest + @testing-library/react + jsdom ✅
- Setup file: `src/setupTests.ts` (minimal, only 1 import)
- Path alias `@` configured in vitest.config.ts ✅

### Missing Tests
- No tests for any page component (Home, Browse, ListingDetail, etc.)
- No tests for form validation logic
- No tests for Zustand store
- No tests for Supabase interactions (would require mocking)
- No API/integration tests
- No end-to-end tests (no Playwright/Cypress)
- Test coverage is approximately **2%** of codebase

---

## 22. Code Quality Audit

### Positive Patterns
- Consistent use of TypeScript throughout
- Zod schema validation on all forms
- Custom hooks for auth (`useAuth`)
- Separation of concerns: lib/, hooks/, store/, components/, pages/
- Reusable UI primitives from shadcn/ui
- Meaningful variable names
- Proper loading and empty states in most pages

### Issues Found

| Issue | Severity | Location |
|---|---|---|
| `console.log(email, password)` | HIGH | `Login.tsx:18,25` |
| `console.log('Supabase response:', data, error)` | HIGH | `Login.tsx:25` |
| `console.warn(...)` in geocoding | LOW | `ListItem.tsx:105` |
| `console.error(...)` in several catch blocks | LOW | Overview.tsx, MyListings.tsx, MyRentals.tsx |
| Dead dependency `axios` | LOW | `package.json` — installed, never used |
| `ListingCardSkeleton.tsx` — dead component | LOW | Imported nowhere |
| `// @ts-ignore` in Messages.tsx | MEDIUM | `Messages.tsx:74` — presence state type |
| `as any` casts in several places | MEDIUM | Messages.tsx, MyRentals.tsx, Overview.tsx, Browse.tsx |
| `as unknown as Booking[]` double cast | MEDIUM | `MyRentals.tsx:37` — type safety bypassed |
| Booking `total_days`/`total_price` calculated client-side | HIGH | Can be manipulated; should be server-validated |
| No `updated_at` trigger on bookings status changes | MEDIUM | — |
| Hardcoded LIMIT 50 in search RPC | MEDIUM | `search_listings_advanced()` |
| `brain.md` notes "image compression not managed" | OUTDATED | `compressImage()` was added later |
| Multiple migration files repeat identical table definitions | LOW | V1, V2, V3, V4 all define same tables |
| Demo credentials visible in Login.tsx UI | MEDIUM | `Login.tsx:144-147` |
| `useEffect` dependency array suppression (`// eslint-disable-next-line`) | LOW | `useAuth.ts:68` |
| Inconsistent: some pages use `try/catch`, some use `.then()` error handling | LOW | throughout |
| `profile?.name?.split(' ')[0]` could crash if name is empty string | LOW | `Overview.tsx:102` |

---

## 23. Placement Project Quality Assessment

| Dimension | Score | Reasoning |
|---|---|---|
| **Frontend** | 7.5/10 | Clean React 19 + TypeScript, shadcn/ui, Tailwind v4, good component structure, routing, proper loading/empty states. Loses points for hardcoded stats, broken avatar upload, missing review form, poor mobile messages layout. |
| **Backend** | 5.5/10 | Supabase BaaS handles most backend concerns well (RLS, Auth, Storage, FTS, Realtime). The advanced search RPC + Haversine is impressive. Loses points for no custom logic layer, no admin, no payment, no email service. |
| **Database** | 7/10 | Well-structured schema with 7 tables, proper FKs, RLS on everything, GIN index for FTS, Haversine for distance. Loses points for no payment table, unused blocked_dates, no overlap constraint, client-side total_price. |
| **Authentication** | 7/10 | Supabase Auth works well. Session persistence, protected routes, email verification, password reset (partially). Loses points for missing /reset-password page, console.log leaking credentials. |
| **Authorization** | 5/10 | RLS correctly scopes all data access. Loses points for no admin role, no verified status enforcement, no booking overlap prevention, review RLS allows reviewing without completed booking. |
| **API Design** | 5/10 | Direct Supabase SDK calls work but are all client-side. Advanced search RPC is good. Loses points for no custom API layer, client-side price calculation (exploitable), no rate limiting, no pagination. |
| **Real-world Functionality** | 5.5/10 | Core rental workflow (list → browse → book → manage) is real. Messaging is real. But: no payment, no review submission, no notifications, no availability check, no admin panel. |
| **Security** | 4/10 | RLS is the main security layer (good). Loses heavily for: console.log(password), no rate limiting, no booking conflict enforcement, review RLS incomplete, demo credentials in UI, client-side price. |
| **UI/UX** | 8/10 | Professional design, dark navy + brand orange palette, Google Fonts, smooth animations, glassmorphism-style hero, responsive layout, good micro-interactions (card hover, fade-in). Minor issues: no dark mode toggle reachable, mobile messages poor. |
| **Performance** | 5/10 | No query caching, no pagination, multiple sequential queries in overview, dead bundle weight. FTS and indexes are good. |
| **Testing** | 2/10 | 6 tests total. No page/API/E2E tests. |
| **Deployment Readiness** | 6/10 | Vercel config ✅, build script ✅, env vars ✅. Missing: production error monitoring, remove console.log, SMTP configuration instructions. |
| **Code Quality** | 6/10 | Consistent patterns, TypeScript, Zod validation. Issues: console.log(password), as any casts, unused dependencies, duplicate migrations. |
| **Overall Project Maturity** | **5.5/10** | A solid, visually impressive foundation with real Supabase integration and meaningful features. The core browsing + booking + messaging flow works end-to-end. However, critical missing pieces (payment, review submission, notifications, admin, availability) prevent it from being a truly complete platform. With 1–2 weeks of focused work, it can reach 8/10. |

---

## 24. Missing Features — Prioritized List

### P0 — CRITICAL / MUST FIX

| # | Feature | Why | Current State | Frontend | Backend | Database | Difficulty |
|---|---|---|---|---|---|---|---|
| P0-1 | `/reset-password` page | Password reset link leads to 404 — broken core auth flow | `ForgotPassword.tsx` sends email but no handler | Create page with Supabase `updateUser` call | Supabase Auth handles it | None | Easy |
| P0-2 | Remove `console.log(email, password)` | Security risk — leaks credentials to browser console | `Login.tsx:18,25` | Delete 2 lines | N/A | N/A | Trivial |
| P0-3 | Review submission form | Reviews table exists, reviews displayed, but no way to submit | "Leave Review" button navigates to listing; no form | Add modal or form on listing detail | INSERT reviews with completed booking check | Tighten RLS: require COMPLETED booking | Medium |
| P0-4 | Booking date overlap prevention | Two users can book same item for same dates | No check anywhere | Disable submit if conflict | Add DB function or CHECK; query existing bookings | Add composite index + DB-level check | Medium |
| P0-5 | Real-time incoming messages | Sender sees new messages; receiver must refresh | No Postgres changes subscription | Add `supabase.channel().on('postgres_changes')` | Supabase Realtime already enabled | None | Easy |

### P1 — IMPORTANT

| # | Feature | Why | Current State | Frontend | Backend | Database | Difficulty |
|---|---|---|---|---|---|---|---|
| P1-1 | Avatar upload | Profile camera button exists but non-functional | UI-only button | Wire to Supabase Storage upload; update `avatar_url` | Storage bucket needed (can reuse listing-images or new) | `avatar_url` column exists | Medium |
| P1-2 | Availability calendar on listing detail | Renter can't see which dates are taken | Blocked_dates table exists but unused | Fetch existing bookings, highlight unavailable dates | Query bookings by listing_id and status in [PENDING, ACCEPTED] | None new | Medium |
| P1-3 | Dark mode toggle in Navbar | ThemeProvider + CSS vars exist; toggle unreachable | `mode-toggle.tsx` not placed in Navbar | Add `<ModeToggle />` to Navbar | N/A | N/A | Trivial |
| P1-4 | Wishlist page | Users can add to wishlist; no way to view it | No `/wishlist` route | Create wishlist page with SELECT from wishlists + listings | Supabase query | None | Easy |
| P1-5 | Demo data seed (multiple users, bookings, reviews, messages) | App looks empty — bad for placement demo | Only 10 listings for 1 user | N/A | Create users via Supabase Dashboard; SQL seed script | New seed migration | Medium |
| P1-6 | Dynamic homepage stats | "2,400+" is hardcoded and false | Hardcoded array | COUNT query on listings, profiles, distinct cities | Supabase aggregate query | None | Easy |
| P1-7 | Min/max days enforcement on booking | Listing specifies min/max but booking doesn't validate | No validation | Check `totalDays >= listing.min_days && <= listing.max_days` | Could add DB CHECK constraint | None | Easy |
| P1-8 | End date > start date validation | User can submit booking with end before start | Only HTML `min` attribute | Add Zod/manual validation before submit | N/A | N/A | Trivial |
| P1-9 | Admin panel (minimal) | Platform needs some governance | Completely missing | `/admin` route, basic user+listing+booking tables | Admin-only Supabase policies | Add `role` to profiles | Hard |

### P2 — GOOD TO HAVE

| # | Feature | Why | Current State | Frontend | Backend | Database | Difficulty |
|---|---|---|---|---|---|---|---|
| P2-1 | Pagination for Browse | LIMIT 50 silently caps results | Hardcoded | Add page/cursor controls | Update RPC with offset param | None | Medium |
| P2-2 | Booking notifications (in-app) | Owner/renter don't know about status changes without refreshing | None | Notification bell + dropdown | Supabase Realtime on bookings | Add notifications table | Medium |
| P2-3 | Image editing in EditListing | Can't change photos after listing created | Not implemented | Add dropzone + storage management to EditListing | Delete old from Storage, upload new | None | Medium |
| P2-4 | Email notifications (transactional) | Booking accepted/declined emails | None | N/A | Supabase Edge Function → Resend/SendGrid | None | Hard |
| P2-5 | Mobile messages fix | Conversation list hidden on mobile | `hidden sm:flex` | Add mobile-specific tab/back navigation | N/A | None | Easy |
| P2-6 | View count tracking | `view_count` column exists; never incremented | Never incremented | Call RPC or UPDATE on ListingDetail mount | Supabase RPC to increment safely | Existing column | Easy |
| P2-7 | Account deletion | Users have no way to delete account | Not implemented | Add danger zone to Profile | `supabase.auth.admin.deleteUser()` (needs service key) | Cascade deletes exist | Medium |
| P2-8 | User public profile page | No way to view another user's listings/reviews | Not implemented | New route `/profile/:id` | SELECT profile + listings + reviews | None | Medium |
| P2-9 | Terms of Service / Privacy Policy pages | Links exist as `href="#"` | Placeholder | Create static pages | N/A | N/A | Easy |

### P3 — OPTIONAL / ADVANCED

| # | Feature | Why | Current State | Difficulty |
|---|---|---|---|---|
| P3-1 | Payment integration (Razorpay) | Real money collection | Completely missing | Hard |
| P3-2 | SMS notifications | India-specific real-time alerts | Missing | Hard |
| P3-3 | Map view for listings | Visual location browsing | lat/lng stored; no map UI | Hard |
| P3-4 | Dispute resolution system | Owner/renter conflicts | Missing | Hard |
| P3-5 | Advanced analytics dashboard | Earnings charts, rental trends | Missing | Medium |
| P3-6 | ID verification | Real user verification | is_verified exists; no process | Hard |
| P3-7 | Deposit management | Track security deposit lifecycle | Manual currently | Medium |
| P3-8 | Bulk listing management | Owner efficiency | Not implemented | Medium |
| P3-9 | Search suggestions/autocomplete | Better UX | Missing | Medium |
| P3-10 | PWA / mobile app | Better mobile experience | Web only | Hard |

---

## 25. Final Recommended Architecture

Based on the **existing project**, the following architecture is recommended — no technology rewrite needed.

### Frontend
- **Keep:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Zustand + React Router v7
- **Add:** React Query (TanStack Query) for data fetching with caching, background refetch, and pagination
- **Add:** Proper error boundary components
- **Fix:** Remove console.log statements; wire dark mode toggle; fix Messages mobile layout

### Backend
- **Keep:** Supabase as primary BaaS (PostgreSQL + Auth + Storage + Realtime)
- **Add:** Supabase Edge Functions for:
  - Transactional emails (booking notifications via Resend)
  - Secure server-side price calculation verification
  - Payment webhook handling (Razorpay)
- **Add:** Supabase Database Webhooks for notification triggers

### Database
- **Keep:** Existing 7-table schema with all RLS policies
- **Add migrations for:**
  - `role` column on `profiles` (default: 'user')
  - `notifications` table
  - `payment_transactions` table (if payment added)
  - Composite index on `bookings(listing_id, start_date, end_date)`
  - DB function for overlap check
  - Trigger to auto-update `bookings.updated_at` on status change
  - Tighten reviews RLS to require completed booking

### Authentication
- **Keep:** Supabase Auth (email + password)
- **Fix:** Add `/reset-password` page
- **Consider:** Add Google OAuth (single Supabase config line) for better UX

### Storage
- **Keep:** Supabase Storage (`listing-images` bucket)
- **Add:** Storage bucket for avatars (`avatars`)

### Payments
- **Add:** Razorpay (India-focused, test mode, easy JS SDK)
- **Flow:** ListingDetail → Razorpay order → verify webhook → update booking payment_status

### Notifications
- **Add:** In-app notification system (notifications table + Realtime subscription)
- **Add:** Email via Supabase Edge Function + Resend (free tier: 3000 emails/month)

### Admin
- **Add:** `role` column, admin-only RLS policies, `/admin` route with basic management UI

### Deployment
- **Keep:** Vercel (frontend) + Supabase (backend)
- **Add:** Set environment variables in Vercel dashboard (not `.env` file)
- **Add:** Separate Supabase project for production vs development

---

## 26. Implementation Roadmap

### Phase 1 — Fix Broken Existing Functionality (1–2 days)
1. Remove `console.log(email, password)` from `Login.tsx` lines 18, 25
2. Create `/reset-password` page (handle Supabase `updateUser` after magic link)
3. Wire `mode-toggle.tsx` into `Navbar.tsx`
4. Fix Messages mobile layout (add back button / tab navigation)
5. Fix `updated_at` not updating on booking status change (add UPDATE in `updateStatus()`)

### Phase 2 — Complete Core User Functionality (2–3 days)
1. Review submission: add review modal/form on ListingDetail for COMPLETED bookings
2. Avatar upload: wire camera button in Profile.tsx to Supabase Storage
3. Wishlist page: create `/wishlist` route showing saved listings
4. Dynamic homepage stats: replace hardcoded numbers with COUNT queries
5. User public profile page: `/profile/:id`
6. Terms/Privacy static pages

### Phase 3 — Complete Rental/Booking Workflow (2–3 days)
1. Availability calendar: fetch existing PENDING/ACCEPTED bookings on ListingDetail, disable those dates
2. Booking overlap check: query before INSERT, show error if conflict
3. Min/max days validation on booking form
4. End date > start date validation
5. View count increment on ListingDetail mount
6. Mark messages as read on conversation load

### Phase 4 — Admin & Moderation (2–3 days)
1. Add `role` column to `profiles` (default 'user')
2. Add admin-only RLS policies
3. Create `/admin` route with ProtectedRoute + role check
4. Admin dashboard: user list, listing management, booking overview
5. Admin: set user `is_verified = true`

### Phase 5 — Notifications & Messaging (2–3 days)
1. Real-time incoming messages (Postgres changes subscription in Messages.tsx)
2. In-app notification system: create `notifications` table + Realtime subscription + bell icon in Navbar
3. Booking notifications: when owner accepts/declines, create notification for renter
4. Email notifications via Supabase Edge Function + Resend (booking accepted/declined)

### Phase 6 — Security & Validation (1–2 days)
1. Tighten reviews RLS: require booking exists with status=COMPLETED and renter_id=author_id
2. Server-side price verification (Edge Function or DB function)
3. Rate limiting awareness (document Supabase plan limits)
4. Input sanitization review

### Phase 7 — Testing (1–2 days)
1. Write tests for all utility functions
2. Write tests for ProtectedRoute, ListingCard, key form components
3. Write integration tests for booking flow
4. Set up CI (GitHub Actions)

### Phase 8 — Deployment (1 day)
1. Configure Vercel project with env vars from Supabase dashboard
2. Set up production Supabase project (separate from dev)
3. Run migrations on production
4. Remove demo credentials from Login.tsx UI

### Phase 9 — Demo / Placement Polishing (1–2 days)
1. Create realistic seed data: 5+ users, 20+ listings, 10+ bookings, 5+ reviews, 3+ message threads
2. Update homepage stats with real DB counts
3. Fix remaining UI placeholder issues
4. Record a demo walkthrough video / screenshots
5. Write deployment documentation

---

## 27. RENTITOUT — DEFINITION OF DONE

### Authentication
- [ ] Users can register with email + password
- [ ] Email verification flow works end-to-end (email delivered and /verified works)
- [ ] Users can log in with correct credentials
- [ ] Users get a specific error for unverified email
- [ ] Password reset email is sent and /reset-password page exists and works
- [ ] Session persists across browser refresh
- [ ] Logout clears all state

### User Profiles
- [ ] User profile is auto-created on registration
- [ ] User can edit name, city, phone, bio
- [ ] User can upload and change avatar photo
- [ ] Profile changes persist to database

### Listings
- [ ] Authenticated users can create a listing (3-step form)
- [ ] Images upload correctly to Supabase Storage
- [ ] Listing appears in Browse and on Homepage after creation
- [ ] Owner can edit listing (including photos)
- [ ] Owner can toggle listing active/inactive
- [ ] Owner can delete listing
- [ ] Listing detail shows images, description, owner, reviews, availability

### Search & Browse
- [ ] Text search returns relevant results (FTS working)
- [ ] Category filter works
- [ ] Price range filter works
- [ ] City filter works
- [ ] Sort by newest works
- [ ] Sort by price works
- [ ] "Nearest to me" sort works (with browser geolocation)
- [ ] Pagination or "Load more" works (no silent 50-item cap)
- [ ] No results state shown with helpful message

### Booking Workflow
- [ ] Renter can select dates on listing detail
- [ ] Unavailable dates (from existing bookings) are visually blocked
- [ ] Min/max days enforced before submitting
- [ ] End date must be after start date
- [ ] Booking request submitted successfully
- [ ] Owner cannot book their own listing
- [ ] Duplicate/overlapping bookings are prevented
- [ ] Owner sees incoming request in Dashboard → Requests
- [ ] Owner can Accept or Decline a request
- [ ] Owner can mark an accepted booking as Completed
- [ ] Renter can cancel a PENDING booking
- [ ] All status changes reflected in renter's MyRentals
- [ ] Booking price is correctly calculated

### Reviews
- [ ] After a booking is COMPLETED, renter can submit a review (1–5 stars + comment)
- [ ] Review appears on the listing detail page
- [ ] Only completed bookings can be reviewed (enforced DB-side)
- [ ] Each booking can only be reviewed once

### Messaging
- [ ] User can click "Message Owner" from listing detail
- [ ] Message is sent and appears in chat
- [ ] Other party's messages appear without page refresh (real-time)
- [ ] Typing indicator works
- [ ] Messages page works on mobile (can view and switch conversations)

### Dashboard
- [ ] Overview shows correct counts (real DB data, not hardcoded)
- [ ] My Listings shows all owner's listings
- [ ] My Rentals shows all renter's bookings with correct status
- [ ] Requests shows incoming booking requests with correct status
- [ ] Profile settings save correctly

### Admin (Minimum)
- [ ] Admin user role exists in database
- [ ] Admin can access /admin route (regular users cannot)
- [ ] Admin can view all users
- [ ] Admin can set a user as verified
- [ ] Admin can view and manage all listings

### Notifications
- [ ] Pending request badge appears on sidebar when there are pending requests
- [ ] In-app notification created when booking status changes

### UI & Experience
- [ ] Dark mode toggle is accessible and works
- [ ] No hardcoded statistics (all numbers from real DB)
- [ ] No obvious placeholder content (no Lorem Ipsum, no broken links)
- [ ] Terms of Service and Privacy Policy pages exist
- [ ] 404 page works
- [ ] All forms show appropriate validation errors
- [ ] Loading states shown during data fetches
- [ ] Empty states shown when no data

### Security
- [ ] No credentials logged to browser console
- [ ] Demo credentials NOT shown in Login page UI
- [ ] RLS enforced on all tables (verify with a test)
- [ ] Booking price verified server-side or at minimum double-checked

### Data
- [ ] Application works after browser refresh
- [ ] Application works with multiple simultaneous users
- [ ] Realistic demo data exists (5+ users, 20+ listings, bookings, reviews, messages)

### Testing
- [ ] Utility functions have unit tests (coverage > 80% for utils.ts)
- [ ] ProtectedRoute has tests
- [ ] Core booking flow has at least 1 integration test

### Deployment
- [ ] `npm run build` succeeds with 0 TypeScript errors
- [ ] Production build runs correctly on Vercel
- [ ] Environment variables set in Vercel (not in committed .env)
- [ ] Database migrations applied to production Supabase project
- [ ] Application URL shareable and accessible to interviewers

---

# EXECUTIVE SUMMARY

## 1. What Rentitout Currently Is

Rentitout is a **peer-to-peer equipment and item rental marketplace** built for the Indian market. It is a **React 19 + TypeScript SPA** connected to a **Supabase** backend (PostgreSQL, Auth, Storage, Realtime). It targets users who want to lend/borrow tools, cameras, sports gear, music instruments, outdoor equipment, and electronics within Indian cities.

## 2. What Already Works

The following features are genuinely connected to real backend/database functionality:

- User registration (with email verification), login, session persistence, logout, forgot password
- Creating, editing, pausing, and deleting listings with real image upload (Supabase Storage, with Canvas compression)
- Full-text search with PostgreSQL FTS, plus category/price/condition/city filters and Haversine distance sort
- Submitting booking requests with date selection and price calculation
- Owners accepting/declining/completing booking requests
- Renters cancelling pending bookings
- Dashboard with real DB stats (listings count, active rentals, pending requests, total earned)
- Direct peer-to-peer messaging with Supabase Realtime presence (typing indicator)
- Add/remove wishlist items
- Reviews visible on listing detail (from DB)
- Protected routes, RLS-enforced data isolation

## 3. What Is Incomplete

- Password reset: email sends but the landing page (`/reset-password`) does not exist — 404
- Reviews: viewable but cannot be submitted (no form/insert path)
- Messaging: real-time for the sender; receiver must refresh to see new messages
- Avatar upload: UI button exists, no upload logic
- Availability: no calendar, no overlap check — double-booking is possible
- Dark mode: wired in CSS and ThemeProvider but toggle not accessible in Navbar
- Wishlist: add/remove works; no page to view saved items
- Statistics: homepage shows hardcoded numbers (2,400+, 1,800+, 50+)

## 4. The Biggest Technical Problems

1. **`console.log(email, password)` in Login.tsx** — Security risk, must be removed
2. **No `/reset-password` page** — Breaks the password reset flow entirely
3. **No booking overlap/conflict prevention** — Double-booking is a data integrity issue
4. **No review submission UI** — Core marketplace feature (trust) is incomplete
5. **No real-time incoming messages** — Severely limits the chat feature's usefulness
6. **No payment system** — Platform has zero monetary infrastructure

## 5. The Most Important Missing Features (in order)

1. `/reset-password` page
2. Remove `console.log(password)`
3. Review submission form
4. Booking conflict prevention + availability calendar
5. Real-time incoming message delivery
6. Avatar upload
7. Wishlist page
8. Admin panel (basic)
9. In-app notifications
10. Demo data (multiple users, bookings, reviews, messages)

## 6. Recommended Implementation Order

**Week 1 (Days 1–3):** Security fixes + broken features (reset password page, remove console.log, real-time messages, dark mode toggle)

**Week 1 (Days 4–5):** Core UX completions (review submission, avatar upload, wishlist page, availability calendar, booking validation)

**Week 2 (Days 6–8):** Platform features (admin panel, notifications, demo data seeding, dynamic homepage stats)

**Week 2 (Days 9–10):** Polish + deployment (remove demo credentials, production Supabase project, Vercel deploy, fix mobile messages)

## 7. Estimated Overall Project Maturity: **5.5 / 10**

The project has a professional-grade UI, a well-structured codebase, and a meaningful subset of real functionality. The core browse → list → book → manage cycle works end-to-end. However, it is missing too many critical features (payment, review submission, notifications, admin panel, availability enforcement) to be presented as a "complete" full-stack product. With focused effort over 1–2 weeks following this roadmap, it can comfortably reach **8/10** and make a strong impression in a campus placement interview.
