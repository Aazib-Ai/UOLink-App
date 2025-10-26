import ServerNavbar from '@/components/ServerNavbar'
import ClientHome from '@/components/ClientHome'
import { Suspense } from 'react'
import { DashboardSkeleton } from '@/components/skeletons'
import SuspenseWrapper from '@/components/SuspenseWrapper'

// Server component - no 'use client' directive
export default function Home() {
  return (
    <>
      <ServerNavbar />
      <SuspenseWrapper fallback={<DashboardSkeleton />}>
        <ClientHome />
      </SuspenseWrapper>
    </>
  )
}
