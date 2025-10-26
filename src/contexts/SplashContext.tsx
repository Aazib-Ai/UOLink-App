'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { isAppInstalled } from '@/lib/pwa'

interface SplashContextValue {
  isSplashVisible: boolean
  isSplashComplete: boolean
}

const SplashContext = createContext<SplashContextValue | undefined>(undefined)

export function SplashProvider({ children }: { children: ReactNode }) {
  // Check if app is installed immediately
  const isInstalled = typeof window !== 'undefined' ? isAppInstalled() : false
  
  // Initialize state based on whether app is installed
  const [isSplashVisible, setIsSplashVisible] = useState(isInstalled)
  const [isSplashComplete, setIsSplashComplete] = useState(!isInstalled)

  useEffect(() => {
    // Only run timer if splash should be visible
    if (isInstalled && isSplashVisible) {
      // Hide splash screen after 2 seconds
      const timer = setTimeout(() => {
        setIsSplashVisible(false)
        // Mark splash as complete after fade out animation
        setTimeout(() => {
          setIsSplashComplete(true)
        }, 500) // Wait for fade out animation
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isInstalled, isSplashVisible])

  return (
    <SplashContext.Provider value={{ isSplashVisible, isSplashComplete }}>
      {children}
    </SplashContext.Provider>
  )
}

export const useSplash = () => {
  const context = useContext(SplashContext)
  if (!context) {
    throw new Error('useSplash must be used within a SplashProvider')
  }
  return context
}