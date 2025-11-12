import ServerNavbar from './ServerNavbar'
import SuspenseWrapper from '@/components/SuspenseWrapper'
import ClientTimetable from '@/components/ClientTimetable'

// Server component for static timetable layout
export default function ServerTimetablePage() {
  return (
    <>
      <ServerNavbar />
      <main className="min-h-screen bg-[#f6f9ee]">
        <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">

          {/* Client-side interactive timetable */}
          <SuspenseWrapper fallback={<div className="mt-6 h-24 rounded-2xl bg-white animate-pulse" aria-hidden="true" />}>
            <ClientTimetable />
          </SuspenseWrapper>
        </div>
      </main>
    </>
  )
}
