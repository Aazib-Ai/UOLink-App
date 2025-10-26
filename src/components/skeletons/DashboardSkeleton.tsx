'use client'

import React from 'react'
import '@/styles/skeletons.css'

interface DashboardSkeletonProps {
  count?: number
}

export default function DashboardSkeleton({ count = 6 }: DashboardSkeletonProps) {
  return (
    <div className="container md:mt-16 mt-14 mx-auto px-4 pb-8 pt-4 skeleton-fade-in">
      {/* Donators section skeleton */}
      <div className="flex justify-center items-center flex-col mb-4">
        <div className="h-6 w-48 bg-gray-200 rounded skeleton-shimmer"></div>
      </div>

      {/* Donate link skeleton */}
      <div className="flex flex-row justify-center items-center mb-4">
        <div className="h-4 w-64 bg-gray-200 rounded skeleton-shimmer"></div>
      </div>

      {/* Quick Actions skeleton */}
      <div className="flex justify-center items-center gap-4 mt-4 mb-6">
        <div className="h-10 w-32 bg-lime-100 rounded-full skeleton-pulse"></div>
        <div className="h-10 w-24 bg-amber-100 rounded-full skeleton-pulse"></div>
      </div>

      {/* Filters skeleton */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-24 bg-gray-200 rounded-lg skeleton-shimmer"></div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg skeleton-shimmer"></div>
          <div className="h-10 w-28 bg-gray-200 rounded-lg skeleton-shimmer"></div>
        </div>
      </div>

      {/* Search skeleton */}
      <div className="mb-6">
        <div className="h-12 w-full bg-gray-200 rounded-lg skeleton-shimmer"></div>
      </div>

      {/* Sort skeleton */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 w-32 bg-gray-200 rounded skeleton-shimmer"></div>
        <div className="h-10 w-40 bg-gray-200 rounded-lg skeleton-shimmer"></div>
      </div>

      {/* Notes Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="w-full bg-white rounded-lg shadow-lg p-4 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-6 overflow-hidden"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Mobile: Image at top, Desktop: Image on right */}
            <div className="flex-shrink-0 md:order-2">
              <div className="h-32 w-full md:h-48 md:w-36 bg-gray-200 rounded-lg skeleton-shimmer"></div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col justify-center flex-grow space-y-3 md:order-1">
              <div className="h-6 md:h-7 w-3/4 bg-gray-200 rounded skeleton-shimmer"></div>
              <div className="h-4 md:h-5 w-1/2 bg-gray-200 rounded skeleton-shimmer"></div>
              <div className="h-4 md:h-5 w-2/3 bg-gray-200 rounded skeleton-shimmer"></div>
              <div className="h-4 md:h-5 w-1/2 bg-gray-200 rounded skeleton-shimmer"></div>
              <div className="flex flex-row gap-2 mt-4">
                <div className="h-10 w-24 bg-gray-200 rounded skeleton-shimmer skeleton-touch-target"></div>
                <div className="h-10 w-10 bg-gray-200 rounded skeleton-shimmer skeleton-touch-target"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button skeleton */}
      <div className="flex justify-center py-8">
        <div className="h-12 w-32 bg-gray-200 rounded-lg skeleton-pulse"></div>
      </div>

      {/* Footer skeleton */}
      <div className="text-center pt-14">
        <div className="h-6 w-24 bg-gray-200 rounded skeleton-shimmer mx-auto"></div>
      </div>
    </div>
  )
}