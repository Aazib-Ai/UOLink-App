# Security Hardening Tasks 6.1–6.4 — Completion Log

This document tracks the completion of the Firestore rules hardening and server-side validation tasks.

## 6.1 — Update Firestore Rules
- Completed.
- Changes:
  - Block client-side writes to `notes/{noteId}/comments/*` and `replies/*`.
  - Enforce owner-only writes on `profiles/{profileId}`.
  - Constrain profile updates to safe fields via `isValidProfileUpdate()`.
  - Keep reads open where appropriate; keep `users/*` subcollections owner-only.

## 6.2 — Server-side API for Comments/Replies with Validation
- Completed.
- `POST /api/notes/[id]/comments/[commentId]/replies` now uses centralized validation:
  - Added `addReplySchema` to `src/lib/security/validation.ts`.
  - The replies POST route now uses `validateRequestJSON(addReplySchema)` for input parsing and sanitization.
  - Transaction still ensures atomic reply creation and parent `replyCount` increment.
- `POST /api/notes/[id]/comments` already uses `addCommentSchema` and centralized validation.

## 6.3 — Client Refactor to Server Endpoints
- Completed.
- Verification:
  - Components and hooks import `addComment` and `addReply` from `@/lib/firebase`, which re-export server API wrappers from `src/lib/api/comments`.
  - No direct imports of client-side `src/lib/firebase/comments.ts` write functions are present in components/hooks.
  - Read-only comment/reply fetches continue to use `firebase/comments` (allowed by rules).

## 6.4 — Tests/Scripts to Validate Rules
- Completed.
- Added `scripts/test-firestore-rules.ts` using `@firebase/rules-unit-testing`.
  - Verifies client writes to `comments` and `replies` are blocked.
  - Verifies owner-only, field-constrained profile updates.
  - Gracefully skips when Firestore emulator isn’t running; instructions provided.
- Added npm script `test:rules`:
  - Run `npm run test:rules`. For full tests, start Firestore emulator and set `FIRESTORE_EMULATOR_PORT` if needed.

---
Status: All tasks 6.1–6.4 have been implemented and documented.
