import React from 'react'
import { OptimizedImage } from './OptimizedImage'
import { optimizeImageUrl, getOptimalQuality } from '@/lib/image/optimization'

interface OptimizedProfileImageProps {
  src?: string | null
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  priority?: boolean
  fallbackInitials?: string
}

const sizeConfig = {
  sm: { width: 32, height: 32, textSize: 'text-xs' },
  md: { width: 48, height: 48, textSize: 'text-sm' },
  lg: { width: 64, height: 64, textSize: 'text-base' },
  xl: { width: 96, height: 96, textSize: 'text-lg' }
}

export const OptimizedProfileImage: React.FC<OptimizedProfileImageProps> = ({
  src,
  alt,
  size = 'md',
  className = '',
  priority = false,
  fallbackInitials
}) => {
  const { width, height, textSize } = sizeConfig[size]
  
  // Generate initials from alt text if not provided
  const getInitials = () => {
    if (fallbackInitials) return fallbackInitials
    
    return alt
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Render fallback avatar
  const renderFallback = () => (
    <div 
      className={`
        flex items-center justify-center
        bg-gradient-to-br from-blue-400 to-purple-500
        text-white font-semibold
        rounded-full
        ${textSize}
        ${className}
      `}
      style={{ width, height }}
    >
      {getInitials()}
    </div>
  )

  // If no source provided, show fallback
  if (!src) {
    return renderFallback()
  }

  // Optimize image URL for profile pictures
  const optimizedSrc = optimizeImageUrl(src, {
    width: width * 2, // 2x for retina displays
    height: height * 2,
    quality: getOptimalQuality(85) // Higher quality for profile images
  })

  return (
    <OptimizedImage
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      quality={85}
      className={`rounded-full object-cover ${className}`}
      sizes={`${width}px`}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
    />
  )
}