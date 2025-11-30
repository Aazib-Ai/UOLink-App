import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { withAuth } from '@/lib/auth/authenticate'
import { validateProfileOwnership } from '@/lib/auth/ownership'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { slugify, normalizeForStorage } from '@/lib/utils'
import { profileUpdateSchema } from '@/lib/security/validation'
import { toPublicProfile } from '@/lib/security/sanitization'
import { FieldValue } from 'firebase-admin/firestore'
import { enforceRateLimitOr429, rateLimitKeyByUser } from '@/lib/security/rateLimit'
import { moderateProfileFields } from '@/lib/security/moderation'
import { getRequestContext, logSecurityEvent, generateCorrelationId } from '@/lib/security/logging'
import { logAuditEvent, startRouteSpan, endRouteSpan } from '@/lib/security/logging'
import { secureRoute } from '@/lib/security/middleware'
import { z } from 'zod'

interface PatchBody {
    fullName?: string
    major?: string
    semester?: string
    section?: string
    bio?: string
    about?: string
    skills?: string[]
    githubUrl?: string
    linkedinUrl?: string
    instagramUrl?: string
    facebookUrl?: string
    profilePicture?: string | null
    profilePictureStorageKey?: string | null
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ uid: string }> }
) {
    return withAuth(request, async ({ user }) => {
        const { uid } = await context.params
        try {
            validateProfileOwnership(user.uid, uid)
        } catch (err: any) {
            return apiErrorByKey(403, 'FORBIDDEN', err?.message)
        }

        try {
            const db = getAdminDb()
            const docRef = db.collection('profiles').doc(uid)
            const snap = await docRef.get()
            if (!snap.exists) {
                return apiErrorByKey(404, 'NOT_FOUND', 'Profile not found')
            }
            const data = snap.data() || {}
            const minimized = toPublicProfile({ id: uid, ...data })
            return ok(minimized)
        } catch (error: any) {
            return apiErrorByKey(500, 'VALIDATION_ERROR', error?.message || 'Failed to fetch profile')
        }
    })
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ uid: string }> }
) {
    const bodySchema = profileUpdateSchema
    return secureRoute<PatchBody>(
        { routeName: 'profiles.patch', requireAuth: true, rateLimitPreset: 'profile', schema: bodySchema },
        async ({ request, user, body }) => {
            const { uid } = await context.params
            const span = startRouteSpan('profiles.patch', request, user!.uid)
            try {
                validateProfileOwnership(user!.uid, uid)
            } catch (err: any) {
                await endRouteSpan(span, 403, err)
                return apiErrorByKey(403, 'FORBIDDEN', err?.message)
            }

            if (!body) {
                await endRouteSpan(span, 400)
                return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid request body')
            }

            // Content moderation for profile text fields
            const mod = moderateProfileFields(body as any)
            if (!mod.allowed) {
                const { ipAddress, userAgent } = getRequestContext(request)
                await logSecurityEvent({
                    type: 'SUSPICIOUS_ACTIVITY',
                    severity: 'MEDIUM',
                    userId: user!.uid,
                    endpoint: request.nextUrl?.pathname,
                    ipAddress,
                    userAgent,
                    correlationId: generateCorrelationId(),
                    details: { reason: 'profile_content_violation', score: mod.score, violations: mod.violations },
                })
                return apiErrorByKey(400, 'CONTENT_VIOLATION', 'Your profile contains content that violates policy.')
            }

            // Validate profile picture storage key ownership if provided
            if (typeof body.profilePictureStorageKey === 'string' && body.profilePictureStorageKey) {
                const key = body.profilePictureStorageKey.trim()
                if (!key.startsWith(`profile-pictures/${user!.uid}-`)) {
                    await endRouteSpan(span, 400)
                    return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid profile picture storage key for this user')
                }
            }

            const fullName = body.fullName || ''
            const updateData: Record<string, any> = {
                fullName,
                fullNameLower: fullName ? normalizeForStorage(fullName) : undefined,
                profileSlug: fullName ? slugify(fullName) : undefined,
                major: body.major || undefined,
                semester: body.semester || undefined,
                section: body.section || undefined,
                bio: (mod.sanitized.bio ?? body.bio) || undefined,
                about: (mod.sanitized.about ?? body.about) || undefined,
                skills: Array.isArray(mod.sanitized.skills) ? mod.sanitized.skills.filter(Boolean) : Array.isArray(body.skills) ? body.skills.filter(Boolean) : undefined,
                githubUrl: body.githubUrl || undefined,
                linkedinUrl: body.linkedinUrl || undefined,
                instagramUrl: body.instagramUrl || undefined,
                facebookUrl: body.facebookUrl || undefined,
                profilePicture: body.profilePicture ?? undefined,
                profilePictureStorageKey: body.profilePictureStorageKey ?? undefined,
                profileCompleted: true,
                updatedAt: FieldValue.serverTimestamp(),
            }

            // Remove undefined keys to avoid overwriting
            Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k])

            try {
                const db = getAdminDb()
                const docRef = db.collection('profiles').doc(uid)
                const snap = await docRef.get()
                if (!snap.exists) {
                    await docRef.set({
                        ...updateData,
                        aura: 0,
                        createdAt: FieldValue.serverTimestamp(),
                    })
                } else {
                    await docRef.update(updateData)
                }

                const updated = await docRef.get()
                const resp = ok(toPublicProfile({ id: uid, ...(updated.data() || {}) }))
                // Rate limit headers applied by middleware
                const { ipAddress, userAgent } = getRequestContext(request)
                await logAuditEvent({
                    action: 'PROFILE_UPDATE',
                    resource: uid,
                    userId: user!.uid,
                    ipAddress,
                    userAgent,
                    correlationId: span.correlationId,
                    details: { fieldsUpdated: Object.keys(updateData) },
                })
                await endRouteSpan(span, 200)
                return resp
            } catch (error: any) {
                await endRouteSpan(span, 500, error)
                return apiErrorByKey(500, 'VALIDATION_ERROR', error?.message || 'Failed to update profile')
            }
        }
    )(request)
}
