'use client'

import React from 'react'
import { Clock, DoorOpen, User, Coffee } from 'lucide-react'
import type { TimetableEntry } from '@/hooks/useTimetableData'

type TimeCardsProps = {
    entries: TimetableEntry[]
    day: string
}

type Slot = { label: string; start: string; end: string }

const SLOTS: Slot[] = [
    { label: '08:30-09:30', start: '08:30', end: '09:30' },
    { label: '09:30-10:30', start: '09:30', end: '10:30' },
    { label: '10:30-11:30', start: '10:30', end: '11:30' },
    { label: '11:30-12:30', start: '11:30', end: '12:30' },
    { label: '12:30-01:30', start: '12:30', end: '13:30' },
    { label: '01:30-02:30', start: '13:30', end: '14:30' },
    { label: '02:30-03:30', start: '14:30', end: '15:30' },
]

function pad(t: string): string {
    const [h, m] = t.split(':')
    const hh = (h || '').padStart(2, '0')
    const mm = (m || '').padStart(2, '0')
    return `${hh}:${mm}`
}

function normalizeLabel(s: string): string {
    const cleaned = (s || '')
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, '')
        .trim()
    const [a, b] = cleaned.split('-')
    if (!a || !b) return cleaned
    return `${pad(a)}-${pad(b)}`
}

function toMinutes(s: string): number {
    const [h, m] = s.split(':').map((x) => parseInt(x, 10))
    return h * 60 + m
}

function getPkNow(): { dayName: string; minutes: number } {
    const now = new Date()
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Karachi' }).format(now)
    const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Karachi' }).format(now)
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10))
    const minutes = h * 60 + m
    return { dayName, minutes }
}

export function TimeCards({ entries, day }: TimeCardsProps) {
    const [, forceTick] = React.useState(0)
    React.useEffect(() => {
        const t = setInterval(() => forceTick((v) => v + 1), 60_000)
        return () => clearInterval(t)
    }, [])
    const { dayName, minutes: nowMin } = getPkNow()
    const isToday = dayName === day

    const expanded = React.useMemo(() => {
        const out: TimetableEntry[] = []
        for (const e of entries) {
            const isLab = ((e.is_lab_session || '') as string).toLowerCase() === 'true'
            const dep = (e.department || '').trim()
            const span = (e as unknown as { lab_span_slots?: string[] }).lab_span_slots
            if (isLab && dep === 'CS & IT') {
                if (Array.isArray(span) && span.length >= 2) {
                    for (let i = 0; i < span.length; i++) {
                        const s = span[i]
                        const clone = { ...e, time_slot: s } as TimetableEntry
                        ;(clone as unknown as { lab_span_slots: string[] }).lab_span_slots = span.slice()
                        ;(clone as unknown as { lab_span_is_start: string }).lab_span_is_start = String(i === 0)
                        out.push(clone)
                    }
                } else {
                    const label = normalizeLabel(e.time_slot || '')
                    const idx = SLOTS.findIndex((s) => normalizeLabel(s.label) === label)
                    if (idx >= 0) {
                        const span3: string[] = []
                        for (let k = 0; k < 3 && idx + k < SLOTS.length; k++) span3.push(SLOTS[idx + k].label)
                        for (let i = 0; i < span3.length; i++) {
                            const s = span3[i]
                            const clone = { ...e, time_slot: s } as TimetableEntry
                            ;(clone as unknown as { lab_span_slots: string[] }).lab_span_slots = span3
                            ;(clone as unknown as { lab_span_is_start: string }).lab_span_is_start = String(i === 0)
                            out.push(clone)
                        }
                    } else {
                        out.push(e)
                    }
                }
            } else {
                out.push(e)
            }
        }
        return out
    }, [entries])

    const bySlot = React.useMemo(() => {
        const map = new Map<string, TimetableEntry[]>()
        for (const e of expanded) {
            const key = normalizeLabel(e.time_slot || '')
            if (!key) continue
            const arr = map.get(key) || []
            arr.push(e)
            map.set(key, arr)
        }
        return map
    }, [expanded])

    const isLabEntry = (e: TimetableEntry): boolean => {
        const explicit = ((e.is_lab_session || '') as string).toLowerCase() === 'true'
        const dep = (e.department || '').trim()
        const span = (e as unknown as { lab_span_slots?: string[] }).lab_span_slots
        const hasThree = Array.isArray(span) && span.length >= 3
        return explicit && dep === 'CS & IT' && hasThree
    }

    

    // Mobile-first sanitizers
    const cleanSubject = (s: string): string => {
        return (s || '').replace(/\s*\($/, '').trim()
    }

    const cleanRoom = (s: string): string => {
        let r = (s || '').replace(/\s+/g, ' ').trim()
        const i = r.indexOf('(')
        if (i >= 0) r = r.slice(0, i).trim()
        // Remove campus/wing codes like B-GF-009, D-FF-103 etc.
        r = r.replace(/\b[A-Z]-[A-Z]+-\d+\b/g, '').trim()
        return r
    }

    // Subject accent color mapping (stable hashed selection)
    const ACCENTS = [
        'from-[#ffe3e3]', // soft red
        'from-[#e3f2ff]', // soft blue
        'from-[#e3fff0]', // soft green
        'from-[#fff7e3]', // soft amber
        'from-[#f0e3ff]', // soft purple
        'from-[#e3fff9]', // soft teal
    ]
    const pickAccentIndex = (s: string) => {
        const str = (s || 'subject')
        let h = 0
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
        return h % ACCENTS.length
    }

    return (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SLOTS.map((slot) => {
                const startMin = toMinutes(slot.start)
                const endMin = toMinutes(slot.end)
                const matched = bySlot.get(normalizeLabel(slot.label)) || []
                const hasClass = matched.length > 0
                let state: 'free' | 'ongoing' | 'upcoming' | 'completed' = 'free'
                if (isToday) {
                    if (nowMin >= startMin && nowMin < endMin) state = hasClass ? 'ongoing' : 'ongoing'
                    else if (nowMin < startMin) state = hasClass ? 'upcoming' : 'upcoming'
                    else state = hasClass ? 'completed' : 'completed'
                } else {
                    state = hasClass ? 'upcoming' : 'free'
                }

                const cardBase = 'relative rounded-xl border overflow-hidden shadow-sm transition-all hover:shadow-md'
                const cardColors = (
                    state === 'ongoing' ? 'border-lime-500 bg-lime-50 ring-1 ring-lime-500 dark:bg-lime-900/20 dark:border-lime-500/50' :
                        state === 'upcoming' ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900' :
                            state === 'completed' ? 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900' :
                                'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
                )

                return (
                    <article
                        key={slot.label}
                        aria-label={`Time slot ${slot.label}`}
                        id={`slot-${slot.label.replace(/[:\-]/g, '')}`}
                        className={`${cardBase} ${cardColors}`}
                    >
                        {state === 'ongoing' && isToday && (
                            <div className="absolute inset-x-0 top-0 h-[3px] bg-lime-500" aria-hidden="true"></div>
                        )}
                        <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                                <span className="text-sm font-semibold text-neutral-900 dark:text-white">{slot.label}</span>
                                {state === 'ongoing' && (
                                    <span className="inline-flex items-center rounded-full bg-lime-500 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide" aria-label="Ongoing">Now</span>
                                )}
                            </div>
                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{hasClass ? `${matched.length} class${matched.length > 1 ? 'es' : ''}` : 'Free'}</span>
                        </header>

                        <div className="px-3 pb-3 pt-3">
                            {hasClass ? (
                                matched.map((e, idx) => (
                                    (() => {
                                        const ai = pickAccentIndex(e.subject)
                                        // Solid accent colors instead of gradients
                                        const accentBg = [
                                            'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                                            'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                                            'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                                            'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
                                            'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
                                            'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
                                        ][ai]
                                        const accentBorder = [
                                            'border-l-red-500',
                                            'border-l-blue-500',
                                            'border-l-green-500',
                                            'border-l-amber-500',
                                            'border-l-purple-500',
                                            'border-l-teal-500',
                                        ][ai]

                                        const showLab = isLabEntry(e)
                                        const incomplete = !e.teacher_name || !e.room_name
                                        return (
                                            <div
                                                key={idx}
                                                className={`mt-2 first:mt-0 rounded-lg border ${incomplete ? 'border-amber-300 bg-amber-50' : accentBg} px-3 py-3 shadow-sm border-l-4 ${accentBorder}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[15px] sm:text-base font-bold text-neutral-900 dark:text-white line-clamp-2 leading-tight">
                                                            {cleanSubject(e.subject)}
                                                        </div>
                                                    </div>
                                                    <span className={`${showLab ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'} inline-flex items-center rounded-md text-[10px] font-bold px-2 py-1 uppercase tracking-wider`} aria-label={showLab ? 'Lab session' : 'Lecture'}>{showLab ? 'Lab' : 'Lecture'}</span>
                                                </div>

                                                    <div className="mt-2 flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                                                        <User className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                                                        <span className="truncate">{e.teacher_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                                                        <DoorOpen className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                                                        <span className="truncate">{cleanRoom(e.room_name)}</span>
                                                    </div>
                                                    </div>
                                            </div>
                                        )
                                    })()
                                ))
                            ) : (
                                <div className="mt-2 rounded-xl border border-dashed border-lime-300 bg-white px-3 py-6 text-center text-[#4c5c3c] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                                    <div className="mx-auto inline-flex items-center justify-center gap-2">
                                        <Coffee className="h-4 w-4" aria-hidden="true" />
                                        <span>{entries.length === 0 ? 'Apply filters to view classes.' : 'Enjoy a break. No scheduled class.'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </article>
                )
            })}
        </div>
    )
}
