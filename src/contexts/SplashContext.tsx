'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { isAppInstalled } from '@/lib/pwa'

interface SplashContextValue {
  isSplashVisible: boolean
  isSplashComplete: boolean
}

const SplashContext = createContext<SplashContextValue | undefined>(undefined)

export function SplashProvider({ children }: { children: ReactNode }) {
  // Start with consistent state to avoid hydration issues
  const [isSplashVisible, setIsSplashVisible] = useState(false)
  const [isSplashComplete, setIsSplashComplete] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    // Check if app is installed only after client-side hydration
    const isInstalled = isAppInstalled()

    console.log('SplashProvider - App installed:', isInstalled);

    // Only show splash for PWA mode, and with failsafe
    if (isInstalled) {
      setIsSplashVisible(true)
      setIsSplashComplete(false)

      // Hide splash screen after 1.5 seconds (shorter to prevent getting stuck)
      const timer = setTimeout(() => {
        console.log('SplashProvider - Hiding splash screen');
        setIsSplashVisible(false)
        // Mark splash as complete after fade out animation
        setTimeout(() => {
          setIsSplashComplete(true)
          console.log('SplashProvider - Splash complete');
        }, 300) // Shorter fade out
      }, 1500) // Shorter display time

      // Failsafe: Always hide splash after 3 seconds regardless
      const failsafeTimer = setTimeout(() => {
        console.log('SplashProvider - Failsafe triggered, forcing splash to hide');
        setIsSplashVisible(false)
        setIsSplashComplete(true)
      }, 3000)

      return () => {
        clearTimeout(timer)
        clearTimeout(failsafeTimer)
      }
    }
  }, [isClient])

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