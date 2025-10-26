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
