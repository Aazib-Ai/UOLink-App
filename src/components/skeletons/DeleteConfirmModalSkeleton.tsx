'use client'

export default function DeleteConfirmModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse"></div>
            <div className="w-24 h-6 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="w-full h-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-full h-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="space-y-2">
            <div className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-5/6 h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-4/5 h-4 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 h-12 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex-1 h-12 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}