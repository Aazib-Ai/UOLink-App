import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { readNoteScoreState, buildNoteScoreUpdate } from '@/lib/data/note-utils'
import { enforceRateLimitOr429, rateLimitKeyByUser, enforceCooldownOr429 } from '@/lib/security/rateLimit'

interface VoteBody { type?: 'up' | 'down' }

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withAuth(request, async ({ user }) => {
        const { id: noteId } = await context.params
        if (!noteId) {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
        }

        // 2s cooldown to debounce rapid toggles
        const cd = await enforceCooldownOr429(request, `noteVote:${user.uid}:${noteId}`, 2000)
        if (!cd.allowed) return cd.response

        // Per-user like/vote rate limit: 20/min
        const rl = await enforceRateLimitOr429(request, 'like', rateLimitKeyByUser(user.uid, 'like'), user.email || undefined)
        if (!rl.allowed) return rl.response

        let body: VoteBody
        try {
            body = await request.json()
        } catch {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid JSON body')
        }

        const type = body?.type
        if (type !== 'up' && type !== 'down') {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'type must be "up" or "down"')
        }

        const db = getAdminDb()

        try {
            const result = await db.runTransaction(async (tx) => {
                const noteRef = db.collection('notes').doc(noteId)
                const noteSnap = await tx.get(noteRef)
                if (!noteSnap.exists) {
                    throw new Error('NOT_FOUND')
                }

                const noteVoteRef = db.collection('noteVotes').doc(noteId)
                const userVoteRef = db.collection('userVotes').doc(user.uid).collection('votes').doc(noteId)

                const [noteVoteSnap, userVoteSnap] = await Promise.all([
                    tx.get(noteVoteRef),
                    tx.get(userVoteRef),
                ])

                const timestamp = FieldValue.serverTimestamp() as any
                const noteData = noteSnap.data() || {}
                const scoreState = readNoteScoreState(noteData)

                let upvotes = Math.max(0, (noteVoteSnap.data()?.upvotes as number) || 0)
                let downvotes = Math.max(0, (noteVoteSnap.data()?.downvotes as number) || 0)
                const storedVote = (userVoteSnap.exists ? userVoteSnap.data()?.voteType : null) as ('up' | 'down' | null)
                let nextVote: 'up' | 'down' | null = type
                let auraDelta = 0

                if (storedVote === type) {
                    if (type === 'up') {
                        upvotes = Math.max(0, upvotes - 1)
                        auraDelta -= 2
                    } else {
                        downvotes = Math.max(0, downvotes - 1)
                        auraDelta += 3
                    }
                    tx.delete(userVoteRef)
                    nextVote = null
                } else {
                    if (storedVote === 'up') {
                        upvotes = Math.max(0, upvotes - 1)
                        auraDelta -= 2
                    } else if (storedVote === 'down') {
                        downvotes = Math.max(0, downvotes - 1)
                        auraDelta += 3
                    }

                    if (type === 'up') {
                        upvotes += 1
                        auraDelta += 2
                    } else {
                        downvotes += 1
                        auraDelta -= 3
                    }

                    tx.set(
                        userVoteRef,
                        { noteId, voteType: type, votedAt: FieldValue.serverTimestamp() },
                        { merge: true }
                    )
                }

                tx.set(
                    noteVoteRef,
                    { upvotes, downvotes, updatedAt: FieldValue.serverTimestamp() },
                    { merge: true }
                )

                const noteScoreUpdate = buildNoteScoreUpdate(
                    scoreState,
                    { upvoteCount: upvotes, downvoteCount: downvotes },
                    timestamp
                )

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

                const votesIndexRef = db.collection('users').doc(user.uid).collection('votesIndex').doc('index')
                if (nextVote === 'up') {
                    tx.set(
                        votesIndexRef,
                        { up: FieldValue.arrayUnion(noteId), down: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() },
                        { merge: true }
                    )
                } else if (nextVote === 'down') {
                    tx.set(
                        votesIndexRef,
                        { down: FieldValue.arrayUnion(noteId), up: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() },
                        { merge: true }
                    )
                } else {
                    tx.set(
                        votesIndexRef,
                        { up: FieldValue.arrayRemove(noteId), down: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() },
                        { merge: true }
                    )
                }

                return { upvotes, downvotes, userVote: nextVote, credibilityScore: noteScoreUpdate.credibilityScore }
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
            return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to vote on note')
        }
    })
}

