'use client'

interface MorphingTextSkeletonProps {
  className?: string
}

export default function MorphingTextSkeleton({ className = "" }: MorphingTextSkeletonProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="text-black font-bold text-center md:text-sm h-14 flex items-center justify-center">
        <div className="w-48 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  )
}