import { Suspense } from 'react'
import ServerNavbar from './ServerNavbar'
import ClientAura from '@/components/ClientAura'

// Server component for static aura page layout
export default function ServerAuraPage() {
  return (
    <>
      <ServerNavbar />
      <main className="min-h-screen bg-[#f6f9ee]">
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          {/* Static Header - Server Component */}
          <section className="relative overflow-hidden rounded-3xl border border-lime-100 bg-gradient-to-br from-[#f8fdf0] via-white to-[#eef6dc] px-6 py-12 shadow-lg sm:px-10">
            <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-[#90c639]/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-[-3rem] h-44 w-44 rounded-full bg-[#4c5c3c]/10 blur-3xl" />

            <div className="relative flex flex-col gap-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#5f7050] shadow-sm">
                UOLink aura center
              </div>

              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold text-[#1f2f10] sm:text-4xl md:text-5xl">
                  Grow your aura, lead the community
                </h1>
                <p className="mt-3 text-base text-[#4c5c3c] sm:text-lg">
                  Your aura is the heartbeat of your reputation on UOLink. Upload precise notes, drive saves and
                  upvotes, and unlock cosmetic rewards as you climb the tiers.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-lime-100 bg-white/80 px-4 py-4 text-sm text-[#4c5c3c] shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7050]">Upload</p>
                  <p className="mt-2 font-semibold text-[#1f2f10]">Quality notes earn aura instantly</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white/80 px-4 py-4 text-sm text-[#4c5c3c] shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Engage</p>
                  <p className="mt-2 font-semibold text-[#1f2f10]">Saves and upvotes multiply your progress</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-4 text-sm text-[#4c5c3c] shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Level up</p>
                  <p className="mt-2 font-semibold text-[#1f2f10]">Unlock tiers, badges, and leaderboard spots</p>
                </div>
              </div>
            </div>
          </section>

          {/* Client-side interactive aura dashboard */}
          <Suspense
            fallback={
              <div className="mt-8 rounded-3xl border border-lime-100 bg-white/95 p-6 shadow-sm">
                <div className="animate-pulse space-y-6">
                  <div className="h-5 w-40 rounded-full bg-gray-200" />
                  <div className="h-28 rounded-2xl bg-gray-200" />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-24 rounded-2xl bg-gray-200" />
                    ))}
                  </div>
                  <div className="h-32 rounded-2xl bg-gray-200" />
                </div>
              </div>
            }
          >
            <div className="mt-8">
              <ClientAura />
            </div>
          </Suspense>
        </div>
      </main>
    </>
  )
}
