import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCache, setCache } from '@/lib/cache/query-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TimetableEntry = {
    day: string
    department: string
    sub_department: string
    time_slot: string
    room_name: string
    subject: string
    course_code: string
    program: string
    semester: string
    section: string
    teacher_name: string
    teacher_sap_id: string
    raw_text: string
    is_lab_session?: string
    lab_duration?: string
}

type ApiResponse = {
    data: TimetableEntry[]
    meta: { expiresAt: number; version: string; etag?: string; updatedAt: number }
}

// Some upstream sources publish grouped-by-day data
type GroupedDay = { day: string; entries: TimetableEntry[] }

function msUntilNextPkUpdate(nowMs: number = Date.now()): number {
    // Asia/Karachi is UTC+05:00 (no DST). Compute ms until next 06:00 in PKT.
    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
    const pktNow = new Date(nowMs + PKT_OFFSET_MS)
    const target = new Date(pktNow)
    target.setHours(6, 0, 0, 0)
    if (pktNow.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1)
    }
    return target.getTime() - pktNow.getTime()
}

export async function GET(_req: NextRequest) {
    const cacheKey = 'qc:timetable:master'
    const ifNoneMatchRaw = _req.headers.get('if-none-match') || ''
    const ifNoneMatch = ifNoneMatchRaw.replace(/"/g, '')
    // Try cache first
    try {
        const cached = await getCache<ApiResponse>(cacheKey)
        if (cached && typeof cached.meta?.expiresAt === 'number') {
            const ttlMs = Math.max(0, cached.meta.expiresAt - Date.now())
            // If client provided ETag and it matches cached version, serve 304 immediately
            const currentVersion = cached.meta?.version || ''
            if (currentVersion && ifNoneMatch && ifNoneMatch === currentVersion) {
                const res304 = new NextResponse(null, { status: 304 })
                res304.headers.set('ETag', currentVersion)
                res304.headers.set('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`)
                res304.headers.set('X-Cache-Until', String(cached.meta.expiresAt))
                return res304
            }
            const res = NextResponse.json(cached)
            // Best-effort cache control for clients/CDN
            res.headers.set('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`)
            res.headers.set('X-Cache-Until', String(cached.meta.expiresAt))
            if (cached.meta?.version) {
                res.headers.set('ETag', cached.meta.version)
            }
            return res
        }
    } catch {
        // Ignore cache errors and proceed to fetch
    }

    const endpoint = process.env.TIMETABLE_ENDPOINT_URL
    if (!endpoint) {
        return NextResponse.json(
            { error: 'SERVER_MISCONFIGURED', message: 'TIMETABLE_ENDPOINT_URL is not set' },
            { status: 500 }
        )
    }

    try {
        const resp = await fetch(endpoint, { cache: 'no-store' })
        if (!resp.ok) {
            return NextResponse.json(
                { error: 'UPSTREAM_ERROR', status: resp.status, message: 'Failed to fetch timetable' },
                { status: 502 }
            )
        }

        const raw = await resp.json()
        if (!Array.isArray(raw)) {
            return NextResponse.json(
                { error: 'INVALID_DATA', message: 'Unexpected timetable format' },
                { status: 500 }
            )
        }

        // Normalize shape: accept either TimetableEntry[] or GroupedDay[]
        let flat: TimetableEntry[] = []
        const first = raw[0]
        if (first && typeof first === 'object' && 'entries' in first && 'day' in first) {
            // Grouped-by-day format
            flat = (raw as GroupedDay[]).flatMap((g) => {
                const d = typeof g.day === 'string' ? g.day : ''
                const entries = Array.isArray(g.entries) ? g.entries : []
                return entries
                    .filter((e) => e && typeof e === 'object')
                    .map((e) => ({
                        // Ensure day from group overrides/sets a consistent value
                        ...e,
                        day: e.day || d,
                    }))
            })
        } else {
            // Assume already flat entries
            flat = raw as TimetableEntry[]
        }

        // Basic validation and cleanup: require day and time_slot
        flat = flat.filter((e) => typeof e?.day === 'string' && typeof e?.time_slot === 'string')

        const ttlMs = msUntilNextPkUpdate()
        // Compute a stable version hash for differential sync
        const version = crypto.createHash('sha256').update(JSON.stringify(flat)).digest('hex')
        const updatedAt = Date.now()
        const payload: ApiResponse = {
            data: flat,
            meta: { expiresAt: Date.now() + ttlMs, version, etag: version, updatedAt }
        }

        // Store in cache with TTL
        try {
            await setCache(cacheKey, payload, ttlMs)
        } catch {
            // Ignore cache write failures
        }

        // Respect If-None-Match for differential updates
        if (ifNoneMatch && ifNoneMatch === version) {
            const res304 = new NextResponse(null, { status: 304 })
            res304.headers.set('ETag', version)
            res304.headers.set('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`)
            res304.headers.set('X-Cache-Until', String(payload.meta.expiresAt))
            return res304
        }

        const res = NextResponse.json(payload)
        res.headers.set('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`)
        res.headers.set('X-Cache-Until', String(payload.meta.expiresAt))
        res.headers.set('ETag', version)
        return res
    } catch (e: any) {
        return NextResponse.json(
            { error: 'NETWORK_ERROR', message: e?.message || 'Failed to load timetable' },
            { status: 502 }
        )
    }
}

