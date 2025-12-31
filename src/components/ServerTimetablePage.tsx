import ServerNavbar from './ServerNavbar'
import SuspenseWrapper from '@/components/SuspenseWrapper'
import ClientTimetable from '@/components/ClientTimetable'
import { PageCacheProvider } from '@/lib/cache'

// Server component for static timetable layout
export default function ServerTimetablePage() {
  return (
    <PageCacheProvider config={{
      maxMemoryBytes: 5 * 1024 * 1024, // 5MB for timetable
      maxIndexedDBBytes: 10 * 1024 * 1024, // 10MB persistent
      staleTTL: 30 * 60 * 1000, // 30 minutes stale time
    }}>
      <>
        <ServerNavbar />
        <main className="min-h-screen pt-24 sm:pt-28 md:pt-32">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-12">

            {/* Client-side interactive timetable */}
            <SuspenseWrapper fallback={<div className="mt-6 h-24 rounded-2xl bg-white animate-pulse" aria-hidden="true" />}>
              <ClientTimetable />
            </SuspenseWrapper>
          </div>
        </main>
      </>
    </PageCacheProvider>
  )
}
