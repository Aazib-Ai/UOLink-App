'use client'

interface PDFViewerSkeletonProps {
  title?: string
}

export default function PDFViewerSkeleton({ title }: PDFViewerSkeletonProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-lime-50 to-green-50 border-b border-lime-100 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#1f2f10] truncate sm:text-base">
              {title || 'PDF Viewer'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* PDF Content Area */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 px-2 py-2 sm:px-4 sm:py-4">
        <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-white shadow-lg border border-gray-200 h-[75vh] min-h-[360px] max-h-[860px]">
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">Loading PDF Viewer...</p>
              <p className="text-xs text-gray-500 mt-1">Preparing document interface</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}