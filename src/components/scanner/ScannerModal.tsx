'use client'

import { useCallback, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CameraOff, X, Loader2 } from 'lucide-react'
import { ScannerProvider, useScanner } from './contexts/ScannerContext'
import { useCameraSession } from './hooks/useCameraSession'
import { usePageProcessing } from './hooks/usePageProcessing'
import { usePdfAssembler } from './hooks/usePdfAssembler'
import { ScannerCaptureStep, ScannerReviewStep, ScannerEditStep, ScannerErrorBoundary, CropPreviewComponent } from './components'
import type { ScannerModalProps, Area, ScannerPage } from './types'
import './styles/mobile-optimizations.css'
import { useCameraHaptics } from './hooks/useHapticFeedback'

const DEFAULT_CROP = { x: 0, y: 0 }
const DEFAULT_ZOOM = 1

function createPageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `scan-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

function ScannerModalContent({ isOpen, onClose, onComplete }: ScannerModalProps) {
  const { state, dispatch } = useScanner()

  // Initialize hooks
  const cameraSession = useCameraSession()
  const pageProcessing = usePageProcessing()
  const pdfAssembler = usePdfAssembler()
  const haptics = useCameraHaptics({ enabled: true, autoDetect: true })

  const captureContainerRef = useRef<HTMLDivElement | null>(null)
  const cropAreaRef = useRef<Area | null>(null)

  const isCaptureStep = state.step === 'capture'

  // Reset state helper
  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' })
    cropAreaRef.current = null
  }, [dispatch])

  // Handle close
  const handleClose = useCallback(async () => {
    await haptics.navigationFeedback()
    onClose()
    cameraSession.stopCamera()
    resetState()
  }, [onClose, cameraSession.stopCamera, resetState, haptics])

  // Handle capture - moved from component to here
  const handleCapture = useCallback(() => {
    if (state.pendingCapture || !cameraSession.isPortraitViewport) return
    const video = cameraSession.videoRef.current
    const canvas = cameraSession.canvasRef.current
    if (!video || !canvas) return
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    const context = canvas.getContext('2d')
    if (!context) return

    const absoluteRotation = Math.abs(state.captureRotation) % 360
    const rotateQuarterTurn = absoluteRotation === 90 || absoluteRotation === 270
    const outputWidth = rotateQuarterTurn ? video.videoHeight : video.videoWidth
    const outputHeight = rotateQuarterTurn ? video.videoWidth : video.videoHeight

    canvas.width = outputWidth
    canvas.height = outputHeight

    context.save()
    context.translate(outputWidth / 2, outputHeight / 2)
    context.rotate((state.captureRotation * Math.PI) / 180)
    context.drawImage(
      video,
      -video.videoWidth / 2,
      -video.videoHeight / 2,
      video.videoWidth,
      video.videoHeight
    )
    context.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    dispatch({ type: 'SET_PENDING_CAPTURE', payload: dataUrl })
  }, [
    state.pendingCapture,
    state.captureRotation,
    cameraSession.isPortraitViewport,
    cameraSession.videoRef,
    cameraSession.canvasRef,
    dispatch,
  ])

  // Handle capture keep
  const handleCaptureKeep = useCallback(async () => {
    if (!state.pendingCapture || state.isProcessingDocument) return

    // Trigger haptic feedback for processing start
    await haptics.processingStart()

    await pageProcessing.handleCaptureKeep(state.pendingCapture, async (newPage) => {
      dispatch({ type: 'ADD_PAGE', payload: newPage })
      // Trigger success haptic feedback
      await haptics.processingComplete()
    }, cropAreaRef.current ?? null)
    cropAreaRef.current = null
  }, [state.pendingCapture, state.isProcessingDocument, pageProcessing.handleCaptureKeep, dispatch, haptics])

  // Handle edit save
  const handleEditSave = useCallback(async () => {
    const activePage = state.pages.find(page => page.id === state.activePageId)
    if (!activePage) return

    await pageProcessing.handleEditSave(
      activePage,
      state.editCrop,
      state.editZoom,
      state.editFilter,
      cropAreaRef.current ?? null,
      (updatedPage) => {
        dispatch({
          type: 'SET_PAGES',
          payload: state.pages.map(page =>
            page.id === updatedPage.id ? updatedPage : page
          )
        })
      }
    )
    cropAreaRef.current = null
  }, [state.pages, state.activePageId, state.editCrop, state.editZoom, state.editFilter, pageProcessing.handleEditSave, dispatch])

  // Handle generate PDF
  const handleGeneratePdf = useCallback(async () => {
    await pdfAssembler.handleGeneratePdf(state.pages, onComplete, handleClose)
  }, [pdfAssembler.handleGeneratePdf, state.pages, onComplete, handleClose])

  // Handle other actions
  const handleRemovePage = useCallback((pageId: string) => {
    dispatch({ type: 'REMOVE_PAGE', payload: pageId })
  }, [dispatch])

  const handleOpenEditor = useCallback((pageId: string) => {
    dispatch({ type: 'SET_ACTIVE_PAGE_ID', payload: pageId })
    dispatch({ type: 'SET_STEP', payload: 'edit' })
  }, [dispatch])

  const handleEditCancel = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_PAGE_ID', payload: null })
    dispatch({ type: 'SET_STEP', payload: 'review' })
  }, [dispatch])

  const handleEditReset = useCallback(() => {
    dispatch({ type: 'SET_EDIT_CROP', payload: DEFAULT_CROP })
    dispatch({ type: 'SET_EDIT_ZOOM', payload: DEFAULT_ZOOM })
    dispatch({ type: 'SET_EDIT_FILTER', payload: 'original' })
    cropAreaRef.current = null
  }, [dispatch])

  const handleReorderPages = useCallback((reorderedPages: ScannerPage[]) => {
    dispatch({ type: 'SET_PAGES', payload: reorderedPages })
  }, [dispatch])

  const handleToggleAdvancedProcessing = useCallback(() => {
    dispatch({ type: 'SET_ADVANCED_PROCESSING', payload: !state.useAdvancedProcessing })
  }, [state.useAdvancedProcessing, dispatch])

  // Handle crop complete
  const handleCropComplete = useCallback((area: Area) => {
    cropAreaRef.current = area
  }, [])

  // Handle edit controls
  const handleCropChange = useCallback((crop: { x: number; y: number }) => {
    dispatch({ type: 'SET_EDIT_CROP', payload: crop })
  }, [dispatch])

  const handleZoomChange = useCallback((zoom: number) => {
    dispatch({ type: 'SET_EDIT_ZOOM', payload: zoom })
  }, [dispatch])

  const handleFilterChange = useCallback((filter: string) => {
    dispatch({ type: 'SET_EDIT_FILTER', payload: filter as any })
  }, [dispatch])

  const activePage = useMemo(
    () => state.pages.find(page => page.id === state.activePageId) || null,
    [state.pages, state.activePageId]
  )

  // Update edit state when active page changes
  useEffect(() => {
    if (activePage) {
      dispatch({ type: 'SET_EDIT_CROP', payload: activePage.edits.crop ?? DEFAULT_CROP })
      dispatch({ type: 'SET_EDIT_ZOOM', payload: activePage.edits.zoom ?? DEFAULT_ZOOM })
      dispatch({ type: 'SET_EDIT_FILTER', payload: activePage.edits.filter ?? 'original' })
      cropAreaRef.current = activePage.edits.cropAreaPixels ?? null
    } else {
      cropAreaRef.current = null
      dispatch({ type: 'SET_EDIT_CROP', payload: DEFAULT_CROP })
      dispatch({ type: 'SET_EDIT_ZOOM', payload: DEFAULT_ZOOM })
      dispatch({ type: 'SET_EDIT_FILTER', payload: 'original' })
    }
  }, [activePage, dispatch])

  // Camera management
  useEffect(() => {
    if (isOpen) {
      cameraSession.startCamera().catch((error) => {
        console.error('[ScannerModal] Failed to start camera:', error)
        // Error is already handled by the hook, but we log it here for debugging
      })
    } else {
      cameraSession.stopCamera()
      resetState()
    }

    return () => {
      cameraSession.stopCamera()
    }
  }, [isOpen, cameraSession.startCamera, cameraSession.stopCamera, resetState])

  // Handle unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[ScannerModal] Unhandled promise rejection:', event.reason)
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Window resize handling
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return
    const handleResize = () => {
      cameraSession.evaluateRotation()
    }
    const handleOrientationChange = () => {
      cameraSession.evaluateRotation()
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
  }, [isOpen, cameraSession])

  // Container size observation
  useEffect(() => {
    if (!isCaptureStep) {
      dispatch({ type: 'SET_CONTAINER_SIZE', payload: { width: 0, height: 0 } })
      return
    }

    const node = captureContainerRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      if (node) {
        const rect = node.getBoundingClientRect()
        dispatch({ type: 'SET_CONTAINER_SIZE', payload: { width: rect.width, height: rect.height } })
      }
      return
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      dispatch({ type: 'SET_CONTAINER_SIZE', payload: { width: rect.width, height: rect.height } })
    }

    updateSize()

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      dispatch({ type: 'SET_CONTAINER_SIZE', payload: { width, height } })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [isCaptureStep, dispatch])

  if (!isOpen) {
    return null
  }

  return (
    <div className={`fixed inset-0 z-[70] scanner-high-dpi ${
      isCaptureStep ? 'bg-black' : 'bg-black/80 backdrop-blur-sm flex items-center justify-center'
    }`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={`relative flex scanner-modal-mobile ${
          isCaptureStep ? 'h-screen w-screen' : 'h-[min(90vh,760px)] w-[min(960px,92vw)] scanner-review-mobile scanner-edit-mobile'
        } flex-col overflow-hidden ${isCaptureStep ? '' : 'rounded-3xl bg-white shadow-2xl'}`}
      >
        {!isCaptureStep && (
          <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await haptics.navigationFeedback()
                  if (state.step === 'edit') {
                    handleEditCancel()
                  } else {
                    dispatch({ type: 'SET_STEP', payload: 'capture' })
                  }
                }}
                className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100 scanner-touch-button scanner-focusable"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1f1f1f]">UOLink Scanner</span>
                <span className="text-xs text-gray-500">
                  {state.step === 'review' && 'Reorder pages and get ready to export'}
                  {state.step === 'edit' && 'Crop and enhance this page'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {state.pages.length > 0 && (
                <span className="rounded-full bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316]">
                  {state.pages.length} {state.pages.length === 1 ? 'page' : 'pages'}
                </span>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-100 scanner-touch-button scanner-focusable"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <main className={isCaptureStep ? 'relative flex-1 bg-black' : 'flex-1 overflow-hidden bg-gray-50'}>
          <ScannerErrorBoundary>
            {cameraSession.cameraError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                <CameraOff className="h-12 w-12 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">{cameraSession.cameraError}</p>
                <button
                  type="button"
                  onClick={async () => {
                    await haptics.buttonPressFeedback()
                    cameraSession.startCamera()
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ab332] scanner-touch-button scanner-focusable"
                >
                  <CameraOff className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <>
                {isCaptureStep && (
                  <ScannerErrorBoundary>
                    <ScannerCaptureStep
                      state={state}
                      videoRef={cameraSession.videoRef}
                      canvasRef={cameraSession.canvasRef}
                      videoStyle={cameraSession.videoStyle}
                      captureContainerRef={captureContainerRef}
                      onCapture={handleCapture}
                      onToggleTorch={cameraSession.handleToggleTorch}
                      onClose={handleClose}
                      onReviewPages={() => dispatch({ type: 'SET_STEP', payload: 'review' })}
                      onToggleAdvancedProcessing={handleToggleAdvancedProcessing}
                    />
                  </ScannerErrorBoundary>
                )}

                {state.step === 'review' && (
                  <ScannerErrorBoundary>
                    <ScannerReviewStep
                      state={state}
                      onBack={() => dispatch({ type: 'SET_STEP', payload: 'capture' })}
                      onAddMore={() => dispatch({ type: 'SET_STEP', payload: 'capture' })}
                      onOpenEditor={handleOpenEditor}
                      onRemovePage={handleRemovePage}
                      onReorderPages={handleReorderPages}
                      onGeneratePdf={handleGeneratePdf}
                    />
                  </ScannerErrorBoundary>
                )}

                {state.step === 'edit' && activePage && (
                  <ScannerErrorBoundary>
                    <ScannerEditStep
                      state={state}
                      activePage={activePage}
                      editCrop={state.editCrop}
                      editZoom={state.editZoom}
                      editFilter={state.editFilter}
                      onCropChange={handleCropChange}
                      onZoomChange={handleZoomChange}
                      onFilterChange={handleFilterChange}
                      onCropComplete={handleCropComplete}
                      onSave={handleEditSave}
                      onReset={handleEditReset}
                      onCancel={handleEditCancel}
                      onBack={handleEditCancel}
                    />
                  </ScannerErrorBoundary>
                )}
              </>
            )}
          </ScannerErrorBoundary>
        </main>
      </motion.div>

      {/* Handle pending capture confirmation - New Design */}
      {state.pendingCapture && isCaptureStep && (
        <AnimatePresence>
          <div className="absolute inset-0 z-50 flex flex-col bg-black">
            {state.isProcessingDocument && (
              <div className="pointer-events-none absolute inset-0 z-60 flex flex-col items-center justify-center gap-2 bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white">
                  Processing scan
                </span>
              </div>
            )}
            
            {/* Top Navigation */}
            <div className="flex items-center justify-between p-4 text-white">
              <button
                type="button"
                onClick={async () => {
                  await haptics.navigationFeedback()
                  dispatch({ type: 'SET_PENDING_CAPTURE', payload: null })
                }}
                disabled={state.isProcessingDocument}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="text-center">
                <div className="text-white font-medium">Review Scan</div>
              </div>
              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Main Image with Crop Handles */}
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="relative max-w-sm w-full">
                <CropPreviewComponent
                  imageDataUrl={state.pendingCapture}
                  onCropChange={(cropData) => {
                    // Store crop data for processing
                    cropAreaRef.current = cropData.area
                  }}
                  onRetake={() => {
                    dispatch({ type: 'SET_PENDING_CAPTURE', payload: null })
                  }}
                />
              </div>
            </div>

            {/* Bottom Action */}
            <div className="p-6 pb-12">
              <button
                type="button"
                onClick={handleCaptureKeep}
                disabled={state.isProcessingDocument}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 text-lg font-semibold text-white bg-[#90c639] rounded-2xl hover:bg-[#7ab332] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
              >
                {state.isProcessingDocument ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Review and Edit
                    <ArrowLeft className="h-5 w-5 rotate-180" />
                  </>
                )}
              </button>
            </div>
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}

export function ScannerModal(props: ScannerModalProps) {
  return (
    <ScannerProvider onComplete={props.onComplete} onClose={props.onClose}>
      <ScannerModalContent {...props} />
    </ScannerProvider>
  )
}

export default ScannerModal
