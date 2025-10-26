'use client'

import { useState, useCallback } from 'react'
import { Download } from 'lucide-react'
import { resolveUploadDescriptorByUrl } from '@/constants/uploadFileTypes'

interface PWADownloadButtonProps {
  url: string
  filename?: string
  title?: string
  className?: string
  children?: React.ReactNode
}

export function PWADownloadButton({ 
  url, 
  filename, 
  title, 
  className = '',
  children 
}: PWADownloadButtonProps) {
  const [downloading, setDownloading] = useState(false)

  const computeFinalFilename = useCallback(() => {
    const descriptorFromUrl = resolveUploadDescriptorByUrl(url)
    const fallbackExtension = descriptorFromUrl?.extension || 'pdf'
    const providedFilename = filename?.trim()

    if (providedFilename) {
      if (providedFilename.includes('.')) {
        return providedFilename
      }
      const sanitizedProvided = providedFilename.replace(/[^\w.-]/g, '_')
      return `${sanitizedProvided || 'document'}.${fallbackExtension}`
    }

    const sanitizedTitle = title ? title.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/^_+|_+$/g, '') : ''
    const baseName = sanitizedTitle || 'document'

    return `${baseName}.${fallbackExtension}`
  }, [filename, title, url])

  const handleDownload = useCallback(async () => {
    if (!url || downloading) return

    setDownloading(true)

    try {
      const finalFilename = computeFinalFilename()
      
      // Always use our download API for consistent behavior across all environments
      const downloadApiUrl = `/api/download?${new URLSearchParams({
        url: url,
        filename: finalFilename
      })}`
      
      // Create a hidden link and click it to trigger download
      const link = document.createElement('a')
      link.href = downloadApiUrl
      link.download = finalFilename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (error) {
      console.error('Download failed:', error)
      
      // Fallback: open in new tab
      const finalFilename = computeFinalFilename()
      const downloadApiUrl = `/api/download?${new URLSearchParams({
        url: url,
        filename: finalFilename
      })}`
      
      window.open(downloadApiUrl, '_blank', 'noopener,noreferrer')
      
    } finally {
      setDownloading(false)
    }
  }, [url, downloading, computeFinalFilename])



  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-95 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed sm:px-4 sm:py-2 sm:text-sm ${className}`}
    >
      <Download className={`h-3 w-3 sm:h-4 sm:w-4 ${downloading ? 'animate-spin' : ''}`} />
      <span>
        {downloading ? 'Downloading...' : (children || 'Download')}
      </span>
    </button>
  )
}

export default PWADownloadButton
