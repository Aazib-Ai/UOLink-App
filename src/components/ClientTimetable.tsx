'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { useTimetableData, TimetableEntry } from '@/hooks/useTimetableData'

// Code-split heavy UI sections
const CustomSelect = dynamic(() => import('@/components/CustomSelect'), {
  loading: () => <div className="h-10 w-full rounded-md bg-lime-50" />,
})
const DaySelector = dynamic(() => import('@/components/timetable/DaySelector').then(m => m.DaySelector), {
  loading: () => <div className="h-8 w-full rounded-md bg-lime-50" />,
})
const TimeCards = dynamic(() => import('@/components/timetable/TimeCards').then(m => m.TimeCards), {
  loading: () => <div className="h-32 w-full rounded-xl bg-lime-50" />,
})

export interface TimetableProps {}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function computeUnique(entries: TimetableEntry[], key: keyof TimetableEntry): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    const val = (e[key] || '').trim()
    if (val) set.add(val)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function computeDensity(entries: TimetableEntry[], days: string[], filters: Partial<TimetableEntry>) {
  const density: Record<string, number> = {}
  for (const d of days) density[d] = 0
  for (const e of entries) {
    if (filters.department && e.department !== filters.department) continue
    if (filters.sub_department && e.sub_department !== filters.sub_department) continue
    if (filters.semester && e.semester !== filters.semester) continue
    if (filters.section && e.section !== filters.section) continue
    if (days.includes(e.day)) density[e.day]++
  }
  return density
}

function applyFilters(entries: TimetableEntry[], day: string, filters: Partial<TimetableEntry>) {
  return entries.filter((e) => {
    if (e.day !== day) return false
    if (filters.department && e.department !== filters.department) return false
    if (filters.sub_department && e.sub_department !== filters.sub_department) return false
    if (filters.semester && e.semester !== filters.semester) return false
    if (filters.section && e.section !== filters.section) return false
    return true
  })
}

export default function ClientTimetable(_props: TimetableProps) {
  const { data, loading, error, refresh, updatedAt, version, online, expiresAt } = useTimetableData()

  const [department, setDepartment] = React.useState<string | null>(null)
  const [subDept, setSubDept] = React.useState<string | null>(null)
  const [semester, setSemester] = React.useState<string | null>(null)
  const [section, setSection] = React.useState<string | null>(null)
  const [day, setDay] = React.useState<string>(WEEK_DAYS[0])

  const filters = React.useMemo(() => ({
    department: department || undefined,
    sub_department: subDept || undefined,
    semester: semester || undefined,
    section: section || undefined,
  }), [department, subDept, semester, section]) as Partial<TimetableEntry>

  // Determine which filters are required based on data distribution
  const hasDept = !!department
  const hasSubDeptOptions = React.useMemo(() => {
    if (!department) return false
    const set = new Set<string>()
    for (const e of data) {
      if (e.department !== department) continue
      const v = (e.sub_department || '').trim()
      if (v) set.add(v)
      if (set.size > 0) break
    }
    return set.size > 0
  }, [data, department])

  const subDeptRequired = hasDept && hasSubDeptOptions

  const hasSectionOptions = React.useMemo(() => {
    if (!department) return false
    // Narrow to selected subDept when required/available
    for (const e of data) {
      if (e.department !== department) continue
      if (subDeptRequired && subDept && e.sub_department !== subDept) continue
      const v = (e.section || '').trim()
      if (v) return true
    }
    return false
  }, [data, department, subDept, subDeptRequired])

  const sectionRequired = hasDept && hasSectionOptions

  const filtersValid = React.useMemo(() => {
    if (!department) return false
    if (subDeptRequired && !subDept) return false
    if (sectionRequired && !section) return false
    // semester is optional; but if chosen, it will refine
    return true
  }, [department, subDept, subDeptRequired, section, sectionRequired])

  // Densities only computed when filters are valid; otherwise zeros
  const densities = React.useMemo(() => (
    filtersValid ? computeDensity(data, WEEK_DAYS, filters) : WEEK_DAYS.reduce((acc, d) => (acc[d] = 0, acc), {} as Record<string, number>)
  ), [data, filters, filtersValid])

  // Memoized filtered results by key for performance
  const filterCacheRef = React.useRef<Map<string, TimetableEntry[]>>(new Map())
  React.useEffect(() => { filterCacheRef.current.clear() }, [data])
  const filteredForDay = React.useMemo(() => {
    if (!filtersValid) return [] as TimetableEntry[]
    const keyObj = { day, department: filters.department || '', sub_department: filters.sub_department || '', semester: filters.semester || '', section: filters.section || '' }
    const key = JSON.stringify(keyObj)
    const hit = filterCacheRef.current.get(key)
    if (hit) return hit
    const res = applyFilters(data, day, filters)
    filterCacheRef.current.set(key, res)
    return res
  }, [data, day, filters, filtersValid])

  // A tiny loading state when filters change for perceived performance
  const [filtering, setFiltering] = React.useState(false)
  React.useEffect(() => {
    setFiltering(true)
    const t = setTimeout(() => setFiltering(false), 60)
    return () => clearTimeout(t)
  }, [department, subDept, semester, section, day])

  const jumpToNow = React.useCallback(() => {
    const now = new Date()
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Karachi' }).format(now)
    const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Karachi' }).format(now)
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10))
    const minutes = h * 60 + m
    const slots = [
      { label: '08:30-09:30', start: 8 * 60 + 30, end: 9 * 60 + 30 },
      { label: '09:30-10:30', start: 9 * 60 + 30, end: 10 * 60 + 30 },
      { label: '10:30-11:30', start: 10 * 60 + 30, end: 11 * 60 + 30 },
      { label: '11:30-12:30', start: 11 * 60 + 30, end: 12 * 60 + 30 },
      { label: '12:30-01:30', start: 12 * 60 + 30, end: 13 * 60 + 30 },
      { label: '01:30-02:30', start: 13 * 60 + 30, end: 14 * 60 + 30 },
      { label: '02:30-03:30', start: 14 * 60 + 30, end: 15 * 60 + 30 },
    ]
    const current = slots.find((s) => minutes >= s.start && minutes < s.end) || slots[0]
    if (weekday !== day) {
      setDay(weekday)
      // wait for render then scroll
      setTimeout(() => {
        const el = document.getElementById(`slot-${current.label.replace(/[:\-]/g, '')}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } else {
      const el = document.getElementById(`slot-${current.label.replace(/[:\-]/g, '')}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [day])

  // Progressive options narrowing
  const departments = React.useMemo(() => computeUnique(data, 'department'), [data])
  const subDepts = React.useMemo(() => {
    const filtered = department ? data.filter(d => d.department === department) : data
    return computeUnique(filtered, 'sub_department')
  }, [data, department])
  const semesters = React.useMemo(() => {
    const base = department ? data.filter(d => d.department === department) : data
    const filtered = subDept ? base.filter(d => d.sub_department === subDept) : base
    return computeUnique(filtered, 'semester')
  }, [data, department, subDept])
  const sections = React.useMemo(() => {
    const base1 = department ? data.filter(d => d.department === department) : data
    const base2 = subDept ? base1.filter(d => d.sub_department === subDept) : base1
    const filtered = semester ? base2.filter(d => d.semester === semester) : base2
    return computeUnique(filtered, 'section')
  }, [data, department, subDept, semester])

  // Auto-select current day and scroll to current time on initial load
  React.useEffect(() => {
    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
    const pktNow = new Date(Date.now() + PKT_OFFSET_MS)
    const weekday = pktNow.toLocaleDateString('en-US', { weekday: 'long' })
    if (WEEK_DAYS.includes(weekday)) {
      setDay(weekday)
    }
    const t = setTimeout(() => {
      jumpToNow()
    }, 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Simple swipe gestures for day switching on mobile
  const touchStartRef = React.useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartRef.current
    const endX = e.changedTouches[0]?.clientX ?? null
    touchStartRef.current = null
    if (startX == null || endX == null) return
    const dx = endX - startX
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (!isMobile) return
    const threshold = 48
    if (dx > threshold) {
      const idx = WEEK_DAYS.indexOf(day)
      const prev = Math.max(0, idx - 1)
      setDay(WEEK_DAYS[prev])
    } else if (dx < -threshold) {
      const idx = WEEK_DAYS.indexOf(day)
      const next = Math.min(WEEK_DAYS.length - 1, idx + 1)
      setDay(WEEK_DAYS[next])
    }
  }

  return (
    <section
      aria-label="Timetable content"
      role="region"
      className="mt-6 rounded-3xl border border-lime-100 bg-white/70 backdrop-blur-md shadow-sm overflow-hidden dark:border-neutral-700 dark:bg-neutral-900/60"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="bg-gradient-to-b from-[#f7fbe9] via-white to-white px-6 pt-8 sm:px-8 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#1f2f10] dark:text-white">Your Timetable</h2>
        </div>
        {loading && (
          <p className="mt-2 text-sm text-[#4c5c3c] dark:text-neutral-300" role="status" aria-live="polite">Loading timetable…</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        )}
      </div>

      {/* Progressive Selection Panel */}
      <div className="px-6 sm:px-8 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#334125]">Filters</h3>
          {department || subDept || semester || section ? (
            <button
              type="button"
              className="text-xs font-medium text-[#4c5c3c] hover:text-[#1f2f10] underline decoration-dotted"
              onClick={() => { setDepartment(null); setSubDept(null); setSemester(null); setSection(null); }}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="mt-2 rounded-2xl border border-lime-100 bg-white/60 backdrop-blur-md p-4 dark:border-neutral-700 dark:bg-neutral-900/50">
          <div className="mb-2 text-[12px] text-[#4c5c3c] dark:text-neutral-300">
            {(!filtersValid) ? (
              <span title="Select filters to view your classes.">Select Department{subDeptRequired ? ', Sub-department' : ''}{sectionRequired ? ', Section' : ''} to view classes.</span>
            ) : (
              <span>Filters active. Showing results for the selected day.</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CustomSelect
              aria-label="Select department"
              placeholder="Department"
              value={department || ''}
              onChange={(v: string) => {
                setDepartment(v)
                setSubDept(null)
                setSemester(null)
                setSection(null)
              }}
              options={departments}
              size="sm"
            />
            {department && subDeptRequired && (
              <CustomSelect
                aria-label="Select sub-department"
                placeholder="Sub-department"
                value={subDept || ''}
                onChange={(v: string) => {
                  setSubDept(v)
                  setSemester(null)
                  setSection(null)
                }}
                options={subDepts}
                size="sm"
              />
            )}
            {department && subDept && (
              <CustomSelect
                aria-label="Select semester"
                placeholder="Semester"
                value={semester || ''}
                onChange={(v: string) => {
                  setSemester(v)
                  setSection(null)
                }}
                options={semesters}
                size="sm"
              />
            )}
            {(sectionRequired ? (department && (!subDeptRequired || subDept) && (!semester || semester) ) : false) && (
              <CustomSelect
                aria-label="Select section"
                placeholder="Section"
                value={section || ''}
                onChange={(v: string) => setSection(v)}
                options={sections}
                size="sm"
              />
            )}
          </div>
        </div>
        <DaySelector days={WEEK_DAYS} densities={densities} selectedDay={day} onSelect={setDay} />
      </div>

      {/* Timetable Cards */}
      <div className="px-6 sm:px-8 pb-8">
        {!filtersValid ? (
          <>
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-xs">
              Please select the required filters to see classes.
            </div>
            <TimeCards entries={[]} day={day} />
          </>
        ) : filtering ? (
          <div className="mt-4 h-32 w-full animate-pulse rounded-xl bg-lime-50" aria-hidden="true" />
        ) : (
          <TimeCards entries={filteredForDay} day={day} />
        )}
      </div>
    </section>
  )
}
