'use client'

import React from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    // Initialize from localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const shouldDark = saved ? saved === 'dark' : false
    setIsDark(shouldDark)
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', shouldDark)
    }
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next)
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white/70 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10] dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-200 ${className}`.trim()}
    >
      {isDark ? (
        <>
          <Moon className="h-4 w-4" />
          Dark
        </>
      ) : (
        <>
          <Sun className="h-4 w-4" />
          Light
        </>
      )}
    </button>
  )
}

