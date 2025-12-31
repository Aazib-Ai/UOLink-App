'use client'

import React from 'react'
import { Download, Clock, MapPin, User, Calendar, Coffee } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTimetableData, TimetableEntry } from '@/hooks/useTimetableData'
import { useAuth } from '@/contexts/AuthContext'
import { getUserPrefs, setUserPrefs, getGuestPrefs, setGuestPrefs, mapMajorToDepartment, inferSubDepartment } from '@/lib/preferences/timetable'
import { getProfileAcademic } from '@/lib/firebase/profile-lite'
import { useNavigationState } from '@/lib/cache/client'

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

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

type MergedProgram = { program?: string; sub_department?: string; semester?: string; section?: string; department?: string }

function computeUnique(entries: TimetableEntry[], key: keyof TimetableEntry): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    const raw = e[key]
    const val = (typeof raw === 'string' ? raw : '').trim()
    if (val) set.add(val)
    const mpRaw: unknown = (e as unknown as { merged_programs?: MergedProgram[] | string }).merged_programs
    const mpArr: MergedProgram[] = Array.isArray(mpRaw)
      ? mpRaw
      : typeof mpRaw === 'string'
        ? (() => { try { const j = JSON.parse(mpRaw as string); return Array.isArray(j) ? j : [] } catch { return [] } })()
        : []
    for (const m of mpArr) {
      const mv = (m?.[key as keyof MergedProgram] || '').trim()
      if (mv) set.add(mv)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function sectionMatches(selected: string | string[] | null | undefined, value: string | null | undefined): boolean {
  const v = (value || '').trim()
  if (!selected) return true
  if (Array.isArray(selected)) {
    const set = new Set(selected.map((x) => String(x).trim()))
    return set.has(v)
  }
  return v === String(selected).trim()
}

function mergedProgramsOf(e: TimetableEntry): MergedProgram[] {
  const mpRaw = (e as unknown as { merged_programs?: MergedProgram[] | string }).merged_programs as unknown
  if (Array.isArray(mpRaw)) return mpRaw as MergedProgram[]
  if (typeof mpRaw === 'string') {
    try { const j = JSON.parse(mpRaw as string); return Array.isArray(j) ? (j as MergedProgram[]) : [] } catch { return [] }
  }
  return []
}

function computeSubDeptOptions(entries: TimetableEntry[], department: string | null): string[] {
  if (!department) return computeUnique(entries, 'sub_department')
  const set = new Set<string>()
  for (const e of entries) {
    if ((e.department || '').trim() !== department) continue
    const v = (e.sub_department || '').trim()
    if (v) set.add(v)
    const mp = mergedProgramsOf(e)
    for (const m of mp) {
      const depOk = !m.department || (m.department || '').trim() === department
      const sv = (m.sub_department || '').trim()
      if (depOk && sv) set.add(sv)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function computeSemesterOptions(entries: TimetableEntry[], department: string | null, subDept: string | null): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    if (department && (e.department || '').trim() !== department) continue
    const sd = (e.sub_department || '').trim()
    if (!subDept || sd === subDept) {
      const v = (e.semester || '').trim()
      if (v) set.add(v)
    }
    const mp = mergedProgramsOf(e)
    for (const m of mp) {
      const depOk = !department || !m.department || (m.department || '').trim() === department
      const subOk = !subDept || (m.sub_department || '').trim() === subDept
      if (depOk && subOk) {
        const sv = (m.semester || '').trim()
        if (sv) set.add(sv)
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function computeSectionOptions(entries: TimetableEntry[], department: string | null, subDept: string | null, semester: string | null): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    if (department && (e.department || '').trim() !== department) continue
    const sd = (e.sub_department || '').trim()
    const sem = (e.semester || '').trim()
    const subOk = !subDept || sd === subDept
    const semOk = !semester || sem === semester
    if (subOk && semOk) {
      const v = (e.section || '').trim()
      if (v) set.add(v)
    }
    const mp = mergedProgramsOf(e)
    for (const m of mp) {
      const depOk = !department || !m.department || (m.department || '').trim() === department
      const subOk2 = !subDept || (m.sub_department || '').trim() === subDept
      const semOk2 = !semester || (m.semester || '').trim() === semester
      if (depOk && subOk2 && semOk2) {
        const sv = (m.section || '').trim()
        if (sv) set.add(sv)
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function matchesDepartment(e: TimetableEntry, dep?: string | null): boolean {
  if (!dep) return true
  if ((e?.department || '').trim() === dep) return true
  const md = (e as unknown as { merged_departments?: string[] }).merged_departments
  return Array.isArray(md) ? md.includes(dep) : false
}

function matchesSubDept(e: TimetableEntry, sub?: string | null): boolean {
  if (!sub) return true
  if ((e?.sub_department || '').trim() === sub) return true
  const mp = mergedProgramsOf(e)
  return mp.some((m) => (m?.sub_department || '').trim() === sub)
}

function matchesSemester(e: TimetableEntry, sem?: string | null, sub?: string | null): boolean {
  if (!sem) return true
  if ((e?.semester || '').trim() === sem) return true
  const mp = mergedProgramsOf(e)
  if (sub) return mp.some((m) => (m?.semester || '').trim() === sem && (m?.sub_department || '').trim() === sub)
  return mp.some((m) => (m?.semester || '').trim() === sem)
}

function matchesSection(e: TimetableEntry, secSel: string | string[] | null | undefined, sub?: string | null): boolean {
  if (!secSel) return true
  if (sectionMatches(secSel, (e?.section || '').trim())) return true
  const mp = mergedProgramsOf(e)
  if (sub) return mp.some((m) => sectionMatches(secSel, (m?.section || '').trim()) && (m?.sub_department || '').trim() === sub)
  return mp.some((m) => sectionMatches(secSel, (m?.section || '').trim()))
}

function computeDensity(entries: TimetableEntry[], days: string[], filters: Partial<TimetableEntry>) {
  const density: Record<string, number> = {}
  for (const d of days) density[d] = 0
  for (const e of entries) {
    const depOk = matchesDepartment(e, filters.department || null)
    const subOk = matchesSubDept(e, filters.sub_department || null)
    const semOk = matchesSemester(e, filters.semester || null, filters.sub_department || null)
    const secSel = (filters.section as unknown) as string | string[] | undefined
    const secOk = matchesSection(e, secSel, filters.sub_department || null)
    if (!depOk || !subOk || !semOk || !secOk) continue
    if (days.includes(e.day)) density[e.day]++
  }
  return density
}

function applyFilters(entries: TimetableEntry[], day: string, filters: Partial<TimetableEntry>) {
  return entries.filter((e) => {
    if (e.day !== day) return false
    const depOk = matchesDepartment(e, filters.department || null)
    const subOk = matchesSubDept(e, filters.sub_department || null)
    const semOk = matchesSemester(e, filters.semester || null, filters.sub_department || null)
    const secSel = (filters.section as unknown) as string | string[] | undefined
    const secOk = matchesSection(e, secSel, filters.sub_department || null)
    if (!depOk || !subOk || !semOk || !secOk) return false
    return true
  })
}

export default function ClientTimetable(): JSX.Element {
  const { data, loading, error } = useTimetableData()
  const { user } = useAuth()

  const [department, setDepartment] = React.useState<string | null>(null)
  const [subDept, setSubDept] = React.useState<string | null>(null)
  const [semester, setSemester] = React.useState<string | null>(null)
  const [section, setSection] = React.useState<string | null>(null)
  const [day, setDay] = React.useState<string>(WEEK_DAYS[0])
  const [filterSource, setFilterSource] = React.useState<'none' | 'profile' | 'guest'>('none')

  const filters = React.useMemo(() => ({
    department: department || undefined,
    sub_department: subDept || undefined,
    semester: semester || undefined,
    section: section || undefined,
  }), [department, subDept, semester, section]) as Partial<TimetableEntry>

  const hasDept = !!department
  const subDepts = React.useMemo(() => computeSubDeptOptions(data, department), [data, department])
  const semesters = React.useMemo(() => computeSemesterOptions(data, department, subDept), [data, department, subDept])
  const sections = React.useMemo(() => computeSectionOptions(data, department, subDept, semester), [data, department, subDept, semester])
  const subDeptRequired = hasDept && subDepts.length > 0
  const sectionRequired = hasDept && sections.length > 0

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
    const deduped = dedupeMerged(res, filters)
    filterCacheRef.current.set(key, deduped)
    return deduped
  }, [data, day, filters, filtersValid])

  // A tiny loading state when filters change for perceived performance
  const [filtering, setFiltering] = React.useState(false)
  React.useEffect(() => {
    setFiltering(true)
    const t = setTimeout(() => setFiltering(false), 60)
    return () => clearTimeout(t)
  }, [department, subDept, semester, section, day])

  React.useEffect(() => {
    if (!department) return
    const prefs = { department, sub_department: subDept || undefined, semester: semester || '', section: section || '' }
    if (user?.uid) {
      setUserPrefs(user.uid, prefs)
    } else {
      setGuestPrefs(prefs)
    }
  }, [department, subDept, semester, section, user?.uid])

  // Enable navigation state persistence for filter selections and day
  useNavigationState({
    selectors: {
      filters: ['#department-select', '#subdepartment-select', '#semester-select', '#section-select'],
    },
    restoreOnMount: true,
    captureOnUnmount: true,
  })

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

  React.useEffect(() => {
    const apply = (prefs: { department?: string; sub_department?: string; semester?: string; section?: string } | null) => {
      if (!prefs) return false
      const d = (prefs.department || '').trim()
      const sd = (prefs.sub_department || '').trim()
      const sem = (prefs.semester || '').trim()
      const sec = (prefs.section || '').trim()
      if (!d) return false
      setDepartment(d)
      setSubDept(sd || null)
      setSemester(sem || null)
      setSection(sec || null)
      return true
    }
    const run = async () => {
      if (!data || data.length === 0) return
      if (user?.uid) {
        const existing = getUserPrefs(user.uid)
        if (apply(existing)) { setFilterSource('profile'); return }
        const academic = await getProfileAcademic(user.uid)
        if (!academic) { setFilterSource('none'); return }
        const dep = mapMajorToDepartment(academic.major, departments) || departments[0] || ''
        const inferredSub = inferSubDepartment(data as TimetableEntry[], dep, academic.major, academic.semester, academic.section, WEEK_DAYS) || undefined
        const prefs = { department: dep, sub_department: inferredSub, semester: academic.semester, section: academic.section }
        setUserPrefs(user.uid, prefs)
        apply(prefs)
        setFilterSource('profile')
      } else {
        const guest = getGuestPrefs()
        if (apply(guest)) { setFilterSource('guest'); return }
        setFilterSource('none')
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, data, departments.length])

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

  // Download handler
  const printRef = React.useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = React.useState(false)

  const handleDownload = async () => {
    if (!printRef.current) return
    try {
      setDownloading(true)
      const html2canvas = (await import('html2canvas')).default
      // Balanced resolution for mobile-friendly image size
      const scale = 2
      const canvas = await html2canvas(printRef.current, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        allowTaint: true,
      })
      const link = document.createElement('a')
      link.download = `Timetable-${day}-${department}-${semester}-${section}.jpg`
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
      if (blob) {
        const url = URL.createObjectURL(blob)
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
      } else {
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  // Check if filters are sufficient for enabling download
  const allFiltersSelected = Boolean(
    department &&
    (!subDeptRequired || subDept) &&
    semester &&
    (sectionRequired ? section : true)
  )

  return (
    <section
      aria-label="Timetable content"
      role="region"
      className="mt-2 sm:mt-3 w-full max-w-5xl mx-auto overflow-hidden rounded-2xl sm:rounded-3xl border border-lime-100 bg-white shadow-sm"
    >
      <div className="bg-gradient-to-br from-[#f7fbe9] via-white to-white px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Your Timetable</h2>
          <button
            type="button"
            aria-label="Download timetable"
            onClick={handleDownload}
            disabled={!allFiltersSelected || downloading}
            className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#90c639] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#7ab332] disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
        {loading && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400" role="status" aria-live="polite">Syncing latest schedule...</p>
        )}
        {error && (
          <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800" role="alert">{error}</p>
        )}
      </div>

      {/* Progressive Selection Panel */}
      <div className="border-t border-lime-100 px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Filter Schedule</h3>
          {department || subDept || semester || section ? (
            <button
              type="button"
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
              onClick={() => { setDepartment(null); setSubDept(null); setSemester(null); setSection(null); }}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-900">
          <div className="mb-3 text-[13px] text-neutral-500 dark:text-neutral-400">
            {!filtersValid && (
              <span className="whitespace-nowrap" title="Select filters to view your classes.">Select Department{subDeptRequired ? ', Sub-department' : ''}{sectionRequired ? ', Section' : ''} to view classes.</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {department && (!subDeptRequired || subDept) && (
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
            {(sectionRequired ? (department && (!subDeptRequired || subDept) && (!semester || semester)) : false) && (
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

        {/* Timetable Cards */}
        <div className="mt-2">
          {!filtersValid ? (
            <>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm font-medium">
                Please select the required filters to see classes.
              </div>
              <TimeCards entries={[]} day={day} />
            </>
          ) : filtering ? (
            <div className="mt-4 h-32 w-full animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
          ) : (
            <TimeCards entries={filteredForDay} day={day} />
          )}
        </div>
      </div>

      {/* Mobile floating download button */}
      <button
        type="button"
        aria-label="Download timetable"
        onClick={handleDownload}
        disabled={!allFiltersSelected || downloading}
        className="sm:hidden fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-lime-500 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-lime-500/40 disabled:opacity-60"
      >
        <Download className="h-5 w-5" />
      </button>

      <div className="fixed left-[-9999px] top-0 overflow-hidden">
        <div
          ref={printRef}
          className="relative w-[900px] bg-white text-slate-900 font-sans"
          style={{
            minHeight: '1150px',
          }}
        >
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-gradient-to-br from-lime-100/30 to-transparent rounded-full blur-[60px] -translate-y-1/3 translate-x-1/6 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-gradient-to-tr from-slate-100/50 to-transparent rounded-full blur-[50px] translate-y-1/4 -translate-x-1/6 pointer-events-none" />

          <div className="relative z-10 p-12 flex flex-col h-full">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-12 border-b border-slate-100 pb-6">
              <div className="flex flex-col gap-6">
                {/* Branding */}
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center shadow-lg shadow-lime-500/20">
                    <img src="/uolink-logo.png" alt="UOLink" className="h-9 w-9 object-contain brightness-0 invert" />
                  </div>
                  <div>
                    <span className="text-4xl font-bold tracking-tight text-slate-900 block leading-none">UOLink</span>
                    <span className="text-sm font-medium text-slate-500 tracking-wide mt-1 block">Let's connect</span>
                  </div>
                </div>

                <div className="mt-5">
                  <h1 className="text-7xl font-black text-slate-900 tracking-widest mb-7 uppercase leading-none">{day}</h1>
                  <div className="flex items-center gap-3 flex-wrap translate-y-[-2px]">


                    <div className="px-6 rounded-xl bg-slate-900 text-white font-bold text-xl tracking-wide inline-flex items-center justify-center h-10 leading-none pb-5">
                      {department}
                    </div>
                    {semester && (
                      <div className="px-6 rounded-xl bg-white border-2 border-slate-100 text-slate-700 font-bold text-xl tracking-wide inline-flex items-center justify-center h-10 leading-none pb-5">
                        Semester {semester}
                      </div>
                    )}
                    {section && (
                      <div className="px-6 rounded-xl bg-white border-2 border-slate-100 text-slate-700 font-bold text-xl tracking-wide inline-flex items-center justify-center h-10 leading-none pb-5">
                        Section {section}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Year Badge */}
              <div className="text-right">
                <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center min-w-[180px]">
                  <span className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Academic Year</span>
                  <span className="block text-5xl font-black text-lime-600 tracking-tight">2025</span>
                  <span className="block text-base font-bold text-slate-600 mt-2">Fall Semester</span>
                </div>
              </div>
            </div>

            {/* Timeline Grid */}
            <div className="flex-grow relative px-4">
              {/* Vertical Line */}
              <div className="absolute left-[130px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />

              {(() => {
                const SLOTS = [
                  '08:30-09:30',
                  '09:30-10:30',
                  '10:30-11:30',
                  '11:30-12:30',
                  '12:30-01:30',
                  '01:30-02:30',
                  '02:30-03:30',
                ]
                const entries = dedupeMerged(applyFilters(data, day, filters), filters)
                const bySlot = new Map<string, TimetableEntry[]>()

                for (const e of entries) {
                  const key = normalizeLabel(e.time_slot || '')
                  if (!key) continue
                  const arr = bySlot.get(key) || []
                  arr.push(e)

                  const isLab = ((e.is_lab_session || '') as string).toLowerCase() === 'true'
                  const dep = (e.department || '').trim()
                  const span = (e as unknown as { lab_span_slots?: string[] }).lab_span_slots

                  if (isLab && dep === 'CS & IT') {
                    if (Array.isArray(span) && span.length >= 2) {
                      for (let i = 1; i < span.length; i++) {
                        const s = span[i]
                        const k = normalizeLabel(s)
                        const arr2 = bySlot.get(k) || []
                        arr2.push(e)
                        bySlot.set(k, arr2)
                      }
                    } else {
                      const labels = SLOTS.slice()
                      const idx = labels.findIndex((s) => normalizeLabel(s) === key)
                      if (idx >= 0) {
                        for (let i = 1; i < 3 && idx + i < labels.length; i++) {
                          const k = normalizeLabel(labels[idx + i])
                          const arr2 = bySlot.get(k) || []
                          arr2.push(e)
                          bySlot.set(k, arr2)
                        }
                      }
                    }
                  }
                  bySlot.set(key, arr)
                }

                return (
                  <div className="space-y-6">
                    {SLOTS.map((slotLabel, index) => {
                      const items = bySlot.get(normalizeLabel(slotLabel)) || []
                      const hasClass = items.length > 0
                      const [start, end] = slotLabel.split('-')

                      return (
                        <div key={slotLabel} className="relative grid grid-cols-[130px_24px_1fr] gap-x-6 items-center">
                          <div aria-hidden className="pointer-events-none absolute left-[142px] top-0 bottom-0 w-px bg-slate-200 z-0" />
                          <div className="w-[130px] self-center text-right relative z-10">
                            <div className="text-3xl font-black text-slate-900 tracking-tight">{start}</div>
                            <div className="text-xl font-bold text-slate-400 mt-1">{end}</div>
                          </div>

                          <div className="flex items-center justify-center self-center relative z-10">
                            <div className={`${hasClass ? 'bg-lime-500 border-white shadow-lg shadow-lime-500/30' : 'bg-white border-slate-300'} w-5 h-5 rounded-full border-[4px] transition-colors duration-300`} />
                          </div>

                          <div className="flex-grow relative z-10">
                            {hasClass ? (
                              <div className="grid gap-4">
                                {items.map((e, idx) => (
                                  <div key={idx} className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 relative overflow-hidden min-h-[140px] flex flex-col justify-center">
                                    <div className="absolute top-0 left-0 w-2 h-full bg-lime-500 " />
                                    <div className="flex justify-between items-start h-full ">
                                      <div className="flex flex-col justify-center h-full w-full">
                                        <h3 className="text-3xl font-bold text-slate-900 mb-2 leading-relaxed line-clamp-2 pr-4 pb-2 ">{(e.subject || '').replace(/\s*\($/, '').trim()}</h3>
                                        <div className="flex flex-wrap gap-4 text-lg mt-2 ">
                                          <div className="flex items-center gap-2 text-slate-700 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg leading-none pb-6">
                                            <User className="w-5 h-5 text-lime-600 translate-y-[1px] flex-shrink-0" />
                                            {cleanTeacherName(e.teacher_name || '')}
                                          </div>
                                          <div className="flex items-center gap-2 text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-lg leading-none pb-6">
                                            <MapPin className="w-5 h-5 text-slate-400 translate-y-[1px] flex-shrink-0" />
                                            {cleanRoom(e.room_name || '', ((e.is_lab_session || '') as string).toLowerCase() === 'true')}
                                          </div>
                                        </div>
                                      </div>
                                      {((e.is_lab_session || '') as string).toLowerCase() === 'true' && (
                                        <div className="inline-flex items-center justify-center h-7 leading-none pb-3 px-4 bg-lime-100 text-lime-700 text-sm font-black rounded-xl uppercase tracking-wider shadow-sm border border-lime-200 flex-shrink-0">Lab</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="h-full flex items-center py-0 min-h-[140px]">
                                <div className="inline-flex items-center justify-center gap-4 px-6 w-full h-[140px] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-slate-500">
                                  <Coffee className="w-7 h-7 text-slate-300 translate-y-[1px]" />
                                  <span className="text-2xl font-semibold tracking-wide leading-none leading-none pb-5">Free Lecture</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2.5 text-sm font-bold text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full bg-lime-500 shadow-[0_0_12px_rgba(132,204,22,0.6)]" />
                  Generated with UOLink
                </div>
                <div className="text-sm font-medium border-l-2 border-slate-100 pl-8 py-1">
                  {new Date().toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <div className="text-sm font-bold text-slate-300 tracking-wider">
                UOLLINK.COM
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}



function normalizeLabel(s: string): string {
  const cleaned = (s || '').replace(/[–—]/g, '-').replace(/\s+/g, '').trim()
  const [a, b] = cleaned.split('-')
  if (!a || !b) return cleaned
  const pad = (t: string) => {
    const [h, m] = t.split(':')
    const hh = (h || '').padStart(2, '0')
    const mm = (m || '').padStart(2, '0')
    return `${hh}:${mm}`
  }
  return `${pad(a)}-${pad(b)}`
}

function cleanRoom(s: string, isLabSession: boolean = false): string {
  let r = (s || '').trim()
  const isLabLabel = r.toLowerCase().includes('lab')
  const isLab = isLabSession || isLabLabel

  // Remove capacity info (S.C: 50)
  r = r.replace(/\(S\.?C\.?.*?\)/gi, '')

  // Extract Block
  const blockMatch = r.match(/\b([A-Z])-[A-Z]+-\d+\b/)
  const block = blockMatch ? blockMatch[1] : ''

  // Extract Room Number (3 digits preferred, else 2-4)
  const numMatch = r.match(/\b(\d{3})\b/) || r.match(/\b(\d{2,4})\b/)
  const num = numMatch ? numMatch[1] : ''

  if (num && block) {
    return `${isLab ? 'Lab' : 'Room'} ${num}, Block ${block}`
  }
  if (num) {
    return `${isLab ? 'Lab' : 'Room'} ${num}`
  }

  // If no number found, check if it's a section-like string
  if (/^[A-Z]+-\d+[A-Z]*$/i.test(r)) {
    return isLab ? 'Lab' : 'Room TBA'
  }

  // Fallback cleanup
  r = r.replace(/\((?:S\.?C\.?\s*:?\s*\d+|[A-Z0-9\-]+)\)/gi, '').trim()
  r = r.replace(/\b[A-Z]-[A-Z]+-\d+\b/g, '').trim()
  r = r.replace(/^\s*(room|lab)\s+/i, '').trim()

  if (!r) return isLab ? 'Lab' : 'Room TBA'

  return r
}

function cleanTeacherName(s: string): string {
  let name = (s || '').trim()
  // Remove leading "C " or "C." if present (case insensitive)
  name = name.replace(/^C\s*\.?\s*/i, '')
  return name
}

function normalizeSubject(s: string): string {
  const raw = (s || '').replace(/\s*\($/, '').trim().toLowerCase().replace(/\s+/g, ' ')
  const b = raw
  if (!b) return ''
  if (b.includes('numerical') && (b.includes('analysis') || b.includes('comput') || b.includes('method'))) return 'numerical-analysis'
  if (b.includes('design and analysis of algorithm') || b.includes('design & analysis of algorithm') || b.includes('daa')) return 'design-and-analysis-of-algorithms'
  if (b.includes('database systems') || b.includes('dbms')) return 'database-systems'
  if (b.includes('compiler construction') || b.includes('compiler design') || b.includes('compiler')) return 'compiler'
  if (b.includes('differential equations') || b.includes('ordinary differential equations') || b.includes('\bode\b')) return 'differential-equations'
  if (b.includes('linear algebra')) return 'linear-algebra'
  return b
}

function hasBuildingCode(s: string): boolean {
  const v = (s || '').trim()
  if (!v) return false
  if (/\b[A-Z]-[A-Z]+-\d+\b/.test(v)) return true
  if (/\bD-[A-Z]{2}-\d+\b/i.test(v)) return true
  return false
}

function roomKind(raw: string): 'room' | 'lab' | 'unknown' {
  const v = (raw || '').toLowerCase()
  if (!v) return 'unknown'
  if (v.includes('lab')) return 'lab'
  if (v.includes('room')) return 'room'
  if (/^\d{2,4}$/.test(v) || hasBuildingCode(raw)) return 'room'
  return 'unknown'
}

function isUnknownTeacher(name: string): boolean {
  const v = (name || '').toLowerCase().trim()
  if (!v) return true
  return v === 'unknown' || v === 'tbd' || v === 'n/a' || v === '-'
}

function qualityScore(e: TimetableEntry, filters: Partial<TimetableEntry>): number {
  let score = 0
  const sec = (e.section || '').trim().toUpperCase()
  const rawRoom = (e.room_name || '')
  const isLab = (((e as unknown as { is_lab_session?: string }).is_lab_session) || '').toLowerCase() === 'true'
  const room = cleanRoom(rawRoom, isLab)
  const subj = normalizeSubject(e.subject || '')
  const teacher = (e.teacher_name || '')
  if (filters.section && sec === String(filters.section).trim().toUpperCase()) score += 8
  if (!isUnknownTeacher(teacher)) score += 12
  if (teacher && !isUnknownTeacher(teacher)) score += 4
  if ((e.teacher_sap_id || '').trim()) score += 3
  const rk = roomKind(rawRoom)
  if (rk === 'room') score += isLab ? 3 : 10
  if (rk === 'lab') score += isLab ? 10 : 3
  if (rk === 'unknown') score -= 2
  if (room && /^\d/.test(room)) score += 2
  if (hasBuildingCode(rawRoom)) score += 3
  if (subj) score += 6
  if ((e.course_code || '').trim()) score += 3
  if (filters.department && (e.department || '').trim() === String(filters.department)) score += 5
  if (filters.sub_department && (e.sub_department || '').trim() === String(filters.sub_department)) score += 5
  if (filters.semester && (e.semester || '').trim() === String(filters.semester)) score += 5
  return score
}

function dedupeMerged(entries: TimetableEntry[], filters: Partial<TimetableEntry>): TimetableEntry[] {
  const groups = new Map<string, TimetableEntry[]>()
  for (const e of entries) {
    const key = [
      normalizeLabel(e.time_slot || ''),
      normalizeSubject(e.subject || ''),
    ].join('|')
    const arr = groups.get(key)
    if (arr) arr.push(e)
    else groups.set(key, [e])
  }
  const out: TimetableEntry[] = []
  for (const [, arr] of groups) {
    if (arr.length === 1) {
      out.push(arr[0])
      continue
    }
    let best = arr[0]
    let bestScore = qualityScore(best, filters)
    for (let i = 1; i < arr.length; i++) {
      const s = qualityScore(arr[i], filters)
      if (s > bestScore) {
        best = arr[i]
        bestScore = s
      } else if (s === bestScore) {
        const isLabBest = (((best as unknown as { is_lab_session?: string }).is_lab_session) || '').toLowerCase() === 'true'
        const isLabCurr = (((arr[i] as unknown as { is_lab_session?: string }).is_lab_session) || '').toLowerCase() === 'true'
        const br = cleanRoom(best.room_name || '', isLabBest)
        const rr = cleanRoom(arr[i].room_name || '', isLabCurr)
        if (rr && !br) best = arr[i]
      }
    }
    out.push(best)
  }
  return out
}
