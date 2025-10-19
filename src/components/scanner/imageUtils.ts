'use client'

import type { Area } from 'react-easy-crop'

export type ScannerFilter = 'original' | 'grayscale' | 'bw'

interface ProcessOptions {
  cropAreaPixels?: Area | null
  filter: ScannerFilter
}

/**
 * Applies cropping and basic filters to a data URL.
 * Returns a new JPEG data URL that reflects the requested edits.
 */
export const processImage = (dataUrl: string, options: ProcessOptions): Promise<string> => {
  const { cropAreaPixels, filter } = options

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
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
        const imageData = context.getImageData(0, 0, width, height)
        const pixels = imageData.data

        for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
          const red = pixels[pixelIndex]
          const green = pixels[pixelIndex + 1]
          const blue = pixels[pixelIndex + 2]

          const luminance = red * 0.299 + green * 0.587 + blue * 0.114

          if (filter === 'grayscale') {
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

      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }

    image.onerror = () => reject(new Error('Unable to load captured image'))
    image.src = dataUrl
  })
}
