# Timetable Sync (Cron)

This document explains the automated backend job that fetches timetable data from a public Google Sheet, parses CSVs, and publishes a consolidated JSON file to Cloudflare R2.

## Overview

- Cron schedule: daily at 06:00 PKT (Asia/Karachi) via Firebase Cloud Functions.
- Testing: temporary button on `/timetable` page calls `POST /api/timetable/sync`.
- Output: `master_timetable.json` stored in R2, read by UOLink clients.

## Environment Variables

Configure these in Firebase Functions:

- `SHEET_ID`: Google Sheet ID.
- `TAB_GIDS`: JSON string array of objects with `{ day, gid }`.
  - Example: `[{"day":"Monday","gid":"0"},{"day":"Tuesday","gid":"12345"}]`
- `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` / `CLOUDFLARE_R2_ACCOUNT_ID`: R2 credentials.
- `CLOUDFLARE_R2_BUCKET`: Target bucket (e.g., `uolink-prod`).

Example file: `functions/.env.example`.

## Deployment

1. Install dependencies in `functions/`.
2. Set runtime environment variables for the function (`SHEET_ID`, `TAB_GIDS`, `CLOUDFLARE_*`, `CLOUDFLARE_R2_BUCKET`). Recommended: use Firebase Console → Build → Functions → `scheduleTimetableFetch` → Variables.
3. Deploy the function: `firebase deploy --only functions:scheduleTimetableFetch` (or `firebase deploy --only functions` to deploy all functions).
4. Verify in Firebase Console → Functions that the next run is scheduled for 06:00 Asia/Karachi.

## Notes

- CSV parsing in Functions uses a simple stub; the Next.js API uses the full parser. Align them later if needed.
- Google Sheet tabs are fetched via public CSV export links; no auth required.
- Cloudflare R2 uses S3-compatible API with `endpoint=https://<account>.r2.cloudflarestorage.com`.
