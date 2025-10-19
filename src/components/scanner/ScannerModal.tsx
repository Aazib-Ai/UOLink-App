'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { AnimatePresence, Reorder, motion } from 'framer-motion'
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  GripVertical,
  Loader2,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  X,
  Zap,
  ZapOff,
} from 'lucide-react'
import { processImage, type ScannerFilter } from './imageUtils'
import {
  processDocumentAdvanced,
  loadOpenCV,
  type ProcessingOptions,
  LiveDocumentDetector,
  type LiveDetectionResult
} from './opencvUtils'

type ScannerStep = 'capture' | 'review' | 'edit'

interface ScannerPage {
  id: string
  originalDataUrl: string
  processedDataUrl: string
  edits: {
    crop: { x: number; y: number }
    zoom: number
    cropAreaPixels?: Area | null
    filter: ScannerFilter
  }
  processingInfo?: {
    wasAutoProcessed: boolean
    confidence?: number
    processingTime?: number
    detectedCorners?: { x: number; y: number }[]
  }
}

interface ScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (file: File) => void
}

type CaptureRotation = -90 | 0

const DEFAULT_CROP = { x: 0, y: 0 }
const DEFAULT_ZOOM = 1

const FILTER_OPTIONS: Array<{ value: ScannerFilter; label: string; tone: string }> = [
  { value: 'original', label: 'Original', tone: 'text-gray-700' },
  { value: 'grayscale', label: 'Grayscale', tone: 'text-slate-700' },
  { value: 'bw', label: 'Black & White', tone: 'text-gray-900' },
]

const MAX_CAPTURED_PAGES = 30

const createPageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `scan-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

export function ScannerModal({ isOpen, onClose, onComplete }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cropAreaRef = useRef<Area | null>(null)
  const liveDetectorRef = useRef<LiveDocumentDetector | null>(null)

  const [step, setStep] = useState<ScannerStep>('capture')
  const [pages, setPages] = useState<ScannerPage[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [pendingCapture, setPendingCapture] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [isTorchAvailable, setIsTorchAvailable] = useState(false)
  const [isTorchEnabled, setIsTorchEnabled] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isProcessingDocument, setIsProcessingDocument] = useState(false)
  const [captureRotation, setCaptureRotation] = useState<CaptureRotation>(0)
  const [isPortraitViewport, setIsPortraitViewport] = useState(true)
  const captureContainerRef = useRef<HTMLDivElement | null>(null)
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  const [editCrop, setEditCrop] = useState(DEFAULT_CROP)
  const [editZoom, setEditZoom] = useState(DEFAULT_ZOOM)
  const [editFilter, setEditFilter] = useState<ScannerFilter>('original')

  // Advanced processing options
  const [useAdvancedProcessing, setUseAdvancedProcessing] = useState(true)
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    blurKernel: 5,
    cannyLower: 50,
    cannyUpper: 150,
    contourAreaThreshold: 0.1,
    epsilon: 0.02
  })

  // Live detection state
  const [liveDetectionEnabled, setLiveDetectionEnabled] = useState(true)
  const [currentLiveResult, setCurrentLiveResult] = useState<LiveDetectionResult | null>(null)
  const [isLiveDetectionReady, setIsLiveDetectionReady] = useState(false)

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? null,
    [pages, activePageId]
  )
  const isCaptureStep = step === 'capture'

  const getDisplayMetrics = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    const fallbackWidth = isMobile ? window.innerWidth : 720
    const fallbackHeight = isMobile ? window.innerHeight : 900

    const containerWidth = containerSize.width > 0 ? containerSize.width : fallbackWidth
    const containerHeight = containerSize.height > 0 ? containerSize.height : fallbackHeight

    const { width: videoWidth, height: videoHeight } = videoDimensions
    if (!videoWidth || !videoHeight) {
      return {
        containerWidth,
        containerHeight,
        videoWidth: 0,
        videoHeight: 0,
        coverScale: 1,
      }
    }

    const quarterTurn = Math.abs(captureRotation) === 90
    const baseWidth = quarterTurn ? videoHeight : videoWidth
    const baseHeight = quarterTurn ? videoWidth : videoHeight

    const coverScaleCandidate = Math.max(
      containerWidth / (baseWidth || 1),
      containerHeight / (baseHeight || 1)
    )
    const coverScale =
      Number.isFinite(coverScaleCandidate) && coverScaleCandidate > 0 ? coverScaleCandidate : 1

    return {
      containerWidth,
      containerHeight,
      videoWidth,
      videoHeight,
      coverScale,
    }
  }, [captureRotation, containerSize.height, containerSize.width, videoDimensions])
  const videoStyle = useMemo<CSSProperties>(() => {
    const {
      containerWidth,
      containerHeight,
      videoWidth,
      videoHeight,
      coverScale,
    } = getDisplayMetrics()

    const baseStyle: CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transformOrigin: 'center center',
      objectFit: 'cover',
      maxWidth: 'none',
      maxHeight: 'none',
    }

    const transforms: string[] = ['translate(-50%, -50%)']
    if (captureRotation !== 0) {
      transforms.push(`rotate(${captureRotation}deg)`)
    }

    if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
      return {
        ...baseStyle,
        width: '100%',
        height: '100%',
        transform: transforms.join(' '),
      }
    }

    transforms.push(`scale(${coverScale})`)

    return {
      ...baseStyle,
      width: videoWidth,
      height: videoHeight,
      transform: transforms.join(' '),
    }
  }, [captureRotation, getDisplayMetrics])
  const overlayStyle = useMemo<CSSProperties>(() => {
    const { objectFit, ...rest } = videoStyle
    return {
      ...rest,
      pointerEvents: 'none',
      backgroundColor: 'transparent',
      mixBlendMode: 'normal',
    }
  }, [videoStyle])
  const stopLiveDetection = useCallback(() => {
    if (liveDetectorRef.current) {
      liveDetectorRef.current.stop()
      liveDetectorRef.current = null
    }
    setIsLiveDetectionReady(false)
    setCurrentLiveResult(null)
  }, [])

  const stopCamera = useCallback(() => {
    stopLiveDetection()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // no-op
        }
      })
    }
    streamRef.current = null
    setIsTorchEnabled(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [stopLiveDetection])

  const resetState = useCallback(() => {
    setStep('capture')
    setPages([])
    setActivePageId(null)
    setPendingCapture(null)
    setIsGeneratingPdf(false)
    setIsSavingEdit(false)
    setCameraError(null)
    setIsTorchAvailable(false)
    setIsTorchEnabled(false)
    setEditCrop(DEFAULT_CROP)
    setEditZoom(DEFAULT_ZOOM)
    setEditFilter('original')
    cropAreaRef.current = null
    setCaptureRotation(0)
    setIsPortraitViewport(true)
    stopLiveDetection()
  }, [stopLiveDetection])

  const evaluateRotation = useCallback(() => {
    const viewportIsPortrait =
      typeof window === 'undefined' ? true : window.innerHeight >= window.innerWidth
    setIsPortraitViewport(viewportIsPortrait)

    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCaptureRotation(-90)
      return
    }

    const isVideoLandscape = video.videoWidth > video.videoHeight

    if (!viewportIsPortrait) {
      setCaptureRotation(0)
      return
    }

    setCaptureRotation(isVideoLandscape ? -90 : 0)
  }, [])

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this environment.')
      return
    }

    try {
      setIsCameraLoading(true)

      const viewportIsPortrait =
        typeof window === 'undefined' ? true : window.innerHeight >= window.innerWidth
      setIsPortraitViewport(viewportIsPortrait)

      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        try {
          await video.play()
        } catch {
          // Safari automatically starts the video on load.
        }

        const updateVideoMetrics = () => {
          setVideoDimensions({
            width: video.videoWidth || 0,
            height: video.videoHeight || 0,
          })
          evaluateRotation()
        }

        if (video.readyState >= 2) {
          updateVideoMetrics()
        } else {
          video.addEventListener(
            'loadedmetadata',
            () => {
              updateVideoMetrics()
            },
            { once: true }
          )
        }
      }

      const [videoTrack] = stream.getVideoTracks()
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const capabilities = videoTrack.getCapabilities()
        if (capabilities && 'torch' in capabilities) {
          setIsTorchAvailable(Boolean(capabilities.torch))
        }
      }

      setCameraError(null)
    } catch (error) {
      console.warn('[ScannerModal] Failed to start camera', error)
      setCameraError(
        `Unable to access the camera: ${error instanceof Error ? error.message : 'Unknown error'}. Please grant permission or try again on a supported device.`
      )
    } finally {
      setIsCameraLoading(false)
    }
  }, [evaluateRotation])

  const initializeLiveDetection = useCallback(() => {
    if (!liveDetectionEnabled) {
      return
    }

    const videoElement = videoRef.current
    const canvasElement = overlayCanvasRef.current

    if (!videoElement || !canvasElement) {
      return
    }

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return
    }

    if (liveDetectorRef.current) {
      return
    }

    setIsLiveDetectionReady(false)
    setCurrentLiveResult(null)

    const detector = new LiveDocumentDetector((result: LiveDetectionResult) => {
      setCurrentLiveResult(result)
      if (result.corners && result.confidence > 0.2) {
        setIsLiveDetectionReady(true)
      }
    }, 8)

    liveDetectorRef.current = detector

    detector.start(videoElement, canvasElement).catch((error) => {
      console.error('[ScannerModal] Failed to start live detection', error)
      stopLiveDetection()
    })
  }, [liveDetectionEnabled, stopLiveDetection])

  useEffect(() => {
    if (!isCaptureStep) {
      stopLiveDetection()
      return
    }

    if (!liveDetectionEnabled) {
      stopLiveDetection()
      return
    }

    const videoElement = videoRef.current
    const canvasElement = overlayCanvasRef.current

    if (!videoElement || !canvasElement) {
      return
    }

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setIsLiveDetectionReady(false)
      return
    }

    initializeLiveDetection()
  }, [
    initializeLiveDetection,
    isCaptureStep,
    liveDetectionEnabled,
    stopLiveDetection,
    videoDimensions.height,
    videoDimensions.width,
  ])

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      resetState()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera, resetState])

  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false

    loadOpenCV().catch((error) => {
      if (!isCancelled) {
        console.warn('[ScannerModal] Failed to preload OpenCV', error)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return
    const handleResize = () => {
      evaluateRotation()
    }
    const handleOrientationChange = () => {
      evaluateRotation()
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    const screenOrientation = window.screen?.orientation
    if (screenOrientation?.addEventListener) {
      screenOrientation.addEventListener('change', handleOrientationChange)
    }
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (screenOrientation?.removeEventListener) {
        screenOrientation.removeEventListener('change', handleOrientationChange)
      }
    }
  }, [isOpen, evaluateRotation])

  useEffect(() => {
    if (!isCaptureStep) {
      setContainerSize({ width: 0, height: 0 })
      return
    }

    const node = captureContainerRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      if (node) {
        const rect = node.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
      return
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }

    updateSize()

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setContainerSize({ width, height })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [isCaptureStep])

  useEffect(() => {
    if (activePage) {
      setEditCrop(activePage.edits.crop ?? DEFAULT_CROP)
      setEditZoom(activePage.edits.zoom ?? DEFAULT_ZOOM)
      setEditFilter(activePage.edits.filter ?? 'original')
      cropAreaRef.current = activePage.edits.cropAreaPixels ?? null
    } else {
      cropAreaRef.current = null
      setEditCrop(DEFAULT_CROP)
      setEditZoom(DEFAULT_ZOOM)
      setEditFilter('original')
    }
  }, [activePage])

  const handleClose = useCallback(() => {
    onClose()
    stopCamera()
    resetState()
  }, [onClose, stopCamera, resetState])

  const handleToggleTorch = useCallback(async () => {
    const stream = streamRef.current
    if (!stream) return

    const [track] = stream.getVideoTracks()
    if (!track || typeof track.applyConstraints !== 'function') {
      setIsTorchAvailable(false)
      return
    }

    const constraintSet: MediaTrackConstraintSet & { advanced?: Array<Record<string, unknown>> } = {}
    constraintSet.advanced = [{ torch: !isTorchEnabled }]

    try {
      await track.applyConstraints(constraintSet)
      setIsTorchEnabled((previous) => !previous)
    } catch (error) {
      console.warn('[ScannerModal] Torch toggle failed', error)
      setIsTorchAvailable(false)
    }
  }, [isTorchEnabled])

  const handleCapture = useCallback(() => {
    if (pendingCapture || !isPortraitViewport) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    const context = canvas.getContext('2d')
    if (!context) return

    const absoluteRotation = Math.abs(captureRotation) % 360
    const rotateQuarterTurn = absoluteRotation === 90 || absoluteRotation === 270
    const outputWidth = rotateQuarterTurn ? video.videoHeight : video.videoWidth
    const outputHeight = rotateQuarterTurn ? video.videoWidth : video.videoHeight

    canvas.width = outputWidth
    canvas.height = outputHeight

    context.save()
    context.translate(outputWidth / 2, outputHeight / 2)
    context.rotate((captureRotation * Math.PI) / 180)
    context.drawImage(
      video,
      -video.videoWidth / 2,
      -video.videoHeight / 2,
      video.videoWidth,
      video.videoHeight
    )
    context.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setPendingCapture(dataUrl)
  }, [captureRotation, isPortraitViewport, pendingCapture])

  const handleCaptureDiscard = useCallback(() => {
    setPendingCapture(null)
    setIsProcessingDocument(false)
  }, [])

  const handleCaptureKeep = useCallback(async () => {
    if (!pendingCapture || isProcessingDocument) return

    setIsProcessingDocument(true)

    try {
      let processedResult = pendingCapture
      let processingInfo: ScannerPage['processingInfo'] = {
        wasAutoProcessed: false
      }

      try {
        if (useAdvancedProcessing) {
          const result = await processDocumentAdvanced(pendingCapture, processingOptions)
          processedResult = result.processedDataUrl
          processingInfo = {
            wasAutoProcessed: result.detectedCorners !== null,
            confidence: result.confidence,
            processingTime: result.processingTime,
            detectedCorners: result.detectedCorners ?? undefined
          }
        } else {
          processedResult = pendingCapture
          processingInfo = {
            wasAutoProcessed: false
          }
        }
      } catch (error) {
        console.warn('[ScannerModal] Document detection failed, using original capture', error)
        processingInfo = {
          wasAutoProcessed: false
        }
      }

      setPages((previous) => {
        if (previous.length >= MAX_CAPTURED_PAGES) {
          return previous
        }

        const newPage: ScannerPage = {
          id: createPageId(),
          originalDataUrl: processedResult,
          processedDataUrl: processedResult,
          edits: {
            crop: DEFAULT_CROP,
            zoom: DEFAULT_ZOOM,
            cropAreaPixels: null,
            filter: 'original',
          },
          processingInfo
        }

        return [...previous, newPage]
      })

      setPendingCapture(null)
    } finally {
      setIsProcessingDocument(false)
    }
  }, [isProcessingDocument, pendingCapture, useAdvancedProcessing, processingOptions])

  const handleRemovePage = useCallback((pageId: string) => {
    setPages((previous) => previous.filter((page) => page.id !== pageId))
  }, [])

  const handleOpenEditor = useCallback((pageId: string) => {
    setActivePageId(pageId)
    setStep('edit')
  }, [])

  const handleEditCancel = useCallback(() => {
    setActivePageId(null)
    setStep('review')
  }, [])

  const handleEditReset = useCallback(() => {
    setEditCrop(DEFAULT_CROP)
    setEditZoom(DEFAULT_ZOOM)
    setEditFilter('original')
    cropAreaRef.current = null
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!activePage) return
    setIsSavingEdit(true)
    try {
      const processedDataUrl = await processImage(activePage.originalDataUrl, {
        cropAreaPixels: cropAreaRef.current ?? undefined,
        filter: editFilter,
      })

      setPages((previous) =>
        previous.map((page) =>
          page.id === activePage.id
            ? {
                ...page,
                processedDataUrl,
                edits: {
                  crop: editCrop,
                  zoom: editZoom,
                  cropAreaPixels: cropAreaRef.current ?? null,
                  filter: editFilter,
                },
              }
            : page
        )
      )

      setActivePageId(null)
      setStep('review')
    } catch (error) {
      console.error('[ScannerModal] Failed to save edits', error)
      setCameraError('Unable to apply edits. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }, [activePage, editCrop, editFilter, editZoom])

  const handleGeneratePdf = useCallback(async () => {
    if (!pages.length) return

    setIsGeneratingPdf(true)
    try {
      const [{ jsPDF }, processedPages] = await Promise.all([
        import('jspdf'),
        Promise.all(
          pages.map(async (page) => {
            if (page.edits.filter === 'original' && !page.edits.cropAreaPixels) {
              return page.processedDataUrl || page.originalDataUrl
            }
            return processImage(page.originalDataUrl, {
              cropAreaPixels: page.edits.cropAreaPixels ?? undefined,
              filter: page.edits.filter,
            })
          })
        ),
      ])

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      processedPages.forEach((dataUrl, index) => {
        if (index > 0) {
          pdf.addPage()
        }

        const imageProps = pdf.getImageProperties(dataUrl)
        const ratio = Math.min(pageWidth / imageProps.width, pageHeight / imageProps.height)
        const renderWidth = imageProps.width * ratio
        const renderHeight = imageProps.height * ratio
        const offsetX = (pageWidth - renderWidth) / 2
        const offsetY = (pageHeight - renderHeight) / 2

        pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderWidth, renderHeight)
      })

      const blob = pdf.output('blob')
      const file = new File([blob], `uolink-scan-${Date.now()}.pdf`, {
        type: 'application/pdf',
      })

      onComplete(file)
      handleClose()
    } catch (error) {
      console.error('[ScannerModal] Failed to generate PDF', error)
      setCameraError('Unable to generate the PDF. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [handleClose, onComplete, pages])

  if (!isOpen) {
    return null
  }


  return (
    <div className={`fixed inset-0 z-[70] ${
      isCaptureStep ? 'bg-black' : 'bg-black/80 backdrop-blur-sm flex items-center justify-center'
    }`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={`relative flex ${
          isCaptureStep ? 'h-screen w-screen' : 'h-[min(90vh,760px)] w-[min(960px,92vw)]'
        } flex-col overflow-hidden ${isCaptureStep ? '' : 'rounded-3xl bg-white shadow-2xl'}`}
      >
        {!isCaptureStep && (
          <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (step === 'edit') {
                    handleEditCancel()
                  } else {
                    setStep('capture')
                  }
                }}
                className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1f1f1f]">UOLink Scanner</span>
                <span className="text-xs text-gray-500">
                  {step === 'review' && 'Reorder pages and get ready to export'}
                  {step === 'edit' && 'Crop and enhance this page'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {pages.length > 0 && (
                <span className="rounded-full bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316]">
                  {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </span>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <main className={isCaptureStep ? 'relative flex-1 bg-black' : 'flex-1 overflow-hidden bg-gray-50'}>
          {cameraError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <CameraOff className="h-12 w-12 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ab332]"
              >
                <Camera className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : (
            <>
              {isCaptureStep && (
                <div
                  ref={captureContainerRef}
                  className="absolute inset-0 overflow-hidden"
                  style={{ minHeight: '100vh', minWidth: '100vw' }}
                >
                  <video
                    ref={videoRef}
                    className="absolute"
                    style={videoStyle}
                    playsInline
                    autoPlay
                    muted
                  />
                  <canvas ref={overlayCanvasRef} style={overlayStyle} />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera view overlay with native-style UI */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top control bar */}
                    <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent px-6 pt-12 pb-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 pointer-events-auto">
                          <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm p-3 text-white transition hover:bg-white/30"
                          >
                            <X className="h-6 w-6" />
                          </button>
                          {pages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setStep('review')}
                              className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30"
                            >
                              <Sparkles className="h-5 w-5" />
                              Review ({pages.length})
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pointer-events-auto">
                          {isTorchAvailable && (
                            <button
                              type="button"
                              onClick={handleToggleTorch}
                              className="inline-flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm p-3 text-white transition hover:bg-white/30"
                            >
                              {isTorchEnabled ? (
                                <Zap className="h-6 w-6 text-amber-400" />
                              ) : (
                                <ZapOff className="h-6 w-6" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setUseAdvancedProcessing(!useAdvancedProcessing)}
                            className={`inline-flex items-center justify-center rounded-full backdrop-blur-sm p-3 text-white transition ${
                              useAdvancedProcessing ? 'bg-[#90c639]/80 hover:bg-[#90c639]' : 'bg-white/20 hover:bg-white/30'
                            }`}
                            title={useAdvancedProcessing ? 'Advanced processing enabled' : 'Advanced processing disabled'}
                          >
                            <Sparkles className={`h-6 w-6 ${useAdvancedProcessing ? 'text-white' : 'text-white/70'}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLiveDetectionEnabled(!liveDetectionEnabled)}
                            className={`inline-flex items-center justify-center rounded-full backdrop-blur-sm p-3 text-white transition ${
                              liveDetectionEnabled && isLiveDetectionReady ? 'bg-blue-500/80 hover:bg-blue-500' : 'bg-white/20 hover:bg-white/30'
                            }`}
                            title={liveDetectionEnabled ? 'Live detection enabled' : 'Live detection disabled'}
                          >
                            <div className="relative">
                              <div className={`h-6 w-6 rounded-full border-2 ${liveDetectionEnabled && isLiveDetectionReady ? 'border-white bg-blue-400' : 'border-white/70'}`} />
                              {liveDetectionEnabled && isLiveDetectionReady && (
                                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 animate-pulse" />
                              )}
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom control bar */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pt-16 pb-12">
                      <div className="flex items-center justify-between">
                        {/* Optional: Gallery thumbnail or live detection status */}
                        <div className="w-12 h-12 pointer-events-auto">
                          {pages.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setStep('review')}
                              className="relative h-12 w-12 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg"
                            >
                              <img
                                src={pages[pages.length - 1].processedDataUrl}
                                alt="Last captured"
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#90c639] text-xs font-bold text-white">
                                {pages.length}
                              </span>
                            </button>
                          ) : liveDetectionEnabled && currentLiveResult ? (
                            <div className="flex h-full items-center justify-center">
                              {currentLiveResult.corners && currentLiveResult.confidence > 0.2 ? (
                                <div className="flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-1">
                                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                  <span className="text-xs font-medium text-white">
                                    {Math.round(currentLiveResult.confidence * 100)}%
                                  </span>
                                </div>
                              ) : (
                                <div className="rounded-full bg-white/20 px-2 py-1">
                                  <span className="text-xs font-medium text-white/80">Scanning...</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {/* Capture button */}
                        <button
                          type="button"
                          onClick={handleCapture}
                          disabled={!isPortraitViewport || isCameraLoading || pages.length >= MAX_CAPTURED_PAGES}
                          className="pointer-events-auto relative flex h-20 w-20 items-center justify-center rounded-full bg-white/90 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/40 disabled:opacity-80"
                        >
                          <div className="absolute inset-2 rounded-full bg-black" />
                          <div className="relative h-16 w-16 rounded-full bg-white" />
                        </button>

                        {/* Settings or additional controls */}
                        <div className="w-12 h-12" />
                      </div>
                    </div>
                  </div>

                  {!isPortraitViewport && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center text-white">
                      <Smartphone className="h-10 w-10 opacity-80" />
                      <p className="text-lg font-semibold">Hold your device upright</p>
                      <p className="max-w-xs text-sm text-white/80">
                        Portrait scans capture the best results. Rotate back to continue.
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {pendingCapture && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 flex flex-col bg-black/90"
                      >
                        {isProcessingDocument && (
                          <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/60">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                            <span className="text-xs font-semibold uppercase tracking-widest text-white">
                              Processing scan
                            </span>
                          </div>
                        )}
                        <div className="flex-1 px-6 pt-16 pb-8">
                          <div className="flex h-full items-center justify-center">
                            <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-[#0f0f0f] shadow-[0_30px_90px_-50px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                              <div className="aspect-[3/4] w-full bg-gradient-to-b from-white/10 to-black/50">
                                <img
                                  src={pendingCapture}
                                  alt="Captured page preview"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="pointer-events-none absolute inset-4 rounded-[22px] border border-white/15" />
                              <div className="pointer-events-none absolute inset-x-10 bottom-8 h-3 rounded-full bg-black/40 blur-lg" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-4 px-6 pb-12 text-center">
                          <span className="text-lg font-semibold text-white">Keep this scan?</span>
                          <p className="max-w-sm text-sm text-white/70">
                            If the page looks sharp and upright, save it. Otherwise retake the shot for a clearer capture.
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-4">
                            <button
                              type="button"
                              onClick={handleCaptureDiscard}
                              disabled={isProcessingDocument}
                              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X className="h-5 w-5" />
                              Retake
                            </button>
                            <button
                              type="button"
                              onClick={handleCaptureKeep}
                              disabled={isProcessingDocument}
                              className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:bg-[#7ab332] disabled:opacity-80"
                            >
                              {isProcessingDocument ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Check className="h-5 w-5" />
                              )}
                              {isProcessingDocument ? 'Processing...' : 'Save scan'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {!isCaptureStep && step === 'review' && (
                <div className="flex h-full flex-col gap-6 overflow-hidden px-6 py-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Sparkles className="h-4 w-4 text-[#90c639]" />
                      {useAdvancedProcessing
                        ? 'Advanced auto-processing enabled. Drag to reorder, tap edit for fine-tuning.'
                        : 'Drag thumbnails to reorder. Tap edit for crop & filters.'
                      }
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('capture')}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                    >
                      <Plus className="h-4 w-4" />
                      Add more pages
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto rounded-2xl border border-dashed border-gray-200 bg-white p-4">
                    {pages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
                        <Camera className="h-10 w-10 text-gray-300" />
                        <span>Capture pages to build your PDF.</span>
                      </div>
                    ) : (
                      <Reorder.Group
                        axis="y"
                        values={pages}
                        onReorder={setPages}
                        className="flex flex-col gap-3"
                      >
                        {pages.map((page, index) => (
                          <Reorder.Item
                            key={page.id}
                            value={page}
                            className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-3 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-5 w-5 text-gray-400" />
                              <span className="text-xs font-semibold text-gray-500">Page {index + 1}</span>
                            </div>
                            <img
                              src={page.processedDataUrl}
                              alt={`Scanned page ${index + 1}`}
                              className="h-20 w-16 flex-shrink-0 rounded-lg object-cover shadow-inner"
                            />
                            <div className="ml-auto flex flex-wrap items-center gap-2">
                              {page.processingInfo?.wasAutoProcessed && (
                                <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                  <Sparkles className="h-3 w-3" />
                                  Auto-cropped
                                  {page.processingInfo.confidence && (
                                    <span className="text-green-600">
                                      ({Math.round(page.processingInfo.confidence * 100)}%)
                                    </span>
                                  )}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditor(page.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePage(page.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('capture')}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100"
                    >
                      Capture more
                    </button>
                    <button
                      type="button"
                      disabled={!pages.length || isGeneratingPdf}
                      onClick={handleGeneratePdf}
                      className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Generate PDF
                    </button>
                  </div>
                </div>
              )}

              {!isCaptureStep && step === 'edit' && activePage && (
                <div className="flex h-full flex-col gap-6 px-6 py-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      Editing page{' '}
                      <span className="rounded-full bg-[#f4fbe8] px-2 py-0.5 text-xs font-semibold text-[#365316]">
                        {pages.findIndex((page) => page.id === activePage.id) + 1}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {FILTER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setEditFilter(option.value)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            editFilter === option.value
                              ? 'border-[#90c639] bg-[#f4fbe8] text-[#365316]'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-6 lg:flex-row">
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-black">
                      <Cropper
                        image={activePage.originalDataUrl}
                        crop={editCrop}
                        zoom={editZoom}
                        aspect={0.707} // approximates A-series paper
                        onCropChange={setEditCrop}
                        onZoomChange={setEditZoom}
                        onCropComplete={(_, areaPixels) => {
                          cropAreaRef.current = areaPixels
                        }}
                        showGrid
                        objectFit="contain"
                        mediaProps={{
                          style:
                            editFilter === 'grayscale'
                              ? { filter: 'grayscale(1)' }
                              : editFilter === 'bw'
                              ? { filter: 'grayscale(1) contrast(1.4) brightness(1.1)' }
                              : undefined,
                        }}
                      />
                    </div>
                    <div className="flex w-full flex-col rounded-3xl border border-gray-200 bg-white p-4 lg:w-64">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Zoom</label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={editZoom}
                        onChange={(event) => setEditZoom(Number(event.target.value))}
                        className="mt-3 w-full accent-[#90c639]"
                      />
                      <div className="mt-6 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleEditSave}
                          disabled={isSavingEdit}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#90c639] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Save page
                        </button>
                        <button
                          type="button"
                          onClick={handleEditReset}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleEditCancel}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </motion.div>
    </div>
  )
}

export default ScannerModal
