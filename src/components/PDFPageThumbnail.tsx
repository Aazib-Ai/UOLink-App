'use client'

import { useEffect, useRef, useState } from 'react'

interface PDFPageThumbnailProps {
    pdfDoc: any
    pageNumber: number
    width?: number
    height?: number
    isSelected?: boolean
    onClick?: () => void
}

const PDFPageThumbnail: React.FC<PDFPageThumbnailProps> = ({
    pdfDoc,
    pageNumber,
    width = 80,
    height = 110,
    isSelected = false,
    onClick,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

    // Intersection Observer to lazy load
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '100px' }
        )

        if (containerRef.current) {
            observer.observe(containerRef.current)
        }

        return () => observer.disconnect()
    }, [])

    // Render page when visible
    useEffect(() => {
        if (!isVisible || !pdfDoc || status === 'success' || status === 'loading') return

        let cancelled = false

        const renderPage = async () => {
            setStatus('loading')
            try {
                const page = await pdfDoc.getPage(pageNumber)
                if (cancelled) return

                const canvas = canvasRef.current
                if (!canvas) return

                const viewport = page.getViewport({ scale: 1 })
                // Calculate scale to fit width/height
                const scale = Math.min(width / viewport.width, height / viewport.height)
                const scaledViewport = page.getViewport({ scale })

                const context = canvas.getContext('2d')
                if (!context) return

                canvas.width = scaledViewport.width
                canvas.height = scaledViewport.height

                await page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                }).promise

                if (!cancelled) {
                    setStatus('success')
                }
            } catch (error) {
                if (!cancelled) {
                    console.error(`Error rendering page ${pageNumber}:`, error)
                    setStatus('error')
                }
            }
        }

        renderPage()

        return () => {
            cancelled = true
        }
    }, [isVisible, pdfDoc, pageNumber, width, height, status])

    return (
        <div
            ref={containerRef}
            onClick={onClick}
            className={`relative flex-shrink-0 cursor-pointer rounded border transition-all ${isSelected ? 'border-lime-500 ring-2 ring-lime-500 ring-offset-1' : 'border-gray-200 hover:border-lime-300'
                }`}
            style={{ width, height }}
        >
            {status !== 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-xs text-gray-400">
                    {status === 'loading' ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime-500 border-t-transparent" />
                    ) : status === 'error' ? (
                        'Err'
                    ) : (
                        pageNumber
                    )}
                </div>
            )}
            <canvas
                ref={canvasRef}
                className={`h-full w-full rounded object-contain ${status === 'success' ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    )
}

export default PDFPageThumbnail
