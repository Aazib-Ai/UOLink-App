'use client'

export default function ScannerSkeleton() {
  return (
    <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-white">
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-lg font-semibold">Loading Scanner...</p>
          <p className="text-sm text-white/70">Preparing camera interface</p>
        </div>
      </div>
    </div>
  )
}