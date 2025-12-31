import { Suspense } from 'react'
import Link from 'next/link'
import { MorphingText } from "@/components/ui/morphing-text"
import { DONATORS } from "./dashboard/constants"
import ClientDashboard from '@/components/ClientDashboard'
import { DashboardSkeleton } from '@/components/skeletons'
import SuspenseWrapper from '@/components/SuspenseWrapper'
import { PageCacheProvider } from '@/lib/cache'

// Server component for static dashboard layout
export default function ServerDashboard() {
  return (
    <PageCacheProvider config={{
      maxMemoryBytes: 15 * 1024 * 1024, // 15MB for dashboard
      maxIndexedDBBytes: 30 * 1024 * 1024, // 30MB persistent
      staleTTL: 5 * 60 * 1000, // 5 minutes stale time
    }}>
      <div className="container md:mt-16 mt-14 mx-auto px-4 pb-8 pt-4">
        {/* Static Donators section - Server Component */}
        {DONATORS.length > 0 && (
          <div className="flex justify-center items-center flex-col">
            <MorphingText texts={DONATORS.map((contributor) => `${contributor.name}-${contributor.amount}`)} />
          </div>
        )}

        {/* Static Donate link - Server Component */}
        <Link href="/donate">
          <div className="flex flex-row justify-center animate-pulse duration-700 hover:animate-none items-center">
            <h1 className="text-xs sm:text-sm hover:underline md:hover:border-x px-3 sm:px-5 md:hover:border-[#90c639] font-bold text-center hover:text-[#90c639] transition-all duration-200 ">
              Database <span className="text-amber-600 hover:text-[#90c639]">Cost</span> Rising.
              <span className="text-[#90c639]">Donate</span> to Keep Us Running!
            </h1>
          </div>
        </Link>


        {/* Client-side interactive dashboard */}
        <SuspenseWrapper fallback={<DashboardSkeleton />}>
          <ClientDashboard />
        </SuspenseWrapper>

        {/* Static Footer - Server Component */}
        <div className="text-center opacity-90 pt-14 flex flex-col">
          <div className="hover:-rotate-3 transition-all duration-300">
            <span className="text-[#90c639] font-bold">
              <span className="text-black">~ by</span> Aazib
            </span>
          </div>
        </div>
      </div>
    </PageCacheProvider>
  )
}