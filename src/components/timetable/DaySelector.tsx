'use client'

import React from 'react'

type DaySelectorProps = {
  days: string[]
  densities: Record<string, number>
  selectedDay: string
  onSelect: (day: string) => void
}

export function DaySelector({ days, densities, selectedDay, onSelect }: DaySelectorProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null)

  const maxDensity = Math.max(1, ...days.map((d) => densities[d] || 0))

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    const btns = containerRef.current?.querySelectorAll('button[data-day]')
    if (!btns || btns.length === 0) return
    const activeIndex = Array.from(btns).findIndex((el) => (el as HTMLButtonElement).dataset.selected === 'true')
    let nextIndex = activeIndex
    if (e.key === 'ArrowRight') nextIndex = Math.min(btns.length - 1, activeIndex + 1)
    if (e.key === 'ArrowLeft') nextIndex = Math.max(0, activeIndex - 1)
    const nextEl = btns[nextIndex] as HTMLButtonElement | undefined
    nextEl?.focus()
  }

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const t = e.touches[0]
    if (!t) return
    startPosRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const s = startPosRef.current
    startPosRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    const threshold = 80
    const dominant = Math.abs(dx) > Math.abs(dy) * 2
    if (Math.abs(dx) >= threshold && dominant) {
      const idx = Math.max(0, days.indexOf(selectedDay))
      const nextIdx = dx > 0 ? Math.max(0, idx - 1) : Math.min(days.length - 1, idx + 1)
      if (nextIdx !== idx) onSelect(days[nextIdx])
    }
  }

  return (
    <div className="mt-3" aria-label="Select day">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Select Day</h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Schedule density</span>
      </div>
      <div ref={containerRef} role="tablist" aria-label="Days" className="mt-2" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Mobile: two-line grid, Desktop: wrap */}
        <div className="grid grid-cols-3 gap-2 px-1 py-1 sm:flex sm:flex-wrap sm:gap-2">
          {days.map((day) => {
            const count = densities[day] || 0
            const fillPct = Math.round((count / maxDensity) * 100)
            const selected = selectedDay === day
            const lvl = count === 0 ? 0 : fillPct < 34 ? 1 : fillPct < 67 ? 2 : 3
            const lvlLabel = lvl === 0 ? 'No classes' : lvl === 1 ? 'Light' : lvl === 2 ? 'Moderate' : 'Busy'
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={selected}
                data-day
                data-selected={String(selected)}
                onKeyDown={handleKeyDown}
                onClick={() => onSelect(day)}
                className={[
                  'inline-flex w-full sm:w-auto items-center justify-between gap-2 rounded-lg border text-xs font-semibold px-3 py-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-lime-500/40',
                  selected
                    ? 'bg-lime-500 text-white border-lime-600 ring-1 ring-lime-500 shadow-md'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-lime-500 hover:text-lime-700 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:border-lime-500 dark:hover:text-lime-400'
                ].join(' ')}
                aria-label={`${day} (${count} classes, ${lvlLabel} schedule)`}
                title={`${lvlLabel} schedule`}
              >
                <span className="truncate">{day}</span>
                {/* Mobile density: compact donut gauge */}
                <span className="relative sm:hidden inline-flex h-4 w-4" aria-hidden="true">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(${selected ? '#d9f99d' : '#84cc16'} ${fillPct}%, ${selected ? 'rgba(255,255,255,0.3)' : '#e5e7eb'} 0)` }}
                  />
                  <span className={`absolute inset-[3px] rounded-full ${selected ? 'bg-lime-500' : 'bg-white dark:bg-neutral-800'}`} />
                </span>
                <span
                  aria-hidden="true"
                  className={`relative hidden sm:inline-flex h-1.5 w-12 md:w-16 rounded-full overflow-hidden ${selected ? 'bg-lime-700/30' : 'bg-neutral-100 dark:bg-neutral-700'}`}
                >
                  <span
                    className={`absolute left-0 top-0 h-full transition-[width] duration-300 ${selected ? 'bg-white' : 'bg-lime-500'}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
