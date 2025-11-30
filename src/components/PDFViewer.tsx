'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, LogIn, Maximize2, RefreshCw, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import PWADownloadButton from './PWADownloadButton'
import PDFThumbnail from './PDFThumbnail'
import dynamic from 'next/dynamic'

// Lazy load the mobile PDF viewer
const MobilePDFViewer = dynamic(() => import('./MobilePDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime-500 border-t-transparent"></div>
    </div>
  ),
})

interface PDFViewerProps {
  url: string
  title?: string
}

interface ViewerDimensions {
  minHeight: number
  height: string
  maxHeight: string
}

const buildRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return '/note'
  }

  return window.location.pathname + window.location.search
}

const PDFViewer: React.FC<PDFViewerProps> = ({ url, title }) => {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [viewerDimensions, setViewerDimensions] = useState<ViewerDimensions>({
    minHeight: 360,
    height: '75vh',
    maxHeight: '860px',
  })

  const isAuthenticated = Boolean(user)
  const treatAsAuthenticated = authLoading || isAuthenticated

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const computeLayout = () => {
      const width = window.innerWidth
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const mobile = width < 640 || (isTouchDevice && width < 768)
      setIsMobile(mobile)

      if (width < 480) {
        setViewerDimensions({
          minHeight: 280,
          height: 'calc(100vh - 200px)',
          maxHeight: 'calc(100vh - 96px)',
        })
        return
      }

      if (width < 768) {
        setViewerDimensions({
          minHeight: 340,
          height: 'calc(100vh - 220px)',
          maxHeight: 'calc(100vh - 120px)',
        })
        return
      }

      if (width < 1024) {
        setViewerDimensions({
          minHeight: 420,
          height: '75vh',
          maxHeight: '820px',
        })
        return
      }

      setViewerDimensions({
        minHeight: 480,
        height: '80vh',
        maxHeight: '900px',
      })
    }

    computeLayout()
    window.addEventListener('resize', computeLayout)

    return () => {
      window.removeEventListener('resize', computeLayout)
    }
  }, [])

  const shouldUseMobileFallback = isMobile

  const handleIframeLoad = () => {
    setLoading(false)
    setError(null)
  }

  const handleIframeError = () => {
    if (isMobile && retryCount < 2) {
      // Retry with different viewer on mobile
      setRetryCount(prev => prev + 1)
      setError(`Retrying... (${retryCount + 1}/3)`)
      setTimeout(() => {
        setError(null)
        // Force reload by updating a state
        setLoading(true)
      }, 1000)
    } else {
      setLoading(false)
      setError('PDF loading failed on mobile. Please open in a new tab for better viewing.')
    }
  }

  // Add timeout for iframe loading on mobile with progressive fallback
  useEffect(() => {
    if (!isMobile || !url) return

    // Show loading message after 3 seconds
    const loadingMessageTimeout = setTimeout(() => {
      if (loading) {
        setError('PDF loading taking longer than expected on mobile...')
      }
    }, 3000)

    // Show timeout error with new tab option after 8 seconds
    const timeoutErrorTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false)
        setError('PDF loading timed out on mobile. Please open in a new tab for better viewing.')
      }
    }, 8000) // Reduced to 8 seconds for better UX

    return () => {
      clearTimeout(loadingMessageTimeout)
      clearTimeout(timeoutErrorTimeout)
    }
  }, [isMobile, loading, url])

  const handleRequireLogin = useCallback(() => {
    const redirect = buildRedirectUrl()
    router.push(`/auth?redirect=${encodeURIComponent(redirect)}`)
  }, [router])

  const handleRetry = useCallback(() => {
    if (isMobile && retryCount < 3) {
      setRetryCount(prev => prev + 1)
      setError(null)
      setLoading(true)
    }
  }, [isMobile, retryCount])

  const inlineUrl = useMemo(() => {
    if (!url) {
      return ''
    }

    // For mobile, use direct PDF URL
    // Mobile browsers have built-in PDF viewers and don't need external viewers
    // External viewers (Mozilla PDF.js, Google Docs) have CORS issues with R2/Firebase storage
    if (shouldUseMobileFallback) {
      return url
    }

    if (treatAsAuthenticated) {
      return url
    }

    const separator = url.includes('#') ? '&' : '#'
    const fragment = 'toolbar=0&navpanes=0&scrollbar=1'
    return `${url}${separator}${fragment}`
  }, [treatAsAuthenticated, url, shouldUseMobileFallback])

  // Use custom mobile viewer for mobile devices
  if (isMobile && url) {
    return <MobilePDFViewer url={url} title={title} />
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Mobile-First Header */}
      <div className="bg-gradient-to-r from-lime-50 to-green-50 border-b border-lime-100 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#1f2f10] truncate sm:text-base">{title || 'PDF Viewer'}</h2>
            {!treatAsAuthenticated && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                <Shield className="h-3 w-3 flex-shrink-0" />
                <span className="hidden sm:inline">Sign in to download and unlock features</span>
                <span className="sm:hidden">Sign in to unlock features</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAuthenticated ? (
              <>
                <PWADownloadButton
                  url={url}
                  title={title}
                />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-lime-600 active:scale-95 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
                >
                  <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                  <span className="sm:hidden">Open</span>
                </a>
              </>
            ) : (
              <button
                onClick={handleRequireLogin}
                className="flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 active:scale-95 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
              >
                <LogIn className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Login to Unlock</span>
                <span className="sm:hidden">Unlock</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Responsive PDF Display */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 px-2 py-2 sm:px-4 sm:py-4">
        {!url ? (
          <div className="flex h-48 sm:h-64 items-center justify-center">
            <div className="rounded-lg bg-white px-4 py-3 text-xs sm:text-sm text-gray-600 shadow-sm border border-gray-200">
              No file URL available
            </div>
          </div>
        ) : (
          <div
            className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-white shadow-lg border border-gray-200"
            style={{
              minHeight: viewerDimensions.minHeight,
              height: viewerDimensions.height,
              maxHeight: viewerDimensions.maxHeight,
            }}
          >
            <iframe
              key={`${inlineUrl}-retry-${retryCount}`}
              src={inlineUrl}
              className="h-full w-full border-0"
              title={title || 'PDF Document'}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              allowFullScreen
              loading={isMobile ? 'lazy' : 'eager'}
            />

            {/* Loading State */}
            {loading && !error && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="h-8 w-8 sm:h-10 sm:w-10 animate-spin rounded-full border-2 border-lime-500 border-t-transparent"></div>
                <p className="mt-3 text-xs sm:text-sm text-gray-600 text-center px-4">
                  {isMobile ? 'Loading PDF...' : 'Loading PDF document...'}
                </p>
                {isMobile && (
                  <p className="mt-1 text-xs text-gray-500 text-center px-4">
                    This may take a moment on mobile devices
                  </p>
                )}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm p-3 sm:p-4">
                <div className="w-full max-w-xs sm:max-w-sm space-y-3 sm:space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">{error}</p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 justify-center">
                    {/* Mobile retry option */}
                    {isMobile && retryCount < 3 && (
                      <button
                        onClick={handleRetry}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-green-600 active:scale-95 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
                      >
                        <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>Retry ({3 - retryCount} left)</span>
                      </button>
                    )}

                    {/* Always show new tab option */}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600 active:scale-95 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
                    >
                      <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Open in New Tab</span>
                      <span className="sm:hidden">Open New Tab</span>
                    </a>
                  </div>

                  {isMobile && (
                    <div className="mt-3 flex justify-center">
                      <PDFThumbnail url={url} width={280} height={380} />
                    </div>
                  )}

                  {isMobile && (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-2">
                      <p className="text-xs text-blue-700">Tip: For best mobile experience, open in a new tab.</p>
                    </div>
                  )}


                </div>
              </div>
            )}

            {/* Auth Overlay */}
            {!treatAsAuthenticated && !error && !loading && (
              <div className="pointer-events-auto absolute top-0 left-0 right-0 flex h-10 sm:h-12 items-center justify-center gap-1.5 bg-gradient-to-b from-white/95 via-white/90 to-transparent px-2 sm:px-3">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-600 hidden sm:inline">Sign in to unlock PDF toolbar and downloads</span>
                <span className="text-xs font-medium text-amber-600 sm:hidden">Sign in to unlock features</span>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}

export default PDFViewer
