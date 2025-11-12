import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { readNoteScoreState, buildNoteScoreUpdate } from '@/lib/data/note-utils'
import { enforceRateLimitOr429, rateLimitKeyByUser } from '@/lib/security/rateLimit'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async ({ user }) => {
    const { id: noteId } = await context.params
    if (!noteId) {
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
    }

    // Per-user save toggle rate limit: 20/min
    const rl = await enforceRateLimitOr429(request, 'like', rateLimitKeyByUser(user.uid, 'like'), user.email || undefined)
    if (!rl.allowed) return rl.response

    const db = getAdminDb()

    try {
      const result = await db.runTransaction(async (tx) => {
        const noteRef = db.collection('notes').doc(noteId)
        const noteSnap = await tx.get(noteRef)
        if (!noteSnap.exists) {
          throw new Error('NOT_FOUND')
        }

        const userSaveRef = db.collection('users').doc(user.uid).collection('savedNotes').doc(noteId)
        const saveSnap = await tx.get(userSaveRef)

        const timestamp = FieldValue.serverTimestamp() as any
        const noteData = noteSnap.data() || {}
        const scoreState = readNoteScoreState(noteData)

        let saveCount = scoreState.saveCount
        let auraDelta = 0
        let saved = false

        if (saveSnap.exists) {
          saveCount = Math.max(0, saveCount - 1)
          tx.delete(userSaveRef)
          auraDelta -= 5
          saved = false
        } else {
          saveCount = saveCount + 1
          tx.set(userSaveRef, { noteId, savedAt: FieldValue.serverTimestamp() })
          auraDelta += 5
          saved = true
        }

        const noteScoreUpdate = buildNoteScoreUpdate(scoreState, { saveCount }, timestamp)
        tx.set(noteRef, noteScoreUpdate, { merge: true })

        const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined
        if (uploaderId && Number.isFinite(auraDelta) && auraDelta !== 0) {
          const profileRef = db.collection('profiles').doc(uploaderId)
          tx.set(
            profileRef,
            { aura: FieldValue.increment(auraDelta), auraUpdatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          )
        }

        return { saved, saveCount: noteScoreUpdate.saveCount, credibilityScore: noteScoreUpdate.credibilityScore }
      })

      const resp = ok(result)
      resp.headers.set('X-RateLimit-Limit', rl.headers['X-RateLimit-Limit'])
      resp.headers.set('X-RateLimit-Remaining', rl.headers['X-RateLimit-Remaining'])
      resp.headers.set('X-RateLimit-Reset', rl.headers['X-RateLimit-Reset'])
      return resp
    } catch (err: any) {
      if (err?.message === 'NOT_FOUND') {
        return apiErrorByKey(404, 'NOT_FOUND', 'Note not found')
      }
      return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to toggle save')
    }
  })
}
