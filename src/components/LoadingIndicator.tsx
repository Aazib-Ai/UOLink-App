'use client'

import React from 'react'

interface LoadingIndicatorProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingIndicator({ 
  message = 'Loading...', 
  size = 'md',
  className = '' 
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  }

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} border-2 border-[#90c639] border-t-transparent rounded-full animate-spin`}></div>
      {message && (
        <span className="text-sm text-gray-600 animate-pulse">
          {message}
        </span>
      )}
    </div>
  )
}