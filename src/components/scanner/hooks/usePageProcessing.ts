'use client'

import { useCallback, useMemo } from 'react'
import { useScanner } from '../contexts/ScannerContext'
import { processImage } from '../imageUtils'
import { processDocumentAdvanced } from '../opencvUtils'
import type { UsePageProcessingReturn, ScannerPage, Area, ScannerFilter } from '../types'

const createPageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `scan-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

const DEFAULT_CROP = { x: 0, y: 0 }
const DEFAULT_ZOOM = 1
const ORIGINAL_FILTER: ScannerFilter = 'original'
const FALLBACK_ENHANCE_FILTER: ScannerFilter = 'enhanced-contrast'

export function usePageProcessing(): UsePageProcessingReturn {
  const { state, dispatch } = useScanner()

  const handleCaptureKeep = useCallback(async (
    pendingCapture: string,
    addPageCallback: (page: ScannerPage) => void,
    cropArea?: Area | null
  ) => {
    if (state.isProcessingDocument) return

    dispatch({ type: 'SET_PROCESSING_DOCUMENT', payload: true })

    try {
      let captureSource = pendingCapture
      if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
        try {
          captureSource = await processImage(pendingCapture, {
            cropAreaPixels: cropArea,
            filter: ORIGINAL_FILTER,
          })
        } catch (error) {
          console.warn('[usePageProcessing] Failed to apply manual crop before processing', error)
        }
      }

      let processedResult = captureSource
      let processingInfo: ScannerPage['processingInfo'] = {
        wasAutoProcessed: false
      }

      try {
        if (state.useAdvancedProcessing) {
          const result = await processDocumentAdvanced(captureSource, state.processingOptions)
          processedResult = result.processedDataUrl
          processingInfo = {
            wasAutoProcessed: result.detectedCorners !== null && (result.confidence ?? 0) > 0.3,
            confidence: result.confidence,
            processingTime: result.processingTime,
            detectedCorners: result.detectedCorners ?? undefined
          }

          if ((result.confidence ?? 0) <= 0.3) {
            try {
              processedResult = await processImage(result.processedDataUrl, {
                cropAreaPixels: null,
                filter: FALLBACK_ENHANCE_FILTER,
              })
            } catch (enhanceError) {
              console.warn('[usePageProcessing] Fallback enhance failed', enhanceError)
            }
          }
        } else {
          processedResult = captureSource
          processingInfo = { wasAutoProcessed: false }
        }
      } catch (error) {
        console.warn('[usePageProcessing] Document detection failed, using original capture', error)
        try {
          processedResult = await processImage(captureSource, {
            cropAreaPixels: null,
            filter: FALLBACK_ENHANCE_FILTER,
          })
        } catch (enhanceError) {
          console.warn('[usePageProcessing] Unable to apply fallback enhance', enhanceError)
          processedResult = captureSource
        }
        processingInfo = {
          wasAutoProcessed: false
        }
      }

      const newPage: ScannerPage = {
        id: createPageId(),
        originalDataUrl: captureSource,
        processedDataUrl: processedResult,
        edits: {
          crop: DEFAULT_CROP,
          zoom: DEFAULT_ZOOM,
          cropAreaPixels: cropArea ?? null,
          filter: 'original',
        },
        processingInfo
      }

      addPageCallback(newPage)
      dispatch({ type: 'SET_PENDING_CAPTURE', payload: null })
    } finally {
      dispatch({ type: 'SET_PROCESSING_DOCUMENT', payload: false })
    }
  }, [state.isProcessingDocument, state.useAdvancedProcessing, state.processingOptions, dispatch])

  const handleEditSave = useCallback(async (
    activePage: ScannerPage,
    editCrop: { x: number; y: number },
    editZoom: number,
    editFilter: string,
    cropArea: Area | null | undefined,
    savePageCallback: (updatedPage: ScannerPage) => void
  ) => {
    if (!activePage) return

    dispatch({ type: 'SET_SAVING_EDIT', payload: true })
    try {
      let baseDataUrl = activePage.originalDataUrl
      const hasCrop =
        cropArea &&
        Number.isFinite(cropArea.width) &&
        Number.isFinite(cropArea.height) &&
        cropArea.width > 0 &&
        cropArea.height > 0

      if (hasCrop) {
        baseDataUrl = await processImage(activePage.originalDataUrl, {
          cropAreaPixels: cropArea,
          filter: ORIGINAL_FILTER,
        })
      }

      let processedDataUrl = baseDataUrl
      if (editFilter !== ORIGINAL_FILTER) {
        processedDataUrl = await processImage(baseDataUrl, {
          cropAreaPixels: null,
          filter: editFilter as any,
        })
      }

      const updatedPage: ScannerPage = {
        ...activePage,
        originalDataUrl: baseDataUrl,
        processedDataUrl,
        edits: {
          crop: editCrop,
          zoom: editZoom,
          cropAreaPixels: hasCrop ? cropArea ?? null : null,
          filter: editFilter as any,
        },
      }

      savePageCallback(updatedPage)
      dispatch({ type: 'SET_ACTIVE_PAGE_ID', payload: null })
      dispatch({ type: 'SET_STEP', payload: 'review' })
    } catch (error) {
      console.error('[usePageProcessing] Failed to save edits', error)
      dispatch({
        type: 'SET_CAMERA_ERROR',
        payload: 'Unable to apply edits. Please try again.'
      })
    } finally {
      dispatch({ type: 'SET_SAVING_EDIT', payload: false })
    }
  }, [dispatch])

  return useMemo(() => ({
    isProcessingDocument: state.isProcessingDocument,
    isSavingEdit: state.isSavingEdit,
    useAdvancedProcessing: state.useAdvancedProcessing,
    processingOptions: state.processingOptions,
    handleCaptureKeep,
    handleEditSave,
  }), [
    state.isProcessingDocument,
    state.isSavingEdit,
    state.useAdvancedProcessing,
    state.processingOptions,
    handleCaptureKeep,
    handleEditSave,
  ])
}
