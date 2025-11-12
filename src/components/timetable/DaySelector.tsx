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

  return (
    <div className="mt-3" aria-label="Select day">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#334125]">Day</h3>
        <span className="text-xs text-[#4c5c3c]">Schedule density preview</span>
      </div>
      <div ref={containerRef} role="tablist" aria-label="Days" className="mt-2">
        {/* Mobile: two-line grid, Desktop: wrap */}
        <div className="grid grid-cols-3 gap-1.5 px-1 py-1 sm:flex sm:flex-wrap sm:gap-1.5">
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
                  'inline-flex w-full sm:w-auto items-center justify-between gap-2 rounded-full border text-xs font-semibold px-2.5 py-1 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#90c639]/40',
                  selected
                    ? 'bg-[#ecf8cf] text-[#1f2f10] border-[#90c639] ring-2 ring-[#90c639]/40'
                    : 'bg-white text-[#334125] border-lime-200 hover:border-[#90c639] hover:text-[#1f2f10]'
                ].join(' ')}
                aria-label={`${day} (${count} classes, ${lvlLabel} schedule)`}
                title={`${lvlLabel} schedule`}
              >
                <span className="truncate">{day}</span>
                {/* Mobile density: compact donut gauge */}
                <span className="relative sm:hidden inline-flex h-4 w-4" aria-hidden="true">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(#90c639 ${fillPct}%, #e5e7eb 0)` }}
                  />
                  <span className="absolute inset-[3px] rounded-full bg-white" />
                </span>
                <span
                  aria-hidden="true"
                  className="relative hidden sm:inline-flex h-2 w-12 md:w-16 rounded-full bg-neutral-200 overflow-hidden"
                >
                  <span
                    className="absolute left-0 top-0 h-full bg-[#90c639] transition-[width] duration-300"
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
