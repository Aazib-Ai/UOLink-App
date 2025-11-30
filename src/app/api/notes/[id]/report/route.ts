import { NextRequest } from 'next/server'
import { withAuth, getTokenFromRequest } from '@/lib/auth/authenticate'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { readNoteScoreState, buildNoteScoreUpdate } from '@/lib/data/note-utils'
import { logRequestStart, logRequestEnd, logApiError } from '@/lib/api/logger'
import { enforceRateLimitOr429, rateLimitKeyByUser } from '@/lib/security/rateLimit'

interface ReportBody { reason?: string; description?: string }

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withAuth(request, async ({ user }) => {
        const ctx = logRequestStart('/api/notes/[id]/report:POST', request, user.uid)
        const { id: noteId } = await context.params
        if (!noteId) {
            logRequestEnd(ctx, 400)
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
        }

        // Per-user report limit: 10/min
        const rl = await enforceRateLimitOr429(request, 'comment', rateLimitKeyByUser(user.uid, 'comment'), user.email || undefined)
        if (!rl.allowed) return rl.response

        let body: ReportBody
        try {
            body = await request.json()
        } catch {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid JSON body')
        }

        const reason = (body?.reason || '').trim()
        const description = (body?.description || '').trim()
        if (!reason) {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'reason is required')
        }

        const db = getAdminDb()

        try {
            await db.runTransaction(async (tx) => {
                const noteRef = db.collection('notes').doc(noteId)
                const noteSnap = await tx.get(noteRef)
                if (!noteSnap.exists) {
                    throw new Error('NOT_FOUND')
                }

                const reportRef = db.collection('reports').doc(`${noteId}_${user.uid}`)
                const reportSnap = await tx.get(reportRef)
                if (reportSnap.exists) {
                    throw new Error('ALREADY_REPORTED')
                }

                const timestamp = FieldValue.serverTimestamp() as any
                const noteData = noteSnap.data() || {}
                const scoreState = readNoteScoreState(noteData)
                const reportCount = scoreState.reportCount + 1
                const noteScoreUpdate = buildNoteScoreUpdate(scoreState, { reportCount }, timestamp)

                tx.set(reportRef, {
                    noteId,
                    userId: user.uid,
                    userEmail: user.email ?? null,
                    reason,
                    description: description || null,
                    status: 'pending',
                    createdAt: FieldValue.serverTimestamp(),
                    reviewedAt: null,
                    reviewedBy: null,
                })

                tx.set(
                    noteRef,
                    { ...noteScoreUpdate, lastReportedAt: FieldValue.serverTimestamp() },
                    { merge: true }
                )

                const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined
                if (uploaderId) {
                    const profileRef = db.collection('profiles').doc(uploaderId)
                    const prevCred = Number((noteData as any).credibilityScore || 0)
                    const nextCred = Number(noteScoreUpdate.credibilityScore || prevCred)
                    const credDelta = nextCred - prevCred

                    const profSnap = await tx.get(profileRef)
                    const pData = profSnap.exists ? (profSnap.data() as any) : {}
                    const totalNotes = Number(pData.totalNotes || pData.notesCount || 0)
                    const avg = Number(pData.averageCredibility || 0)
                    const sumPrev = avg * totalNotes
                    const sumNext = sumPrev + credDelta
                    const avgNext = totalNotes > 0 ? sumNext / totalNotes : 0

                    tx.set(
                        profileRef,
                        {
                            aura: FieldValue.increment(-10),
                            auraUpdatedAt: FieldValue.serverTimestamp(),
                            totalReports: FieldValue.increment(1),
                            averageCredibility: avgNext,
                            lastStatsUpdate: FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    )
                }
            })

            logRequestEnd(ctx, 200)
            const resp = ok({ success: true })
            resp.headers.set('X-RateLimit-Limit', rl.headers['X-RateLimit-Limit'])
            resp.headers.set('X-RateLimit-Remaining', rl.headers['X-RateLimit-Remaining'])
            resp.headers.set('X-RateLimit-Reset', rl.headers['X-RateLimit-Reset'])
            return resp
        } catch (err: any) {
            logApiError('/api/notes/[id]/report:POST', err)
            if (err?.message === 'NOT_FOUND') {
                logRequestEnd(ctx, 404)
                return apiErrorByKey(404, 'NOT_FOUND', 'Note not found')
            }
            if (err?.message === 'ALREADY_REPORTED') {
                logRequestEnd(ctx, 409)
                return apiErrorByKey(409, 'ALREADY_EXISTS', 'You have already reported this content')
            }
            logRequestEnd(ctx, 500)
            return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to report content')
        }
    })
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withAuth(request, async ({ user }) => {
        const ctx = logRequestStart('/api/notes/[id]/report:DELETE', request, user.uid)
        const { id: noteId } = await context.params
        if (!noteId) {
            logRequestEnd(ctx, 400)
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
        }

        // Per-user report undo limit: 10/min
        const rl = await enforceRateLimitOr429(request, 'comment', rateLimitKeyByUser(user.uid, 'comment'), user.email || undefined)
        if (!rl.allowed) return rl.response

        const db = getAdminDb()

        try {
            await db.runTransaction(async (tx) => {
                const noteRef = db.collection('notes').doc(noteId)
                const noteSnap = await tx.get(noteRef)
                if (!noteSnap.exists) {
                    throw new Error('NOT_FOUND')
                }

                const reportRef = db.collection('reports').doc(`${noteId}_${user.uid}`)
                const reportSnap = await tx.get(reportRef)
                if (!reportSnap.exists) {
                    throw new Error('REPORT_NOT_FOUND')
                }

                const timestamp = FieldValue.serverTimestamp() as any
                const noteData = noteSnap.data() || {}
                const scoreState = readNoteScoreState(noteData)
                const reportCount = Math.max(0, scoreState.reportCount - 1)
                const noteScoreUpdate = buildNoteScoreUpdate(scoreState, { reportCount }, timestamp)

                tx.delete(reportRef)

                tx.set(noteRef, { ...noteScoreUpdate, lastReportedAt: null }, { merge: true })

                const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined
                if (uploaderId) {
                    const profileRef = db.collection('profiles').doc(uploaderId)
                    const prevCred = Number((noteData as any).credibilityScore || 0)
                    const nextCred = Number(noteScoreUpdate.credibilityScore || prevCred)
                    const credDelta = nextCred - prevCred

                    const profSnap = await tx.get(profileRef)
                    const pData = profSnap.exists ? (profSnap.data() as any) : {}
                    const totalNotes = Number(pData.totalNotes || pData.notesCount || 0)
                    const avg = Number(pData.averageCredibility || 0)
                    const sumPrev = avg * totalNotes
                    const sumNext = sumPrev + credDelta
                    const avgNext = totalNotes > 0 ? sumNext / totalNotes : 0

                    tx.set(
                        profileRef,
                        {
                            aura: FieldValue.increment(10),
                            auraUpdatedAt: FieldValue.serverTimestamp(),
                            totalReports: FieldValue.increment(-1),
                            averageCredibility: avgNext,
                            lastStatsUpdate: FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    )
                }
            })

            logRequestEnd(ctx, 200)
            const resp = ok({ success: true })
            resp.headers.set('X-RateLimit-Limit', rl.headers['X-RateLimit-Limit'])
            resp.headers.set('X-RateLimit-Remaining', rl.headers['X-RateLimit-Remaining'])
            resp.headers.set('X-RateLimit-Reset', rl.headers['X-RateLimit-Reset'])
            return resp
        } catch (err: any) {
            logApiError('/api/notes/[id]/report:DELETE', err)
            if (err?.message === 'NOT_FOUND') {
                logRequestEnd(ctx, 404)
                return apiErrorByKey(404, 'NOT_FOUND', 'Note not found')
            }
            if (err?.message === 'REPORT_NOT_FOUND') {
                logRequestEnd(ctx, 404)
                return apiErrorByKey(404, 'NOT_FOUND', 'No report found to undo')
            }
            logRequestEnd(ctx, 500)
            return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to undo report')
        }
    })
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const ctx = logRequestStart('/api/notes/[id]/report:GET', request)
    const { id: noteId } = await context.params
    if (!noteId) {
        logRequestEnd(ctx, 400)
        return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
    }

    const db = getAdminDb()

    try {
        const noteRef = db.collection('notes').doc(noteId)
        const noteSnap = await noteRef.get()
        if (!noteSnap.exists) {
            logRequestEnd(ctx, 404)
            return apiErrorByKey(404, 'NOT_FOUND', 'Note not found')
        }

        const reportCount = Math.max(0, (noteSnap.data()?.reportCount as number) || 0)

        // Optional auth: hasReported requires authentication
        let hasReported = false
        const token = getTokenFromRequest(request)
        if (token) {
            try {
                const decoded = await getAdminAuth().verifyIdToken(token)
                const uid = decoded.uid
                const reportRef = db.collection('reports').doc(`${noteId}_${uid}`)
                const reportSnap = await reportRef.get()
                hasReported = reportSnap.exists
            } catch (verifyErr) {
                // Ignore token errors for GET; treat as unauthenticated
                hasReported = false
            }
        }

        logRequestEnd(ctx, 200)
        return ok({ hasReported, reportCount })
    } catch (err: any) {
        logApiError('/api/notes/[id]/report:GET', err)
        logRequestEnd(ctx, 500)
        return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to get report status')
    }
}

