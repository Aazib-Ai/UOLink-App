# Timetable Feature Foundation

This document outlines the frontend foundation for the Timetable feature and the patterns used to keep consistency with the existing application design system and architecture.

## Header Integration

- Adds a `Timetable` button in the application header.
- Signed-out users: header shows only `Register` and `Timetable`.
- Signed-in users: existing configuration retained plus visible `Timetable` button beside `Upload`.
- Uses `next/link` for secure, SPA-friendly navigation.
- Accessibility: `aria-label`, focus-visible rings, and keyboard focus are enabled by default on links.

## Routing and Lazy Loading

- New route: `/timetable` under `src/app/timetable/page.tsx`.
- Metadata configured via Next.js `Metadata` for proper title/description.
- Server/client split mirrors existing pages:
  - `src/components/ServerTimetablePage.tsx` (server)
  - `src/components/ClientTimetable.tsx` (client)
  - `src/components/TimetablePage.tsx` re-exports server page for compatibility.
- Client component is lazy-rendered via `SuspenseWrapper`, aligning with current patterns.

## Design System

- Button styling uses established tokens:
  - Colors: `#90c639` primary, `#7ab332` hover, lime/amber borders.
  - Shapes: `rounded-full` with subtle shadows.
  - Typography: `text-xs` to `md:text-base` responsive sizes.
  - Spacing: `px`, `py` scales consistent with existing components.

## Component Structure

- `ClientTimetable` exports an accessible, empty foundation and a TypeScript interface for future props.
- Placeholder comments indicate where to add timetable data fetching and interactions.

## Security and Performance

- Navigation uses `next/link` and App Router, avoiding unsafe window-based redirects.
- Route-level code splitting via App Router + `SuspenseWrapper` ensures lazy loading.
- No heavy client logic is shipped until timetable functionality is implemented.

## Future Work

- Integrate timetable data sources and filters.
- Add authenticated personalization (e.g., semester, campus).
- Add tests for timetable interactions and SSR hydration.

## Backend Sync (Cron)

- Scheduled Firebase Cloud Function runs every 6 hours to fetch Google Sheet CSVs, parse, and publish `master_timetable.json` to Cloudflare R2.
- Env variables required (configure in Firebase Functions):
  - `SHEET_ID`: Google Sheet ID
  - `TAB_GIDS`: JSON string array of `{ day, gid }` mappings
  - `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET`
- Temporary testing endpoint: `POST /api/timetable/sync` triggers the same publish flow from the Next.js server.
