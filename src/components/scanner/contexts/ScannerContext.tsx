'use client'

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react'
import { ScannerState, ScannerAction, ScannerContextValue, ScannerStep, CaptureRotation, MobileOptimizations, ScannerPage, ScannerFilter, Area } from '../types'
import { detectMobileDevice, createMobileDetectionListener } from '../utils/deviceDetection'

const DEFAULT_CROP = { x: 0, y: 0 }
const DEFAULT_ZOOM = 1

function getInitialMobileOptimizations(): MobileOptimizations {
  if (typeof window === 'undefined') {
    return {
      isMobileDevice: false,
      isTabletDevice: false,
      shouldDisableEdgeDetection: false,
      shouldOptimizeForMobile: false,
      touchCapabilities: {
        supportsPinchZoom: false,
        supportsMultiTouch: false,
        hasHapticFeedback: false
      }
    }
  }
  
  const detection = detectMobileDevice()
  return {
    isMobileDevice: detection.isMobile,
    isTabletDevice: detection.isTablet,
    shouldDisableEdgeDetection: detection.shouldDisableEdgeDetection,
    shouldOptimizeForMobile: detection.shouldOptimizeForMobile,
    touchCapabilities: detection.touchCapabilities
  }
}

const initialState: ScannerState = {
  step: 'capture',
  pages: [],
  activePageId: null,
  pendingCapture: null,
  cameraError: null,
  isCameraLoading: false,
  isTorchAvailable: false,
  isTorchEnabled: false,
  isGeneratingPdf: false,
  isSavingEdit: false,
  isProcessingDocument: false,
  captureRotation: -90,
  isPortraitViewport: true,
  videoDimensions: { width: 0, height: 0 },
  containerSize: { width: 0, height: 0 },
  editCrop: DEFAULT_CROP,
  editZoom: DEFAULT_ZOOM,
  editFilter: 'original',
  useAdvancedProcessing: true,
  processingOptions: {
    blurKernel: 5,
    cannyLower: 50,
    cannyUpper: 150,
    contourAreaThreshold: 0.1,
    epsilon: 0.02
  },
  mobileOptimizations: getInitialMobileOptimizations(),
}

function scannerReducer(state: ScannerState, action: ScannerAction): ScannerState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload }
    case 'SET_PAGES':
      return { ...state, pages: action.payload }
    case 'ADD_PAGE':
      return { ...state, pages: [...state.pages, action.payload] }
    case 'REMOVE_PAGE':
      return {
        ...state,
        pages: state.pages.filter(page => page.id !== action.payload),
        activePageId: state.activePageId === action.payload ? null : state.activePageId
      }
    case 'SET_ACTIVE_PAGE_ID':
      return { ...state, activePageId: action.payload }
    case 'SET_PENDING_CAPTURE':
      return { ...state, pendingCapture: action.payload }
    case 'SET_CAMERA_ERROR':
      return { ...state, cameraError: action.payload }
    case 'SET_CAMERA_LOADING':
      return { ...state, isCameraLoading: action.payload }
    case 'SET_TORCH_AVAILABLE':
      return { ...state, isTorchAvailable: action.payload }
    case 'SET_TORCH_ENABLED':
      return { ...state, isTorchEnabled: action.payload }
    case 'SET_GENERATING_PDF':
      return { ...state, isGeneratingPdf: action.payload }
    case 'SET_SAVING_EDIT':
      return { ...state, isSavingEdit: action.payload }
    case 'SET_PROCESSING_DOCUMENT':
      return { ...state, isProcessingDocument: action.payload }
    case 'SET_CAPTURE_ROTATION':
      return { ...state, captureRotation: action.payload }
    case 'SET_PORTRAIT_VIEWPORT':
      return { ...state, isPortraitViewport: action.payload }
    case 'SET_VIDEO_DIMENSIONS':
      return { ...state, videoDimensions: action.payload }
    case 'SET_CONTAINER_SIZE':
      return { ...state, containerSize: action.payload }
    case 'SET_EDIT_CROP':
      return { ...state, editCrop: action.payload }
    case 'SET_EDIT_ZOOM':
      return { ...state, editZoom: action.payload }
    case 'SET_EDIT_FILTER':
      return { ...state, editFilter: action.payload }
    case 'SET_ADVANCED_PROCESSING':
      return { ...state, useAdvancedProcessing: action.payload }
    case 'SET_PROCESSING_OPTIONS':
      return { ...state, processingOptions: action.payload }
    case 'SET_MOBILE_OPTIMIZATIONS':
      return { ...state, mobileOptimizations: action.payload }
    case 'RESET_STATE':
      return {
        ...initialState,
        captureRotation: state.captureRotation,
        isPortraitViewport: state.isPortraitViewport,
        mobileOptimizations: state.mobileOptimizations, // Preserve mobile detection
      }
    default:
      return state
  }
}

const ScannerContext = createContext<ScannerContextValue | null>(null)

export function ScannerProvider({
  children,
  onComplete,
  onClose
}: {
  children: React.ReactNode
  onComplete: (file: File) => void
  onClose: () => void
}) {
  const [state, dispatch] = useReducer(scannerReducer, initialState)

  // Set up mobile detection listener for dynamic updates
  useEffect(() => {
    const cleanup = createMobileDetectionListener((detection) => {
      const mobileOptimizations: MobileOptimizations = {
        isMobileDevice: detection.isMobile,
        isTabletDevice: detection.isTablet,
        shouldDisableEdgeDetection: detection.shouldDisableEdgeDetection,
        shouldOptimizeForMobile: detection.shouldOptimizeForMobile,
        touchCapabilities: detection.touchCapabilities
      }
      
      dispatch({ type: 'SET_MOBILE_OPTIMIZATIONS', payload: mobileOptimizations })
      
    })

    return cleanup
  }, [dispatch])

  // Basic callbacks that don't depend on hooks
  const callbacks = useMemo(() => ({
    handleClose: () => {
      onClose()
    },
    handleCaptureDiscard: () => {
      dispatch({ type: 'SET_PENDING_CAPTURE', payload: null })
      dispatch({ type: 'SET_PROCESSING_DOCUMENT', payload: false })
    },
    handleRemovePage: (pageId: string) => {
      dispatch({ type: 'REMOVE_PAGE', payload: pageId })
    },
    handleOpenEditor: (pageId: string) => {
      dispatch({ type: 'SET_ACTIVE_PAGE_ID', payload: pageId })
      dispatch({ type: 'SET_STEP', payload: 'edit' })
    },
    handleEditCancel: () => {
      dispatch({ type: 'SET_ACTIVE_PAGE_ID', payload: null })
      dispatch({ type: 'SET_STEP', payload: 'review' })
    },
    handleEditReset: () => {
      dispatch({ type: 'SET_EDIT_CROP', payload: DEFAULT_CROP })
      dispatch({ type: 'SET_EDIT_ZOOM', payload: DEFAULT_ZOOM })
      dispatch({ type: 'SET_EDIT_FILTER', payload: 'original' })
    },
    // The following callbacks will be injected by the ScannerModal component
    handleToggleTorch: async () => {
      throw new Error('handleToggleTorch must be provided by ScannerModal')
    },
    handleCapture: () => {
      throw new Error('handleCapture must be provided by ScannerModal')
    },
    handleCaptureKeep: async (_capture: string, _addPage: (page: any) => void, _cropArea?: any) => {
      throw new Error('handleCaptureKeep must be provided by ScannerModal')
    },
    handleEditSave: async (_activePage: ScannerPage, _editCrop: { x: number; y: number }, _editZoom: number, _editFilter: ScannerFilter, _cropArea: Area | null | undefined, _savePageCallback: (updatedPage: ScannerPage) => void) => {
      throw new Error('handleEditSave must be provided by ScannerModal')
    },
    handleGeneratePdf: async () => {
      throw new Error('handleGeneratePdf must be provided by ScannerModal')
    },
    startCamera: async () => {
      throw new Error('startCamera must be provided by ScannerModal')
    },
    stopCamera: () => {
      throw new Error('stopCamera must be provided by ScannerModal')
    },
    evaluateRotation: () => {
      throw new Error('evaluateRotation must be provided by ScannerModal')
    },
  }), [onClose, dispatch])

  const contextValue: ScannerContextValue = useMemo(() => ({
    state,
    dispatch,
    callbacks,
  }), [state, dispatch, callbacks])

  return (
    <ScannerContext.Provider value={contextValue}>
      {children}
    </ScannerContext.Provider>
  )
}

export function useScanner() {
  const context = useContext(ScannerContext)
  if (!context) {
    throw new Error('useScanner must be used within a ScannerProvider')
  }
  return context
}
