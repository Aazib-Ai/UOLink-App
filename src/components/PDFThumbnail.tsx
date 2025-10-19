'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadPdfJs } from '@/lib/pdfjs'

interface PDFThumbnailProps {
  url: string
  width: number
  height: number
  className?: string
  onClick?: () => void
}

type ThumbnailState = 'idle' | 'loading' | 'loaded' | 'error'

const PDFThumbnail: React.FC<PDFThumbnailProps> = ({
  url,
  width,
  height,
  className = '',
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<ThumbnailState>('idle')

  const devicePixelRatio = useMemo(
    () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
    []
  )

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      setState('loading')

      try {
        const pdfjsLib = await loadPdfJs()
        if (cancelled) {
          return
        }

        const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false })

        try {
          const pdf = await loadingTask.promise
          if (cancelled) {
            loadingTask.destroy()
            return
          }

          const page = await pdf.getPage(1)
          if (cancelled) {
            loadingTask.destroy()
            return
          }

          const initialViewport = page.getViewport({ scale: 1 })
          const scale = Math.min(width / initialViewport.width, height / initialViewport.height) || 1
          const viewport = page.getViewport({ scale })

          const canvas = canvasRef.current
          const context = canvas?.getContext('2d')

          if (!canvas || !context) {
            throw new Error('Canvas context unavailable')
          }

          const outputScale = devicePixelRatio

          canvas.width = viewport.width * outputScale
          canvas.height = viewport.height * outputScale
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`

          context.setTransform(1, 0, 0, 1, 0, 0)
          context.scale(outputScale, outputScale)
          context.clearRect(0, 0, viewport.width, viewport.height)

          await page.render({
            canvasContext: context,
            viewport,
          }).promise

          if (!cancelled) {
            setState('loaded')
          }

          loadingTask.destroy()
        } catch (err) {
          loadingTask.destroy()
          throw err
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[PDFThumbnail] Failed to render PDF thumbnail', error)
          setState('error')
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [url, width, height, devicePixelRatio])

  return (
    <div
      className={`relative cursor-pointer transition-all duration-300 ${
        state === 'loaded' ? 'hover:opacity-95' : ''
      } ${className}`}
      onClick={onClick}
      style={{ width, height }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="absolute inset-0 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className={`transition-opacity duration-300 ${
              state === 'loaded' ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {state !== 'loaded' && (
            <div className="flex flex-col items-center justify-center text-center px-3">
              {state === 'error' ? (
                <>
                  <div className="text-xs font-semibold text-red-500 mb-1">Preview unavailable</div>
                  <div className="text-[11px] text-gray-500">Click to open the full PDF</div>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full border-2 border-dashed border-gray-300 animate-spin mb-2" />
                  <div className="text-xs text-gray-500">Generating preview…</div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent px-2 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white">PDF Preview</span>
        </div>
      </div>
    </div>
  )
}

export default PDFThumbnail
