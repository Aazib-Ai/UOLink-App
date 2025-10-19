'use client'

import Skeleton from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"

interface NotesLoaderProps {
  count?: number;
}

const NotesLoader: React.FC<NotesLoaderProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="z-70 w-full bg-zinc-50 rounded-lg shadow-lg p-4 flex flex-row space-x-6 overflow-hidden"
        >
          {/* Left Section Skeletons */}
          <div className="flex flex-col justify-center flex-grow">
            <Skeleton height={30} width={200} className="mb-4" /> {/* Title */}
            <Skeleton height={20} width={140} className="mb-4" /> {/* Subtitle */}
            <Skeleton height={20} width={180} className="mb-4" /> {/* Subtitle */}
            <Skeleton height={20} width={160} className="mb-4" /> {/* Another subtitle */}
            <div className="flex flex-row gap-2">
              <Skeleton height={40} width={100} className="mt-4" /> {/* Button */}
              <Skeleton height={40} width={40} className="mt-4" /> {/* Icon */}
            </div>
          </div>

          {/* Right Section Skeleton */}
          <div className="flex-shrink-0">
            <Skeleton height={200} width={150} className="rounded-lg" /> {/* Image Placeholder */}
          </div>
        </div>
      ))}
    </div>
  )
}

export default NotesLoader