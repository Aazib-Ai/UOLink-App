'use client'

import type { Area } from 'react-easy-crop'
import { loadOpenCV } from './opencvUtils'

export type ScannerFilter = 'original' | 'grayscale' | 'bw' | 'enhanced-contrast' | 'auto-brightness' | 'document-grayscale' | 'text-sharpen'

export type { EnhancedFilterOptions }

// Export utility functions for advanced usage
export {
  processBatchFilters,
  isMobileDevice,
  shouldUseProgressiveProcessing,
  getMobileOptimizedParams
}

interface ProcessOptions {
  cropAreaPixels?: Area | null
  filter: ScannerFilter
}

interface EnhancedFilterOptions {
  contrastFactor?: number
  brightnessFactor?: number
  gammaCorrection?: number
  preserveColors?: boolean
  textOptimization?: boolean
  sharpenStrength?: number
  unsharpRadius?: number
  unsharpAmount?: number
  unsharpThreshold?: number
}

/**
 * Enhanced contrast filter using OpenCV histogram equalization
 */
const applyEnhancedContrast = async (imageData: ImageData, options: EnhancedFilterOptions = {}): Promise<ImageData> => {
  await loadOpenCV()
  const cv = window.cv

  if (!cv) {
    throw new Error('OpenCV not available')
  }

  let src: any = null
  let enhanced: any = null
  let result: ImageData

  try {
    // Create OpenCV Mat from ImageData
    src = cv.matFromImageData(imageData)
    enhanced = new cv.Mat()

    const contrastFactor = options.contrastFactor ?? 1.3
    const brightnessFactor = options.brightnessFactor ?? 10

    if (options.preserveColors && src.channels() === 4) {
      // Convert RGBA to RGB for processing
      const rgb = new cv.Mat()
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)

      // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
      const lab = new cv.Mat()
      cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab)

      const labChannels = new cv.MatVector()
      cv.split(lab, labChannels)

      const clahe = new cv.CLAHE()
      clahe.setClipLimit(2.0)
      clahe.setTilesGridSize(new cv.Size(8, 8))

      const lChannel = labChannels.get(0)
      const enhancedL = new cv.Mat()
      clahe.apply(lChannel, enhancedL)

      labChannels.set(0, enhancedL)
      cv.merge(labChannels, lab)

      cv.cvtColor(lab, enhanced, cv.COLOR_Lab2RGB)

      // Convert back to RGBA
      const rgba = new cv.Mat()
      cv.cvtColor(enhanced, rgba, cv.COLOR_RGB2RGBA)
      enhanced.delete()
      enhanced = rgba

      // Cleanup
      rgb.delete()
      lab.delete()
      labChannels.delete()
      lChannel.delete()
      enhancedL.delete()
      clahe.delete()
    } else {
      // Simple contrast and brightness adjustment
      src.convertTo(enhanced, -1, contrastFactor, brightnessFactor)
    }

    // Convert back to ImageData
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!

    cv.imshow(canvas, enhanced)
    result = ctx.getImageData(0, 0, canvas.width, canvas.height)

  } finally {
    if (src) src.delete()
    if (enhanced) enhanced.delete()
  }

  return result
}

/**
 * Auto brightness adjustment with exposure correction
 */
const applyAutoBrightness = async (imageData: ImageData, options: EnhancedFilterOptions = {}): Promise<ImageData> => {
  await loadOpenCV()
  const cv = window.cv

  if (!cv) {
    throw new Error('OpenCV not available')
  }

  let src: any = null
  let gray: any = null
  let enhanced: any = null
  let result: ImageData

  try {
    src = cv.matFromImageData(imageData)
    gray = new cv.Mat()
    enhanced = new cv.Mat()

    // Convert to grayscale for analysis
    if (src.channels() === 4) {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    } else {
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY)
    }

    // Calculate histogram to determine brightness
    const hist = new cv.Mat()
    const histSize = [256]
    const ranges = [0, 256]
    const mask = new cv.Mat()

    cv.calcHist(new cv.MatVector([gray]), [0], mask, hist, histSize, ranges)

    // Find mean brightness
    const mean = cv.mean(gray)
    const targetBrightness = 128 // Target middle gray
    const currentBrightness = mean[0]

    // Calculate adjustment factors
    const brightnessDelta = targetBrightness - currentBrightness
    const contrastFactor = options.contrastFactor ?? 1.2
    const brightnessFactor = options.brightnessFactor ?? brightnessDelta * 0.8

    // Apply gamma correction for better exposure
    const gamma = options.gammaCorrection ?? (currentBrightness < 100 ? 0.8 : 1.2)
    const lookupTable = new cv.Mat(1, 256, cv.CV_8U)
    const lookupData = lookupTable.data

    for (let i = 0; i < 256; i++) {
      lookupData[i] = Math.min(255, Math.max(0, Math.pow(i / 255.0, gamma) * 255))
    }

    cv.LUT(src, lookupTable, enhanced)

    // Apply additional brightness and contrast
    const final = new cv.Mat()
    enhanced.convertTo(final, -1, contrastFactor, brightnessFactor)

    // Convert back to ImageData
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!

    cv.imshow(canvas, final)
    result = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Cleanup
    hist.delete()
    mask.delete()
    lookupTable.delete()
    final.delete()

  } finally {
    if (src) src.delete()
    if (gray) gray.delete()
    if (enhanced) enhanced.delete()
  }

  return result
}

/**
 * Document-optimized grayscale conversion
 */
const applyDocumentGrayscale = async (imageData: ImageData, options: EnhancedFilterOptions = {}): Promise<ImageData> => {
  await loadOpenCV()
  const cv = window.cv

  if (!cv) {
    throw new Error('OpenCV not available')
  }

  let src: any = null
  let gray: any = null
  let enhanced: any = null
  let result: ImageData

  try {
    src = cv.matFromImageData(imageData)
    gray = new cv.Mat()
    enhanced = new cv.Mat()

    // Convert to grayscale using optimal weights for text documents
    if (src.channels() === 4) {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    } else {
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY)
    }

    if (options.textOptimization) {
      // Apply adaptive histogram equalization for better text contrast
      const clahe = new cv.CLAHE()
      clahe.setClipLimit(3.0)
      clahe.setTilesGridSize(new cv.Size(8, 8))
      clahe.apply(gray, enhanced)
      clahe.delete()

      // Apply slight sharpening for text clarity
      const kernel = cv.matFromArray(3, 3, cv.CV_32FC1, [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ])

      const sharpened = new cv.Mat()
      cv.filter2D(enhanced, sharpened, cv.CV_8U, kernel)
      enhanced.delete()
      enhanced = sharpened
      kernel.delete()
    } else {
      enhanced = gray.clone()
    }

    // Convert back to RGBA for consistency
    const rgba = new cv.Mat()
    cv.cvtColor(enhanced, rgba, cv.COLOR_GRAY2RGBA)

    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!

    cv.imshow(canvas, rgba)
    result = ctx.getImageData(0, 0, canvas.width, canvas.height)

    rgba.delete()

  } finally {
    if (src) src.delete()
    if (gray) gray.delete()
    if (enhanced) enhanced.delete()
  }

  return result
}

/**
 * Text sharpening filter using unsharp mask for optimal text clarity
 */
const applyTextSharpening = async (imageData: ImageData, options: EnhancedFilterOptions = {}): Promise<ImageData> => {
  await loadOpenCV()
  const cv = window.cv

  if (!cv) {
    throw new Error('OpenCV not available')
  }

  let src: any = null
  let blurred: any = null
  let mask: any = null
  let sharpened: any = null
  let result: ImageData

  try {
    src = cv.matFromImageData(imageData)
    blurred = new cv.Mat()
    mask = new cv.Mat()
    sharpened = new cv.Mat()

    // Parameters optimized for mobile performance and text clarity
    const radius = options.unsharpRadius ?? 1.5
    const amount = options.unsharpAmount ?? 1.5
    const threshold = options.unsharpThreshold ?? 0
    const sharpenStrength = options.sharpenStrength ?? 0.8

    // Create Gaussian blur for unsharp mask
    const kernelSize = Math.max(3, Math.round(radius * 2) * 2 + 1) // Ensure odd kernel size
    cv.GaussianBlur(src, blurred, new cv.Size(kernelSize, kernelSize), radius)

    // Create unsharp mask: original - blurred
    cv.subtract(src, blurred, mask)

    // Apply threshold to mask (optional, helps reduce noise)
    if (threshold > 0) {
      const thresholdMask = new cv.Mat()
      cv.threshold(mask, thresholdMask, threshold, 255, cv.THRESH_BINARY)
      cv.bitwise_and(mask, thresholdMask, mask)
      thresholdMask.delete()
    }

    // Scale the mask by amount and add back to original
    const scaledMask = new cv.Mat()
    mask.convertTo(scaledMask, -1, amount * sharpenStrength, 0)
    cv.add(src, scaledMask, sharpened)

    // Additional text-specific enhancements for mobile
    if (options.textOptimization) {
      // Apply adaptive histogram equalization for better text contrast
      let gray: any = null
      let enhanced: any = null
      let final: any = null

      try {
        gray = new cv.Mat()
        enhanced = new cv.Mat()
        final = new cv.Mat()

        // Convert to grayscale for CLAHE
        if (sharpened.channels() === 4) {
          cv.cvtColor(sharpened, gray, cv.COLOR_RGBA2GRAY)
        } else {
          cv.cvtColor(sharpened, gray, cv.COLOR_RGB2GRAY)
        }

        // Apply CLAHE with conservative settings for text
        const clahe = new cv.CLAHE()
        clahe.setClipLimit(2.0)
        clahe.setTilesGridSize(new cv.Size(8, 8))
        clahe.apply(gray, enhanced)

        // Convert back to original color space
        if (sharpened.channels() === 4) {
          cv.cvtColor(enhanced, final, cv.COLOR_GRAY2RGBA)
        } else {
          cv.cvtColor(enhanced, final, cv.COLOR_GRAY2RGB)
        }

        sharpened.delete()
        sharpened = final
        final = null // Prevent double deletion

        clahe.delete()
      } finally {
        if (gray) gray.delete()
        if (enhanced) enhanced.delete()
        if (final) final.delete()
      }
    }

    // Convert back to ImageData
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!

    cv.imshow(canvas, sharpened)
    result = ctx.getImageData(0, 0, canvas.width, canvas.height)

    scaledMask.delete()

  } finally {
    if (src) src.delete()
    if (blurred) blurred.delete()
    if (mask) mask.delete()
    if (sharpened) sharpened.delete()
  }

  return result
}

/**
 * Mobile-optimized processing pipeline for performance
 */
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * Progressive processing for large images to prevent memory issues
 */
const shouldUseProgressiveProcessing = (imageData: ImageData): boolean => {
  const isMobile = isMobileDevice()
  const pixelCount = imageData.width * imageData.height

  // Use progressive processing for images larger than 2MP on mobile, 4MP on desktop
  const threshold = isMobile ? 2000000 : 4000000
  return pixelCount > threshold
}

/**
 * Resize image for processing if too large, maintaining aspect ratio
 */
const resizeForProcessing = (imageData: ImageData, maxDimension: number = 1920): ImageData => {
  const { width, height } = imageData

  if (width <= maxDimension && height <= maxDimension) {
    return imageData
  }

  const aspectRatio = width / height
  let newWidth: number
  let newHeight: number

  if (width > height) {
    newWidth = maxDimension
    newHeight = maxDimension / aspectRatio
  } else {
    newHeight = maxDimension
    newWidth = maxDimension * aspectRatio
  }

  // Create canvas for resizing
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  canvas.width = newWidth
  canvas.height = newHeight

  // Create temporary canvas with original image
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')!
  tempCanvas.width = width
  tempCanvas.height = height
  tempCtx.putImageData(imageData, 0, 0)

  // Draw resized image
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, newWidth, newHeight)

  return ctx.getImageData(0, 0, newWidth, newHeight)
}

/**
 * Memory-efficient processing with cleanup
 */
const processWithMemoryManagement = async <T>(
  operation: () => Promise<T>,
  cleanup?: () => void
): Promise<T> => {
  try {
    const result = await operation()
    return result
  } finally {
    if (cleanup) {
      cleanup()
    }

    // Force garbage collection if available (development/testing)
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc()
    }
  }
}

/**
 * Batch processing for multiple filter operations
 */
interface BatchProcessingOptions {
  filters: ScannerFilter[]
  imageData: ImageData
  progressCallback?: (progress: number, currentFilter: ScannerFilter) => void
}

const processBatchFilters = async (options: BatchProcessingOptions): Promise<ImageData[]> => {
  const { filters, imageData, progressCallback } = options
  const results: ImageData[] = []

  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i]

    if (progressCallback) {
      progressCallback((i / filters.length) * 100, filter)
    }

    try {
      let processedData: ImageData
      const params = getMobileOptimizedParams(filter)

      switch (filter) {
        case 'enhanced-contrast':
          processedData = await applyEnhancedContrast(imageData, params)
          break
        case 'auto-brightness':
          processedData = await applyAutoBrightness(imageData, params)
          break
        case 'text-sharpen':
          processedData = await applyTextSharpening(imageData, params)
          break
        case 'document-grayscale':
          processedData = await applyDocumentGrayscale(imageData, { textOptimization: true })
          break
        default:
          processedData = imageData
      }

      results.push(processedData)
    } catch (error) {
      console.warn(`Filter ${filter} failed, using original:`, error)
      results.push(imageData)
    }
  }

  if (progressCallback) {
    progressCallback(100, filters[filters.length - 1])
  }

  return results
}

/**
 * Get optimized filter parameters for mobile devices
 */
const getMobileOptimizedParams = (filter: ScannerFilter): EnhancedFilterOptions => {
  const isMobile = isMobileDevice()

  const baseParams: EnhancedFilterOptions = {
    contrastFactor: isMobile ? 1.2 : 1.3,
    brightnessFactor: isMobile ? 8 : 10,
    gammaCorrection: isMobile ? 1.05 : 1.1,
    preserveColors: true,
    textOptimization: true
  }

  switch (filter) {
    case 'text-sharpen':
      return {
        ...baseParams,
        sharpenStrength: isMobile ? 0.6 : 0.8,
        unsharpRadius: isMobile ? 1.0 : 1.5,
        unsharpAmount: isMobile ? 1.2 : 1.5,
        unsharpThreshold: 0,
        textOptimization: true
      }
    case 'enhanced-contrast':
      return {
        ...baseParams,
        contrastFactor: isMobile ? 1.25 : 1.3,
        brightnessFactor: isMobile ? 8 : 10
      }
    case 'auto-brightness':
      return {
        ...baseParams,
        contrastFactor: isMobile ? 1.15 : 1.2,
        gammaCorrection: isMobile ? 1.05 : 1.1
      }
    default:
      return baseParams
  }
}

/**
 * Applies cropping and enhanced filters to a data URL.
 * Returns a new JPEG data URL that reflects the requested edits.
 */
export const processImage = async (dataUrl: string, options: ProcessOptions): Promise<string> => {
  const { cropAreaPixels, filter } = options

  return new Promise(async (resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = async () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Unable to obtain canvas context'))
        return
      }

      const { width, height, x, y } =
        cropAreaPixels ?? ({ width: image.width, height: image.height, x: 0, y: 0 } as Area)

      canvas.width = width
      canvas.height = height

      context.drawImage(image, x, y, width, height, 0, 0, width, height)

      if (filter !== 'original') {
        let imageData = context.getImageData(0, 0, width, height)
        let processedImageData: ImageData

        // Apply progressive processing for large images on mobile
        const useProgressive = shouldUseProgressiveProcessing(imageData)
        const isMobile = isMobileDevice()

        if (useProgressive && isMobile) {
          // Resize for processing to improve performance
          const maxDimension = isMobile ? 1280 : 1920
          imageData = resizeForProcessing(imageData, maxDimension)
        }

        try {
          processedImageData = await processWithMemoryManagement(async () => {
            switch (filter) {
              case 'enhanced-contrast':
                return await applyEnhancedContrast(imageData, getMobileOptimizedParams(filter))

              case 'auto-brightness':
                return await applyAutoBrightness(imageData, getMobileOptimizedParams(filter))

              case 'text-sharpen':
                return await applyTextSharpening(imageData, getMobileOptimizedParams(filter))

              case 'document-grayscale':
                return await applyDocumentGrayscale(imageData, {
                  textOptimization: true
                })

              case 'grayscale':
                // Fallback to basic grayscale for compatibility
                return await applyDocumentGrayscale(imageData, {
                  textOptimization: false
                })

              case 'bw':
                // Enhanced black and white with better threshold detection
                const pixels = imageData.data
                for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
                  const red = pixels[pixelIndex]
                  const green = pixels[pixelIndex + 1]
                  const blue = pixels[pixelIndex + 2]
                  const luminance = red * 0.299 + green * 0.587 + blue * 0.114
                  const threshold = 140
                  const value = luminance >= threshold ? 255 : 0
                  pixels[pixelIndex] = value
                  pixels[pixelIndex + 1] = value
                  pixels[pixelIndex + 2] = value
                }
                return imageData

              default:
                return imageData
            }
          })

          context.putImageData(processedImageData, 0, 0)
        } catch (error) {
          console.warn('Enhanced filter processing failed, falling back to basic processing:', error)

          // Fallback to basic processing
          const pixels = imageData.data
          for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
            const red = pixels[pixelIndex]
            const green = pixels[pixelIndex + 1]
            const blue = pixels[pixelIndex + 2]
            const luminance = red * 0.299 + green * 0.587 + blue * 0.114

            if (filter === 'grayscale' || filter === 'document-grayscale') {
              pixels[pixelIndex] = luminance
              pixels[pixelIndex + 1] = luminance
              pixels[pixelIndex + 2] = luminance
            } else if (filter === 'bw') {
              const threshold = 140
              const value = luminance >= threshold ? 255 : 0
              pixels[pixelIndex] = value
              pixels[pixelIndex + 1] = value
              pixels[pixelIndex + 2] = value
            }
          }
          context.putImageData(imageData, 0, 0)
        }
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }

    image.onerror = () => reject(new Error('Unable to load captured image'))
    image.src = dataUrl
  })
}
