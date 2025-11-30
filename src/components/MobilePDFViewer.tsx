'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react'
import { loadPdfJs } from '@/lib/pdfjs'

import PDFPageThumbnail from './PDFPageThumbnail'

interface MobilePDFViewerProps {
    url: string
    title?: string
}

type ViewerState = 'loading' | 'loaded' | 'error'

const MobilePDFViewer: React.FC<MobilePDFViewerProps> = ({ url, title }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const thumbnailContainerRef = useRef<HTMLDivElement>(null)
    const [state, setState] = useState<ViewerState>('loading')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [scale, setScale] = useState(1.0)
    const [pdfDoc, setPdfDoc] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    // Load PDF document
    useEffect(() => {
        let cancelled = false
        let loadingTask: any = null

        const loadDocument = async () => {
            setState('loading')
            setError(null)

            try {
                const pdfjsLib = await loadPdfJs()
                if (cancelled) return

                loadingTask = pdfjsLib.getDocument({ url, withCredentials: false })
                const pdf = await loadingTask.promise

                if (cancelled) {
                    loadingTask.destroy()
                    return
                }

                setPdfDoc(pdf)
                setTotalPages(pdf.numPages)
                setState('loaded')
            } catch (err) {
                if (!cancelled) {
                    console.error('[MobilePDFViewer] Failed to load PDF', err)
                    setError('Failed to load PDF document')
                    setState('error')
                }
            }
        }

        loadDocument()

        return () => {
            cancelled = true
            if (loadingTask) {
                loadingTask.destroy()
            }
        }
    }, [url])

    // Render current page
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return

        try {
            const page = await pdfDoc.getPage(currentPage)
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')

            if (!context) return

            // Calculate scale based on container width
            const containerWidth = containerRef.current?.clientWidth || window.innerWidth
            const viewport = page.getViewport({ scale: 1 })
            const calculatedScale = (containerWidth * 0.95) / viewport.width
            const finalScale = calculatedScale * scale

            const scaledViewport = page.getViewport({ scale: finalScale })

            // Set canvas dimensions
            const outputScale = window.devicePixelRatio || 1
            canvas.width = scaledViewport.width * outputScale
            canvas.height = scaledViewport.height * outputScale
            canvas.style.width = `${scaledViewport.width}px`
            canvas.style.height = `${scaledViewport.height}px`

            // Render PDF page
            context.setTransform(1, 0, 0, 1, 0, 0)
            context.scale(outputScale, outputScale)

            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
            }).promise

        } catch (err) {
            console.error('[MobilePDFViewer] Failed to render page', err)
        }
    }, [pdfDoc, currentPage, scale])

    // Render page when dependencies change
    useEffect(() => {
        if (state === 'loaded') {
            renderPage()
        }
    }, [state, renderPage])

    // Scroll thumbnail into view when page changes
    useEffect(() => {
        if (state === 'loaded' && thumbnailContainerRef.current) {
            const selectedThumbnail = thumbnailContainerRef.current.children[currentPage - 1] as HTMLElement
            if (selectedThumbnail) {
                selectedThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
            }
        }
    }, [currentPage, state])

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1)
        }
    }

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1)
        }
    }

    const zoomIn = () => {
        setScale(prev => Math.min(prev + 0.2, 3.0))
    }

    const zoomOut = () => {
        setScale(prev => Math.max(prev - 0.2, 0.5))
    }

    if (state === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
                <div className="text-center">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-2">{error || 'Failed to load PDF'}</p>
                    <p className="text-xs text-gray-600 mb-4">Try opening in a new tab for better viewing</p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7ab332]"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Open in New Tab
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col bg-gray-50 h-full">
            {/* Custom Header - Mobile Optimized */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-lime-50 to-green-50 border-b border-lime-100 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#1f2f10] truncate">{title || 'PDF Document'}</h3>
                        <p className="text-xs text-[#5f7050]">
                            Page {currentPage} of {totalPages}
                        </p>
                    </div>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-lime-600 active:scale-95"
                    >
                        <ExternalLink className="h-3 w-3" />
                        <span className="hidden xs:inline">Open</span>
                    </a>
                </div>
            </div>

            {/* PDF Canvas Container */}
            <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 p-2" style={{ minHeight: '60vh' }}>
                {state === 'loading' ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px]">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime-500 border-t-transparent"></div>
                        <p className="mt-3 text-sm text-gray-600">Loading PDF...</p>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <canvas
                            ref={canvasRef}
                            className="shadow-lg rounded-lg bg-white"
                        />
                    </div>
                )}
            </div>

            {/* Thumbnail Strip */}
            {state === 'loaded' && (
                <div className="bg-white border-t border-gray-200 py-2">
                    <div
                        ref={thumbnailContainerRef}
                        className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide"
                    >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                            <PDFPageThumbnail
                                key={pageNum}
                                pdfDoc={pdfDoc}
                                pageNumber={pageNum}
                                isSelected={currentPage === pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Custom Navigation Controls - Bottom Fixed */}
            {state === 'loaded' && (
                <div className="bg-white border-t border-lime-100 p-3">
                    <div className="flex items-center justify-between gap-3 max-w-md mx-auto">

                        {/* Previous Page */}
                        <button
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${currentPage === 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-lime-100 text-[#1f2f10] hover:bg-lime-200 active:scale-95'
                                }`}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden xs:inline">Prev</span>
                        </button>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={zoomOut}
                                disabled={scale <= 0.5}
                                className={`rounded-lg p-2 transition ${scale <= 0.5
                                    ? 'bg-gray-100 text-gray-400'
                                    : 'bg-gray-100 text-[#1f2f10] hover:bg-gray-200 active:scale-95'
                                    }`}
                            >
                                <ZoomOut className="h-4 w-4" />
                            </button>
                            <span className="text-xs font-medium text-gray-600 min-w-[45px] text-center">
                                {Math.round(scale * 100)}%
                            </span>
                            <button
                                onClick={zoomIn}
                                disabled={scale >= 3.0}
                                className={`rounded-lg p-2 transition ${scale >= 3.0
                                    ? 'bg-gray-100 text-gray-400'
                                    : 'bg-gray-100 text-[#1f2f10] hover:bg-gray-200 active:scale-95'
                                    }`}
                            >
                                <ZoomIn className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Next Page */}
                        <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${currentPage === totalPages
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-lime-100 text-[#1f2f10] hover:bg-lime-200 active:scale-95'
                                }`}
                        >
                            <span className="hidden xs:inline">Next</span>
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MobilePDFViewer
