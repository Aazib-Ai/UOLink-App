'use client'

import { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import ErrorBoundary from '@/components/ErrorBoundary'

interface ContributionsLayoutProps {
  children: ReactNode
  isLoading?: boolean
  loadingMessage?: string
}

export default function ContributionsLayout({
  children,
  isLoading = false,
  loadingMessage = 'Loading your contributions...'
}: ContributionsLayoutProps) {
  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-b from-[#f4fbe8] via-white to-white pt-28">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-center px-4">
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-amber-200/70 bg-white/80 px-6 py-8 text-center shadow-sm backdrop-blur-sm">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#90c639] border-t-transparent" />
              <span className="text-sm font-semibold text-gray-700">{loadingMessage}</span>
              <span className="text-xs text-gray-500">We are syncing your uploads and activity log.</span>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#f4fbe8] via-white to-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </>
  )
}