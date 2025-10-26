import Link from 'next/link'
import ClientNavbar from '@/components/ClientNavbar'

// Server component for static navbar parts
export default function ServerNavbar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 mt-2">
      <nav className="shadow-md border border-amber-200 flex items-center bg-yellow-50 rounded-full w-full max-w-7xl px-3 md:px-5">
        <div className="container mx-auto flex justify-between py-2 md:py-3 px-1 items-center">
          {/* Static Logo - Server Component */}
          <Link href="/" className="flex items-center h-8 md:h-10">
            <img src="/uolink-logo.png" alt="UOLINK" className="h-20 w-auto md:h-32 md:w-auto mr-1 md:mr-2 mt-1 md:mt-2" />
          </Link>
          
          {/* Client-side interactive parts */}
          <ClientNavbar />
        </div>
      </nav>
    </div>
  )
}

// Static navigation links for unauthenticated users (server component)
export function StaticNavLinks() {
  return (
    <div className='flex justify-end items-center gap-1.5 md:gap-3'>
      <Link href="/auth?mode=register" className="text-white bg-[#90c639] hover:bg-[#7ab332] transition-all font-semibold text-xs text-center md:text-sm py-1.5 px-2 md:py-2 md:px-4 rounded-full border-[1px] border-[#7ab332] whitespace-nowrap">
        Register
      </Link>

      <Link href="/about">
        <div className='h-8 w-12 md:h-[40px] md:w-fit hover:brightness-90 transition-all rounded-full bg-gradient-to-r from-[#90c639] to-blue-500 flex items-center justify-center text-white font-bold text-xs touch-manipulation'>
          About
        </div>
      </Link>
    </div>
  )
}

