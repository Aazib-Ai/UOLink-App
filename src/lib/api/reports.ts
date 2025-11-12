import { getIdToken, getIdTokenOptional, requireOk, authorizedJson } from '@/lib/api/client'

export interface ReportStatus {
  hasReported: boolean
  reportCount: number
}

// Token helpers are centralized in src/lib/api/client

export async function reportNote(noteId: string, reason: string, description?: string): Promise<boolean> {
  await requireOk(`/api/notes/${encodeURIComponent(noteId)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, description }),
  }, { requireAuth: true })
  return true
}

export async function undoReport(noteId: string): Promise<boolean> {
  await requireOk(`/api/notes/${encodeURIComponent(noteId)}/report`, { method: 'DELETE' }, { requireAuth: true })
  return true
}

export async function getReportStatus(noteId: string): Promise<ReportStatus> {
  const response = await authorizedJson<ReportStatus>(
    `/api/notes/${encodeURIComponent(noteId)}/report`,
    { method: 'GET' },
    { requireAuth: false }
  )
  if ((response as any)?.data) return (response as any).data as ReportStatus
  const err = response as any
  throw new Error(err?.error || 'Failed to get report status')
}
