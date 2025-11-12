'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getTimetable, setTimetable, clearTimetable, TimetableRecord } from '@/lib/idb/timetable'

export type TimetableEntry = {
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

type ApiPayload = { data: TimetableEntry[]; meta: { expiresAt: number; version: string; etag?: string; updatedAt: number } }

export function useTimetableData() {
    const [data, setData] = useState<TimetableEntry[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [expiresAt, setExpiresAt] = useState<number | null>(null)
    const [updatedAt, setUpdatedAt] = useState<number | null>(null)
    const [version, setVersion] = useState<string | null>(null)
    const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const timerRef = useRef<number | null>(null)
    const initRef = useRef(false)

    const scheduleRefresh = useCallback((targetMs: number) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        const now = Date.now()
        const ms = Math.max(0, targetMs - now)
        if (ms > 0) {
            timerRef.current = window.setTimeout(async () => {
                // Attempt refresh only if online; otherwise wait for online event
                if (navigator.onLine) {
                    await fetchData()
                }
            }, ms)
        }
    }, [])

    const applyPayload = useCallback((json: ApiPayload) => {
        setData(json.data)
        setExpiresAt(json.meta?.expiresAt || null)
        setUpdatedAt(json.meta?.updatedAt || null)
        setVersion(json.meta?.version || null)
        // Persist to IDB
        const record: TimetableRecord = {
            key: 'master',
            data: json.data,
            meta: {
                expiresAt: json.meta.expiresAt,
                updatedAt: json.meta.updatedAt,
                version: json.meta.version,
                etag: json.meta.etag,
            },
        }
        void setTimetable(record)
        // Schedule next refresh based on server-provided next 6AM (expiresAt)
        if (json.meta?.expiresAt) scheduleRefresh(json.meta.expiresAt)
    }, [scheduleRefresh])

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const stored = await getTimetable()
            const etag = stored?.meta?.etag || stored?.meta?.version
            const headers: Record<string, string> = {}
            if (etag) headers['If-None-Match'] = etag

            const res = await fetch('/api/timetable', { cache: 'no-store', headers })
            if (res.status === 304) {
                // No changes; use stored copy
                if (stored && Array.isArray(stored.data)) {
                    setData(stored.data)
                    setExpiresAt(stored.meta.expiresAt)
                    setUpdatedAt(stored.meta.updatedAt)
                    setVersion(stored.meta.version)
                    scheduleRefresh(stored.meta.expiresAt)
                }
                setLoading(false)
                return
            }

            if (!res.ok) {
                throw new Error(`Request failed (${res.status})`)
            }
            const json = (await res.json()) as ApiPayload
            if (!Array.isArray(json?.data)) {
                throw new Error('Invalid timetable response')
            }
            applyPayload(json)
        } catch (e: any) {
            setError(e?.message || 'Failed to load timetable')
            // Fallback to IDB cache when offline or fetch fails
            const stored = await getTimetable()
            if (stored && Array.isArray(stored.data)) {
                setData(stored.data)
                setExpiresAt(stored.meta.expiresAt)
                setUpdatedAt(stored.meta.updatedAt)
                setVersion(stored.meta.version)
                scheduleRefresh(stored.meta.expiresAt)
            }
        } finally {
            setLoading(false)
        }
    }, [applyPayload, scheduleRefresh])

    useEffect(() => {
        if (initRef.current) return
        initRef.current = true
            ; (async () => {
                const cached = await getTimetable()
                const now = Date.now()
                if (cached && Array.isArray(cached.data)) {
                    setData(cached.data)
                    setExpiresAt(cached.meta.expiresAt)
                    setUpdatedAt(cached.meta.updatedAt)
                    setVersion(cached.meta.version)
                    setLoading(false)
                    // If expired and online, refresh immediately; else schedule
                    if (now >= cached.meta.expiresAt && navigator.onLine) {
                        await fetchData()
                    } else {
                        scheduleRefresh(cached.meta.expiresAt)
                    }
                } else {
                    // No cache hit; fetch live
                    await fetchData()
                }
            })()
    }, [fetchData, scheduleRefresh])

    useEffect(() => {
        const onOnline = () => {
            setOnline(true)
            // If expired while offline, refresh now
            if (expiresAt && Date.now() >= expiresAt) void fetchData()
        }
        const onOffline = () => setOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [expiresAt, fetchData])

    const refresh = useCallback(async () => {
        try { await clearTimetable() } catch { }
        await fetchData()
    }, [fetchData])

    return { data, loading, error, expiresAt, updatedAt, version, online, refresh }
}

