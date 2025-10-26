'use client'

import React from 'react'
import '@/styles/skeletons.css'

interface ProfileSkeletonProps {
  Navbar: React.ComponentType
}

export default function ProfileSkeleton({ Navbar }: ProfileSkeletonProps) {
  return (
    <div className="w-full skeleton-fade-in">
      <Navbar />
      <main className="w-full bg-[#f6f9ee]">
        <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {/* Back button skeleton */}
          <div className="h-10 w-20 bg-white rounded-full skeleton-pulse"></div>

          {/* Profile Header skeleton */}
          <div className="mt-6">
            <div className="w-full rounded-3xl border border-lime-100 bg-white shadow-sm p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col items-center space-y-4 lg:flex-row lg:space-x-8 lg:space-y-0">
                {/* Profile Picture */}
                <div className="h-32 w-32 bg-gray-200 rounded-full skeleton-shimmer flex-shrink-0"></div>
                
                {/* Profile Info */}
                <div className="flex-1 text-center lg:text-left space-y-3">
                  <div className="h-8 w-48 bg-gray-200 rounded skeleton-shimmer mx-auto lg:mx-0"></div>
                  <div className="h-5 w-32 bg-gray-200 rounded skeleton-shimmer mx-auto lg:mx-0"></div>
                  <div className="h-4 w-64 bg-gray-200 rounded skeleton-shimmer mx-auto lg:mx-0"></div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap justify-center lg:justify-start gap-2 mt-4">
                    <div className="h-6 w-16 bg-gray-200 rounded-full skeleton-pulse"></div>
                    <div className="h-6 w-20 bg-gray-200 rounded-full skeleton-pulse"></div>
                    <div className="h-6 w-18 bg-gray-200 rounded-full skeleton-pulse"></div>
                  </div>
                  
                  {/* Social Links */}
                  <div className="flex justify-center lg:justify-start gap-3 mt-4">
                    <div className="h-8 w-8 bg-gray-200 rounded skeleton-pulse"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded skeleton-pulse"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded skeleton-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Stats skeleton */}
          <div className="mt-6">
            <div className="w-full rounded-3xl border border-lime-100 bg-white shadow-sm p-6 sm:p-8 lg:p-10">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="text-center space-y-2" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="h-8 w-12 bg-gray-200 rounded skeleton-shimmer mx-auto"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded skeleton-shimmer mx-auto"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Profile About skeleton */}
          <div className="mt-6">
            <div className="w-full rounded-3xl border border-lime-100 bg-white shadow-sm p-6 sm:p-8 lg:p-10">
              <div className="space-y-4">
                <div className="h-6 w-32 bg-gray-200 rounded skeleton-shimmer"></div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 rounded skeleton-shimmer"></div>
                  <div className="h-4 w-3/4 bg-gray-200 rounded skeleton-shimmer"></div>
                  <div className="h-4 w-5/6 bg-gray-200 rounded skeleton-shimmer"></div>
                </div>
                
                {/* Skills */}
                <div className="space-y-2">
                  <div className="h-5 w-16 bg-gray-200 rounded skeleton-shimmer"></div>
                  <div className="flex flex-wrap gap-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-6 w-20 bg-gray-200 rounded-full skeleton-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section skeleton */}
          <div className="mt-6">
            <div className="w-full rounded-3xl border border-lime-100 bg-white shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-lime-50 p-6 sm:p-8 lg:p-10">
                <div className="h-6 w-32 bg-gray-200 rounded skeleton-shimmer"></div>
                <div className="h-4 w-16 bg-gray-200 rounded skeleton-shimmer"></div>
              </div>

              {/* Filters */}
              <div className="border-b border-lime-50 px-6 py-4 sm:px-8 lg:px-10">
                <div className="flex flex-wrap gap-3">
                  <div className="h-10 w-48 bg-gray-200 rounded-lg skeleton-shimmer"></div>
                  <div className="h-10 w-32 bg-gray-200 rounded-lg skeleton-shimmer"></div>
                </div>
              </div>

              {/* Notes List */}
              <div className="p-6 sm:p-8 lg:p-10" style={{ minHeight: '500px' }}>
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg" style={{ animationDelay: `${i * 0.1}s` }}>
                      <div className="h-16 w-12 bg-gray-200 rounded flex-shrink-0 skeleton-shimmer"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-3/4 bg-gray-200 rounded skeleton-shimmer"></div>
                        <div className="h-4 w-1/2 bg-gray-200 rounded skeleton-shimmer"></div>
                        <div className="h-4 w-2/3 bg-gray-200 rounded skeleton-shimmer"></div>
                      </div>
                      <div className="h-8 w-16 bg-gray-200 rounded flex-shrink-0 skeleton-shimmer"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}