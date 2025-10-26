import { Suspense } from 'react'
import ServerDashboard from '@/components/ServerDashboard'
import { DashboardSkeleton } from '@/components/skeletons'
import SuspenseWrapper from '@/components/SuspenseWrapper'

interface ClientHomeProps {
  children?: React.ReactNode
}

// Server component for home page - no client-side auth check needed
export default function ClientHome({ children }: ClientHomeProps) {
  return (
    <SuspenseWrapper fallback={<DashboardSkeleton />}>
      <ServerDashboard />
    </SuspenseWrapper>
  )
}