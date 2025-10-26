'use client'

import { useSplash } from '@/contexts/SplashContext'
import { ReactNode } from 'react'

interface MainContentProps {
  children: ReactNode
}

export default function MainContent({ children }: MainContentProps) {
  // The CSS and script handle the splash screen timing
  // This component just wraps the content
  return (
    <div className="main-content-wrapper">
      {children}
    </div>
  )
}