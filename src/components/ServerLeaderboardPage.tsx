import { Suspense } from 'react'
import { Trophy } from 'lucide-react'
import ServerNavbar from './ServerNavbar'
import ClientLeaderboard from '@/components/ClientLeaderboard'
import { LeaderboardSkeleton } from '@/components/skeletons'
import SuspenseWrapper from '@/components/SuspenseWrapper'

// Server component for static leaderboard layout
export default function ServerLeaderboardPage() {
  return (
    <>
      <ServerNavbar />
      <main className="min-h-screen bg-[#f6f9ee]">
        <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {/* Static Header - Server Component */}
          <div className="mt-6">
            <div className="rounded-3xl border border-lime-100 bg-white/90 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-b from-[#f7fbe9] via-white to-white px-6 py-8 sm:px-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#90c639] text-white mb-4">
                    <Trophy className="h-8 w-8" />
                  </div>
                  <h1 className="text-3xl font-semibold text-[#1f2f10] sm:text-4xl">
                    Community Leaderboard
                  </h1>
                  <p className="mt-2 text-[#4c5c3c]">
                    Discover the top contributors who are making a difference by sharing quality notes and helping fellow students succeed
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Client-side interactive leaderboard */}
          <SuspenseWrapper fallback={<LeaderboardSkeleton />}>
            <ClientLeaderboard />
          </SuspenseWrapper>
        </div>
      </main>
    </>
  )
}