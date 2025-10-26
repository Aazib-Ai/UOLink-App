import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  sizes?: string
  quality?: number
  className?: string
  onClick?: () => void
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  fill?: boolean
  style?: React.CSSProperties
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  quality = 75,
  className = '',
  onClick,
  placeholder = 'empty',
  blurDataURL,
  fill = false,
  style
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)
  
  // Use intersection observer for lazy loading (unless priority is true)
  const isIntersecting = useIntersectionObserver(imageRef, {
    threshold: 0.1,
    rootMargin: '50px',
    freezeOnceVisible: true
  })

  const shouldLoad = priority || isIntersecting

  // Handle image load success
  const handleLoad = () => {
    setIsLoaded(true)
  }

  // Handle image load error
  const handleError = () => {
    setHasError(true)
  }

  // Generate responsive sizes for mobile optimization
  const responsiveSizes = sizes || (() => {
    if (width && width <= 400) {
      return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, 400px'
    }
    if (width && width <= 800) {
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px'
    }
    return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw'
  })()

  // Optimize quality based on connection and device
  const optimizedQuality = (() => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
        return Math.min(quality, 50)
      }
      if (connection?.effectiveType === '3g') {
        return Math.min(quality, 65)
      }
    }
    return quality
  })()

  return (
    <div 
      ref={imageRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
      onClick={onClick}
    >
      {shouldLoad && !hasError ? (
        <Image
          src={src}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          priority={priority}
          sizes={responsiveSizes}
          quality={optimizedQuality}
          placeholder={placeholder}
          blurDataURL={blurDataURL}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
          style={{
            objectFit: 'cover',
            ...style
          }}
        />
      ) : hasError ? (
        <div className={`flex items-center justify-center bg-gray-100 ${
          fill ? 'absolute inset-0' : ''
        }`} style={{ width, height }}>
          <div className="text-gray-400 text-sm text-center p-4">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            Failed to load image
          </div>
        </div>
      ) : (
        <div className={`bg-gray-200 animate-pulse ${
          fill ? 'absolute inset-0' : ''
        }`} style={{ width, height }}>
          <div className="flex items-center justify-center h-full">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}