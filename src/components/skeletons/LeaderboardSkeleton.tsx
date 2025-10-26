'use client'

import React from 'react'
import { Trophy } from 'lucide-react'
import '@/styles/skeletons.css'

interface LeaderboardSkeletonProps {
  count?: number
}

export default function LeaderboardSkeleton({ count = 10 }: LeaderboardSkeletonProps) {
  return (
    <main className="min-h-screen bg-[#f6f9ee] skeleton-fade-in">
      <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* Static Header - Keep this as it's already server-rendered */}
        <div className="mt-6">
          <div className="rounded-3xl border border-lime-100 bg-white/90 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-b from-[#f7fbe9] via-white to-white px-6 py-8 sm:px-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#90c639] text-white mb-4">
                  <Trophy className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-semibold text-[#1f2f10] sm:text-4xl">
                  Community Leaderboard
                </h1>
                <p className="mt-2 text-[#4c5c3c]">
                  Discover the top contributors who are making a difference by sharing quality notes and helping fellow students succeed
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Content Skeleton */}
        <div className="mt-6">
          <div className="rounded-3xl border border-lime-100 bg-white shadow-sm overflow-hidden">
            {/* Header skeleton */}
            <div className="border-b border-lime-50 px-6 py-4 sm:px-8">
              <div className="flex items-center justify-between">
                <div className="h-6 w-32 bg-gray-200 rounded skeleton-shimmer"></div>
                <div className="h-4 w-24 bg-gray-200 rounded skeleton-shimmer"></div>
              </div>
            </div>

            {/* Leaderboard entries skeleton */}
            <div className="divide-y divide-lime-50">
              {Array.from({ length: count }, (_, index) => (
                <div key={index} className="px-6 py-4 sm:px-8" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      {index < 3 ? (
                        <div className="h-8 w-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full skeleton-pulse"></div>
                      ) : (
                        <div className="h-6 w-6 bg-gray-200 rounded skeleton-shimmer"></div>
                      )}
                    </div>

                    {/* Profile Picture */}
                    <div className="h-12 w-12 bg-gray-200 rounded-full flex-shrink-0 skeleton-shimmer"></div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-5 w-32 bg-gray-200 rounded skeleton-shimmer"></div>
                      <div className="h-4 w-24 bg-gray-200 rounded skeleton-shimmer"></div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right space-y-1">
                      <div className="h-6 w-12 bg-gray-200 rounded ml-auto skeleton-shimmer"></div>
                      <div className="h-4 w-16 bg-gray-200 rounded ml-auto skeleton-shimmer"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more skeleton */}
            <div className="border-t border-lime-50 px-6 py-4 sm:px-8">
              <div className="flex justify-center">
                <div className="h-10 w-32 bg-gray-200 rounded-lg skeleton-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional stats skeleton */}
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-lime-100 bg-white p-6 shadow-sm" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="text-center space-y-3">
                  <div className="h-8 w-8 bg-gray-200 rounded mx-auto skeleton-pulse"></div>
                  <div className="h-8 w-12 bg-gray-200 rounded mx-auto skeleton-shimmer"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded mx-auto skeleton-shimmer"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}