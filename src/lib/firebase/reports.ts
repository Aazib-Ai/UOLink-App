// Client-side report mutations have been migrated to server APIs.
// This module intentionally does not expose mutation functions to prevent direct Firestore writes.
// If you need to report, undo, or check status, use the wrappers in `lib/api/reports`.

export function reportContent(): never {
  throw new Error('Deprecated: use lib/api/reports.reportNote instead')
}

export function getReportStatus(): never {
  throw new Error('Deprecated: use lib/api/reports.getReportStatus instead')
}

export function undoReport(): never {
  throw new Error('Deprecated: use lib/api/reports.undoReport instead')
}
