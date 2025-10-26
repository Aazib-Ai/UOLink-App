import React from 'react'
import { OptimizedImage } from '../../optimized/OptimizedImage'
import PDFThumbnail from '../../PDFThumbnail'
import { resolvePreviewImage, isPDFUrl } from '../constants'
import { resolveUploadDescriptorByUrl } from '@/constants/uploadFileTypes'
import { FileText } from 'lucide-react'
import { optimizeImageUrl, generateResponsiveSizes } from '@/lib/image/optimization'
import { Note, Variant } from './types'

interface OptimizedPreviewPaneProps {
  note: Note
  handleViewNote: (note: Note) => void
  variant: Variant
  priority?: boolean
}

export const OptimizedPreviewPane: React.FC<OptimizedPreviewPaneProps> = ({
  note,
  handleViewNote,
  variant,
  priority = false
}) => {
  // Determine dimensions based on variant
  const getDimensions = () => {
    switch (variant) {
      case 'mobile':
        return { width: 320, height: 180 }
      case 'tablet':
        return { width: 240, height: 180 }
      case 'desktop':
        return { width: 200, height: 240 }
      default:
        return { width: 320, height: 180 }
    }
  }

  const { width, height } = getDimensions()

  // Generate responsive sizes for the image
  const responsiveSizes = generateResponsiveSizes(width)

  const renderDocumentPlaceholder = (singularLabel: string, lowercaseLabel: string) => (
    <div
      onClick={() => handleViewNote(note)}
      className={`${getImageClassName()} flex flex-col items-center justify-center bg-[#f7fbe9] text-center text-[#5f7050] hover:border-[#90c639]`}
      style={{ width, height }}
    >
      <FileText className="mb-1 h-6 w-6 text-[#7a8f5d]" />
      <span className="text-xs font-semibold uppercase tracking-wide">{singularLabel}</span>
      <span className="text-[11px] text-[#7a8f5d]">Tap to open the {lowercaseLabel}</span>
    </div>
  )
  const renderPreviewContent = () => {
    const fileUrl = note.fileUrl || ''
    if (isPDFUrl(fileUrl)) {
      return (
        <PDFThumbnail
          url={fileUrl}
          width={width}
          height={height}
          className={getImageClassName()}
          onClick={() => handleViewNote(note)}
        />
      )
    }

    const descriptor = resolveUploadDescriptorByUrl(fileUrl)
    const isDocumentFile = descriptor && descriptor.extension !== 'pdf'
    const singularLabel = descriptor?.label
      ? descriptor.label.toLowerCase().endsWith('s')
        ? descriptor.label.slice(0, -1)
        : descriptor.label
      : 'Document'
    const lowercaseLabel = singularLabel.toLowerCase()

    if (isDocumentFile) {
      return renderDocumentPlaceholder(singularLabel, lowercaseLabel)
    }

    const previewImageUrl = resolvePreviewImage(note)
    if (!previewImageUrl || previewImageUrl === "/placeholder.svg") {
      return renderPlaceholder()
    }

    // Optimize the image URL for mobile delivery
    const safeImageUrl = previewImageUrl || ''
    const optimizedUrl = optimizeImageUrl(safeImageUrl, {
      width,
      height,
      quality: 75
    })

    return (
      <OptimizedImage
        src={optimizedUrl}
        alt={`Preview of ${note.subject} - ${note.name}`}
        width={width}
        height={height}
        priority={priority}
        sizes={responsiveSizes}
        quality={75}
        className={getImageClassName()}
        onClick={() => handleViewNote(note)}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      />
    )
  }

  const renderPlaceholder = () => (
    <div 
      className={`${getImageClassName()} bg-gray-100 flex items-center justify-center`}
      onClick={() => handleViewNote(note)}
      style={{ width, height }}
    >
      <div className="text-gray-400 text-center">
        <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
        <span className="text-xs">No preview</span>
      </div>
    </div>
  )

  const getImageClassName = () => {
    const baseClasses = 'rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity object-cover'
    
    switch (variant) {
      case 'mobile':
        return `w-full ${baseClasses}`
      case 'tablet':
        return `${baseClasses}`
      case 'desktop':
        return `border-2 ${baseClasses}`
      default:
        return baseClasses
    }
  }

  const getContainerClassName = () => {
    switch (variant) {
      case 'mobile':
        return 'px-4 py-3 bg-gray-50 border-b border-gray-100'
      case 'tablet':
        return 'flex-shrink-0'
      case 'desktop':
        return 'flex flex-col items-center justify-between ml-6'
      default:
        return ''
    }
  }

  return (
    <div className={getContainerClassName()}>
      {renderPreviewContent()}
    </div>
  )
}
