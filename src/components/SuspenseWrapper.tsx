'use client'

import { Suspense, ReactNode } from 'react'
import '@/styles/skeletons.css'

interface SuspenseWrapperProps {
  children: ReactNode
  fallback: ReactNode
  className?: string
}

export default function SuspenseWrapper({ children, fallback, className = '' }: SuspenseWrapperProps) {
  return (
    <div className={`suspense-wrapper ${className}`}>
      <Suspense fallback={
        <div className="skeleton-fade-in">
          {fallback}
        </div>
      }>
        <div className="content-fade-in">
          {children}
        </div>
      </Suspense>
    </div>
  )
}