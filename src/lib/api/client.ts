import { auth } from '@/lib/firebase'
import type { ApiResponse, ApiErrorResponse } from '@/types/api'

// Shared token helpers for consistent Authorization handling
export async function getIdToken(forceRefresh: boolean = false): Promise<string> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')
    return user.getIdToken(forceRefresh)
}

export async function getIdTokenOptional(forceRefresh: boolean = false): Promise<string | null> {
    const user = auth.currentUser
    return user ? user.getIdToken(forceRefresh) : null
}

export function attachAuthHeader(headers: Record<string, string>, token: string | null): Record<string, string> {
    if (token) {
        return { ...headers, Authorization: `Bearer ${token}` }
    }
    return headers
}

// Client-side error handling utilities
export function parseApiError(err: unknown, fallbackMessage: string = 'Request failed'): string {
    if (!err) return fallbackMessage
    if (typeof err === 'string') return err
    const e = err as any
    if (e?.error) return String(e.error)
    if (e?.message) return String(e.message)
    return fallbackMessage
}

export function userFriendlyMessage(code?: string, defaultMessage?: string): string {
    switch (code) {
        case 'AUTH_REQUIRED':
            return 'Please sign in to continue.'
        case 'VALIDATION_ERROR':
            return defaultMessage || 'Some inputs are invalid.'
        case 'NOT_FOUND':
            return 'Requested resource was not found.'
        case 'RATE_LIMITED':
            return 'Too many requests. Please try again shortly.'
        case 'SERVER_ERROR':
            return 'Server encountered an error. Try again later.'
        default:
            return defaultMessage || 'Something went wrong. Please try again.'
    }
}

// Transient HTTP statuses that merit a retry
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504, 429])

export async function fetchWithRetry<T = any>(
    url: string,
    init: RequestInit,
    options: { retries?: number; backoffMs?: number } = {}
): Promise<{ res: Response; json: ApiResponse<T> | any }> {
    const retries = options.retries ?? 2
    const backoffMs = options.backoffMs ?? 300

    let attempt = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const res = await fetch(url, init)
            const json = await res.json().catch(() => ({}))
            if (!res.ok && TRANSIENT_STATUSES.has(res.status) && attempt < retries) {
                attempt++
                await new Promise((r) => setTimeout(r, backoffMs * attempt))
                continue
            }
            return { res, json }
        } catch (networkErr) {
            if (attempt < retries) {
                attempt++
                await new Promise((r) => setTimeout(r, backoffMs * attempt))
                continue
            }
            throw networkErr
        }
    }
}

// Helper that automatically refreshes token on 401 and retries once
export async function authorizedJson<T = any>(
    url: string,
    init: RequestInit,
    opts: { requireAuth?: boolean; tokenOptional?: boolean } = { requireAuth: true }
): Promise<ApiResponse<T>> {
    const requireAuth = opts.requireAuth ?? true
    const token = requireAuth ? await getIdToken() : await getIdTokenOptional()
    const headers = attachAuthHeader((init.headers as Record<string, string>) || {}, token)
    const { res, json } = await fetchWithRetry<T>(url, { ...init, headers })

    if (res.status === 401 && requireAuth) {
        // Try once with a forced token refresh
        const refreshed = await getIdToken(true)
        const headersRefreshed = attachAuthHeader((init.headers as Record<string, string>) || {}, refreshed)
        const retry = await fetchWithRetry<T>(url, { ...init, headers: headersRefreshed })
        return retry.json as ApiResponse<T>
    }

    return json as ApiResponse<T>
}

// Helper that throws on error responses, returning data only
export async function requireOk<T = any>(
    url: string,
    init: RequestInit,
    opts: { requireAuth?: boolean } = { requireAuth: true }
): Promise<T> {
    const response = await authorizedJson<T>(url, init, opts)
    const success = (response as any)?.data
    if (success !== undefined) return success as T
    const err = response as ApiErrorResponse
    throw new Error(userFriendlyMessage(err.code, err.error))
}

