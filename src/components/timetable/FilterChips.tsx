'use client'

import React from 'react'

type FilterChipsProps = {
  label: string
  options: string[]
  selected: string | null
  onSelect: (val: string | null) => void
  ariaLabel?: string
}

export function FilterChips({ label, options, selected, onSelect, ariaLabel }: FilterChipsProps) {
  const id = React.useId()
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    const btns = containerRef.current?.querySelectorAll('button[data-chip]')
    if (!btns || btns.length === 0) return
    const activeIndex = Array.from(btns).findIndex((el) => (el as HTMLButtonElement).dataset.selected === 'true')
    let nextIndex = activeIndex
    if (e.key === 'ArrowRight') nextIndex = Math.min(btns.length - 1, activeIndex + 1)
    if (e.key === 'ArrowLeft') nextIndex = Math.max(0, activeIndex - 1)
    const nextEl = btns[nextIndex] as HTMLButtonElement | undefined
    nextEl?.focus()
  }

  const isSelected = (val: string | null) => selected === val

  return (
    <div className="w-full" aria-label={ariaLabel || label}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-[#334125]">{label}</label>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-[#4c5c3c] hover:text-[#1f2f10] underline decoration-dotted"
            aria-label={`Clear ${label} filter`}
          >Clear</button>
        )}
      </div>

      <div ref={containerRef} id={id} role="listbox" aria-label={`${label} options`} className="mt-2">
        <div className="flex flex-wrap gap-1.5 px-1 py-1">
          {options.length === 0 ? (
            <span className="text-xs text-[#4c5c3c]">No options available</span>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                type="button"
                data-chip
                data-selected={String(isSelected(opt))}
                onKeyDown={handleKeyDown}
                onClick={() => onSelect(opt)}
                aria-pressed={isSelected(opt)}
                aria-label={`${label}: ${opt}${isSelected(opt) ? ' (selected)' : ''}`}
                className={[
                  'inline-flex items-center gap-1 rounded-full border text-[11px] font-medium px-2.5 py-1 shadow-sm transition',
                  isSelected(opt)
                    ? 'bg-[#90c639] text-white border-[#7ab332]'
                    : 'bg-white text-[#334125] border-lime-200 hover:border-[#90c639] hover:text-[#1f2f10]'
                ].join(' ')}
              >
                <span className="truncate max-w-[8rem]">{opt}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
