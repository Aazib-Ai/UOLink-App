'use client'

import React from 'react'
import { Clock, DoorOpen, User, Coffee, AlertCircle, Tag } from 'lucide-react'
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
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  const { dayName, minutes: nowMin } = getPkNow()
  const isToday = dayName === day

  const bySlot = React.useMemo(() => {
    const map = new Map<string, TimetableEntry[]>()
    for (const e of entries) {
      const key = normalizeLabel(e.time_slot || '')
      if (!key) continue
      const arr = map.get(key) || []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [entries])

  const labTaggedSet = React.useMemo(() => {
    const set = new Set<string>()
    const groups = new Map<string, TimetableEntry[]>()
    for (const e of entries) {
      const subj = (e.subject || '').replace(/\s*\($/, '').trim()
      const room = (e.room_name || '').replace(/\s+/g, ' ').trim()
      const k = `${subj}-${e.teacher_name}-${room}`
      const arr = groups.get(k) || []
      arr.push(e)
      groups.set(k, arr)
    }
    const startMinutes = (e: TimetableEntry) => {
      const label = normalizeLabel(e.time_slot || '')
      const [start] = label.split('-')
      return toMinutes(start)
    }
    for (const [gk, arr] of groups) {
      const sorted = arr.slice().sort((a, b) => startMinutes(a) - startMinutes(b))
      let seq: TimetableEntry[] = []
      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i]
        if (seq.length === 0) {
          seq.push(curr)
          continue
        }
        const prev = seq[seq.length - 1]
        const diff = startMinutes(curr) - startMinutes(prev)
        if (diff === 60) {
          seq.push(curr)
        } else {
          if (seq.length >= 3 && seq.some(s => (s.is_lab_session || '').toLowerCase() === 'true')) {
            for (const e of seq) set.add(`${normalizeLabel(e.time_slot || '')}|${gk}`)
          }
          seq = [curr]
        }
      }
      if (seq.length >= 3 && seq.some(s => (s.is_lab_session || '').toLowerCase() === 'true')) {
        for (const e of seq) set.add(`${normalizeLabel(e.time_slot || '')}|${gk}`)
      }
    }
    return set
  }, [entries])

  const findConsecutiveSlots = (slots: string[]): string[] => {
    if (slots.length === 0) return []
    
    const slotToMinutes = (slot: string): number => {
      const [start] = slot.split('-')
      return toMinutes(start)
    }
    
    const sortedSlots = slots.sort((a, b) => slotToMinutes(a) - slotToMinutes(b))
    const consecutive: string[] = []
    let currentGroup: string[] = [sortedSlots[0]]
    
    for (let i = 1; i < sortedSlots.length; i++) {
      const prevMinutes = slotToMinutes(sortedSlots[i - 1])
      const currentMinutes = slotToMinutes(sortedSlots[i])
      
      if (currentMinutes - prevMinutes === 60) {
        currentGroup.push(sortedSlots[i])
      } else {
        if (currentGroup.length >= 2) {
          consecutive.push(...currentGroup)
        }
        currentGroup = [sortedSlots[i]]
      }
    }
    
    if (currentGroup.length >= 2) {
      consecutive.push(...currentGroup)
    }
    
    return consecutive
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
  const ACCENT_COLORS = [
    '#ffcece', // soft red edge
    '#cfe9ff', // soft blue edge
    '#cfffdf', // soft green edge
    '#ffefc2', // soft amber edge
    '#e6d1ff', // soft purple edge
    '#d4fff2', // soft teal edge
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

        const cardBase = 'relative rounded-2xl border overflow-hidden shadow-sm transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]'
        const cardColors = (
          state === 'ongoing' ? 'border-[#90c639] bg-[#ecf8cf]/80 backdrop-blur-md ring-2 ring-[#90c639]/40' :
          state === 'upcoming' ? 'border-lime-200 bg-white/30 backdrop-blur-md' :
          state === 'completed' ? 'border-lime-100 bg-white/25 backdrop-blur-md opacity-85' :
          'border-lime-200 bg-white/30 backdrop-blur-md'
        )

        return (
          <article
            key={slot.label}
            aria-label={`Time slot ${slot.label}`}
            id={`slot-${slot.label.replace(/[:\-]/g, '')}`}
            className={`${cardBase} ${cardColors}`}
          >
            {state === 'ongoing' && isToday && (
              <div className="absolute inset-x-0 top-0 h-[3px] bg-[#90c639]" aria-hidden="true"></div>
            )}
            <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-br to-white/60 dark:to-neutral-900/60">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#334125]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[#1f2f10] dark:text-white">{slot.label}</span>
                {state === 'ongoing' && (
                  <span className="inline-flex items-center rounded-full bg-[#90c639] text-white text-xs px-2 py-0.5" aria-label="Ongoing">Now</span>
                )}
              </div>
              <span className="text-xs text-[#4c5c3c] dark:text-neutral-300">{hasClass ? `${matched.length} class${matched.length > 1 ? 'es' : ''}` : 'Free lecture'}</span>
            </header>

            <div className="px-4 pb-4">
              {hasClass ? (
                matched.map((e, idx) => (
                  (() => {
                    const ai = pickAccentIndex(e.subject)
                    const accentBg = ACCENTS[ai]
                    const accentHex = ACCENT_COLORS[ai]
                    const subj = (e.subject || '').replace(/\s*\($/, '').trim()
                    const room = (e.room_name || '').replace(/\s+/g, ' ').trim()
                    const gk = `${subj}-${e.teacher_name}-${room}`
                    const slotKey = `${normalizeLabel(e.time_slot || '')}|${gk}`
                    const showLab = labTaggedSet.has(slotKey)
                    const incomplete = !e.section || !e.teacher_name || !e.room_name
                    return (
                      <div
                        key={idx}
                        className={`mt-2 rounded-xl border ${incomplete ? 'border-amber-300' : 'border-white/40'} bg-gradient-to-br ${accentBg} to-white/60 backdrop-blur-md px-3 py-3 shadow-sm dark:border-neutral-700 dark:to-neutral-900/60 border-l-4`}
                        style={{ borderLeftColor: accentHex }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] sm:text-base font-semibold text-[#1f2f10] dark:text-white line-clamp-2">
                              {cleanSubject(e.subject)}
                            </div>
                          </div>
                          <span className={`${showLab ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200' : 'bg-[#1f2f10]/5 text-[#1f2f10] dark:bg-neutral-700 dark:text-neutral-100'} inline-flex items-center rounded-full text-[10px] px-2 py-0.5`} aria-label={showLab ? 'Lab session' : 'Lecture'}>{showLab ? 'Lab' : 'Lecture'}</span>
                        </div>

                        <div className="mt-1.5 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[12px] text-[#334125] dark:text-neutral-200">
                            <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{e.section ? `Section ${e.section}` : 'Section —'}</span>
                            {incomplete && (
                              <span className="ml-2 inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full text-[10px]">
                                <AlertCircle className="h-3 w-3" />
                                Incomplete
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#334125] dark:text-neutral-200">
                            <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{e.teacher_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#334125] dark:text-neutral-200">
                            <DoorOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{cleanRoom(e.room_name)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()
                ))
              ) : (
                <div className="mt-2 rounded-xl border border-dashed border-lime-200 bg-white/50 backdrop-blur-md px-3 py-6 text-center text-[#4c5c3c] dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-300">
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
