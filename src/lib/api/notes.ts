import { getIdToken, requireOk } from '@/lib/api/client'
import type { VoteOnNoteResult, ToggleSaveNoteResult } from '@/lib/data/types'

interface NoteUpdateData {
  name?: string
  subject?: string
  teacher?: string
  semester?: string
}

export async function voteOnNote(noteId: string, voteType: 'up' | 'down'): Promise<VoteOnNoteResult> {
  return await requireOk<VoteOnNoteResult>(
    `/api/notes/${encodeURIComponent(noteId)}/vote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: voteType }),
    },
    { requireAuth: true }
  )
}

export async function toggleSaveNote(noteId: string): Promise<ToggleSaveNoteResult> {
  return await requireOk<ToggleSaveNoteResult>(
    `/api/notes/${encodeURIComponent(noteId)}/save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
    { requireAuth: true }
  )
}

export async function updateNote(noteId: string, data: NoteUpdateData): Promise<void> {
  await requireOk<void>(
    `/api/notes/${encodeURIComponent(noteId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    },
    { requireAuth: true }
  )
}

export async function deleteNote(noteId: string): Promise<void> {
  await requireOk<void>(
    `/api/notes/${encodeURIComponent(noteId)}`,
    { method: 'DELETE' },
    { requireAuth: true }
  )
}
