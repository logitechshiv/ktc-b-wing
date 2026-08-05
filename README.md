# KCT-3 B-Wing Management System

Installable PWA for **Kiran Classic Towers-3, B-Wing**. This is the **frontend phase**: a fully clickable UI running on **mock data** (no backend yet), so the committee can approve the look and flow before any database work.

## Stack
- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (KCT-3 brand palette)
- **PWA**: `manifest.json` + service worker + B-Wing icons (installable on Android & iPhone)

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000 . On a phone, use the browser menu → **Add to Home Screen** to install it.

## What is included
- **Home / Dashboard** — summary tiles, latest notices, pending dues, recent expenses
- **Flats** — floor-wise list (13 floors × 4 = 52 flats, B-101…B-1304), owner & phone, copy number
- **Collections** — recent payments + Add form (role-aware)
- **Expenses** — category · name · amount, share to WhatsApp group
- **Vehicles** — registry by flat, sticker status, search by plate/flat, copy numbers
- **Notices** — announcements board (urgent / payment / maintenance / event)
- **More** — dues + upcoming modules (complaints, documents, reports, etc.)
- **Role switcher** (top-right) — toggle **Super Admin ↔ Editor** to demo permissions:
  - Editor: can **add**, cannot edit/delete
  - Super Admin: full edit/delete on financial records

## Where things live
- `src/lib/types.ts` — data shapes (the contract reused later for MongoDB)
- `src/lib/mock-data.ts` — all dummy data (swap for API calls in the backend phase)
- `src/lib/roles.ts` — permission matrix
- `src/app/*` — screens · `src/components/*` — UI

## Next phase (backend)
Replace the reads in `mock-data.ts` with API routes (`src/app/api/*`) backed by **MongoDB Atlas**, add **Auth.js** login for the Super Admin/Editor roles, and deploy to **Vercel**. The data shapes already match, so this is mostly plumbing.

_Real flat/owner data will be imported later from Excel; dummy data is used here only for the UI._
