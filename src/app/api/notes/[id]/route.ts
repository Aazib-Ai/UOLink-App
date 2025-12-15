import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue, FieldPath } from 'firebase-admin/firestore'
import { validateNoteOwnership } from '@/lib/auth/ownership'
import { getR2Client, getR2BucketName } from '@/lib/r2'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { logAuditEvent, logSecurityEvent, startRouteSpan, endRouteSpan, getRequestContext } from '@/lib/security/logging'
import { enforceNoteSchemaOnWrite } from '@/lib/data/note-schema'
import { invalidateTags } from '@/lib/cache/query-cache'
import { normalizeForStorage } from '@/lib/utils'

const sanitizeString = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : ''
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    return withAuth(request, async ({ user }) => {
  const { id: noteId } = await context.params
        if (!noteId) {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
        }

        const db = getAdminDb()
        const span = startRouteSpan('notes.patch', request, user.uid)

        let body: any
        try {
            body = await request.json()
        } catch {
            body = {}
        }

        const name = sanitizeString(body?.name)
        const subject = sanitizeString(body?.subject)
        const teacher = sanitizeString(body?.teacher)
        const semesterRaw = body?.semester
        const sectionRaw = body?.section
        const materialSequenceRaw = body?.materialSequence

        try {
            await db.runTransaction(async (tx) => {
                const noteRef = db.collection('notes').doc(noteId)
                const noteSnap = await tx.get(noteRef)
                if (!noteSnap.exists) {
                    throw new Error('NOT_FOUND')
                }

                const noteData = noteSnap.data() || {}
                // Ownership enforcement
                validateNoteOwnership(noteData, user.uid)

                const updateData: Record<string, any> = {
                    updatedAt: FieldValue.serverTimestamp(),
                }

                if (name) updateData.name = name
                if (subject) updateData.subject = subject
                if (teacher) {
                    updateData.teacher = teacher
                    // Maintain existing pattern: module mirrors teacher
                    updateData.module = teacher
                }
                // Normalize semester/section/materialSequence via schema enforcement
                const normalizedWrite = enforceNoteSchemaOnWrite({
                  semester: semesterRaw,
                  section: sectionRaw,
                  materialType: typeof noteData.materialType === 'string' ? noteData.materialType : '',
                  materialSequence: materialSequenceRaw,
                })

                if (typeof semesterRaw !== 'undefined') updateData.semester = normalizedWrite.semester
                if (typeof sectionRaw !== 'undefined') updateData.section = normalizedWrite.section
                if (typeof materialSequenceRaw !== 'undefined') updateData.materialSequence = normalizedWrite.materialSequence

                tx.set(noteRef, updateData, { merge: true })
            })
            const { ipAddress, userAgent } = getRequestContext(request)
            try {
              const semesterTag = `semester:${normalizeForStorage(sanitizeString(semesterRaw))}`
              await invalidateTags(['notes', 'initial', semesterTag, 'leaderboard'])
            } catch {}
            await logAuditEvent({
              action: 'NOTE_UPDATE',
              resource: noteId,
              userId: user.uid,
              ipAddress,
              userAgent,
              correlationId: span.correlationId,
              details: { fieldsUpdated: Object.keys(body || {}) },
            })
            await endRouteSpan(span, 200)
            return ok({ success: true })
        } catch (error: any) {
            if (error?.code === 'ACCESS_DENIED') {
                await endRouteSpan(span, 403, error)
                return apiErrorByKey(403, 'ACCESS_DENIED', 'Access denied')
            }
            if (error instanceof Error && error.message === 'NOT_FOUND') {
                await endRouteSpan(span, 404, error)
                return apiErrorByKey(404, 'NOT_FOUND', 'Note not found')
            }
            await endRouteSpan(span, 500, error)
            return apiErrorByKey(500, 'INTERNAL_ERROR', 'Failed to update note')
        }
    })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    return withAuth(request, async ({ user }) => {
  const { id: noteId } = await context.params
        if (!noteId) {
            return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
        }

        const db = getAdminDb()
        const span = startRouteSpan('notes.delete', request, user.uid)

        let storageKeyToDelete: string | null = null
        let storageBucket: string | null = null

        try {
            await db.runTransaction(async (tx) => {
                const noteRef = db.collection('notes').doc(noteId)
                const noteSnap = await tx.get(noteRef)
                if (!noteSnap.exists) {
                    throw new Error('NOT_FOUND')
                }

                const noteData = noteSnap.data() || {}
                // Ownership enforcement
                validateNoteOwnership(noteData, user.uid)

                // Capture storage metadata for deletion after transaction
                const storageKey = typeof noteData.storageKey === 'string' ? noteData.storageKey.trim() : ''
                storageKeyToDelete = storageKey || null
                storageBucket = typeof noteData.storageBucket === 'string' ? noteData.storageBucket : null

                // Delete the note document
                tx.delete(noteRef)
            })

            try {
              const noteVotesRef = db.collection('noteVotes').doc(noteId)
              await noteVotesRef.delete()
            } catch {}

            try {
              const savedGroupSnap = await db.collectionGroup('savedNotes').where(FieldPath.documentId(), '==', noteId).get()
              if (!savedGroupSnap.empty) {
                const batch = db.batch()
                const affectedUsers = new Set<string>()
                savedGroupSnap.docs.forEach((docSnap) => {
                  batch.delete(docSnap.ref)
                  const userId = docSnap.ref.parent.parent?.id
                  if (userId) affectedUsers.add(userId)
                })
                await batch.commit()
                const idxBatch = db.batch()
                affectedUsers.forEach((uid) => {
                  const interactionRef = db.collection('users').doc(uid).collection('interactionIndex').doc('index')
                  idxBatch.set(interactionRef, { saved: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
                  const savedIndexRef = db.collection('users').doc(uid).collection('savedNotesIndex').doc('savedNotesIndex')
                  idxBatch.set(savedIndexRef, { ids: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
                })
                await idxBatch.commit()
              }
            } catch {}

            try {
              const votesGroupSnap = await db.collectionGroup('votes').where(FieldPath.documentId(), '==', noteId).get()
              if (!votesGroupSnap.empty) {
                const batch = db.batch()
                const affectedUsers = new Set<string>()
                votesGroupSnap.docs.forEach((docSnap) => {
                  batch.delete(docSnap.ref)
                  const userId = docSnap.ref.parent.parent?.id
                  if (userId) affectedUsers.add(userId)
                })
                await batch.commit()
                const idxBatch = db.batch()
                affectedUsers.forEach((uid) => {
                  const votesIndexRef = db.collection('users').doc(uid).collection('votesIndex').doc('index')
                  idxBatch.set(votesIndexRef, { up: FieldValue.arrayRemove(noteId), down: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
                  const interactionRef = db.collection('users').doc(uid).collection('interactionIndex').doc('index')
                  idxBatch.set(interactionRef, { up: FieldValue.arrayRemove(noteId), down: FieldValue.arrayRemove(noteId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
                })
                await idxBatch.commit()
              }
            } catch {}

            try {
              const commentsSnap = await db.collection('notes').doc(noteId).collection('comments').get()
              if (!commentsSnap.empty) {
                for (const commentDoc of commentsSnap.docs) {
                  const repliesSnap = await commentDoc.ref.collection('replies').get()
                  if (!repliesSnap.empty) {
                    const repliesBatch = db.batch()
                    repliesSnap.docs.forEach((r) => repliesBatch.delete(r.ref))
                    await repliesBatch.commit()
                  }
                }
                const commentsBatch = db.batch()
                commentsSnap.docs.forEach((c) => commentsBatch.delete(c.ref))
                await commentsBatch.commit()
              }
            } catch {}

            // Delete associated R2 file if applicable (outside transaction)
            if (storageKeyToDelete) {
                try {
                    const client = getR2Client()
                    const bucket = storageBucket || getR2BucketName()
                    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: storageKeyToDelete })
                    await client.send(cmd)
                } catch (r2Error) {
                    // Log and continue; file deletion failures should not block note deletion
                    console.warn('[notes.delete] R2 deletion failed:', r2Error)
                }
            }

            const { ipAddress, userAgent } = getRequestContext(request)
            try {
              await invalidateTags(['notes', 'initial', 'leaderboard'])
            } catch {}
            await logAuditEvent({
              action: 'NOTE_DELETE',
              resource: noteId,
              userId: user.uid,
              ipAddress,
              userAgent,
              correlationId: span.correlationId,
              details: { storageKey: storageKeyToDelete, bucket: storageBucket },
            })
            await logSecurityEvent({
              type: 'DATA_ACCESS',
              severity: 'LOW',
              userId: user.uid,
              ipAddress,
              userAgent,
              endpoint: span.endpoint,
              correlationId: span.correlationId,
              details: { action: 'delete_note', noteId },
            })
            await endRouteSpan(span, 200)
            return ok({ success: true })
        } catch (error: any) {
            if (error?.code === 'ACCESS_DENIED') {
                await endRouteSpan(span, 403, error)
                return apiErrorByKey(403, 'ACCESS_DENIED', 'Access denied')
            }
            if (error instanceof Error && error.message === 'NOT_FOUND') {
                await endRouteSpan(span, 404, error)
                return apiErrorByKey(404, 'NOT_FOUND', 'Note not found')
            }
            await endRouteSpan(span, 500, error)
            return apiErrorByKey(500, 'INTERNAL_ERROR', 'Failed to delete note')
        }
    })
}
