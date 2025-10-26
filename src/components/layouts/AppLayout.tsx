'use client'

import AppWithScanner from '../AppWithScanner'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppWithScanner>
      {children}
    </AppWithScanner>
  )
}