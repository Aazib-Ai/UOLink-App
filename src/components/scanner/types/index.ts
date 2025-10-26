export type ScannerStep = 'capture' | 'review' | 'edit'
export type ScannerFilter = 'original' | 'grayscale' | 'bw' | 'enhanced-contrast' | 'auto-brightness' | 'document-grayscale' | 'text-sharpen'
export type CaptureRotation = -90 | 0

export interface ScannerPage {
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

export interface Area {
  x: number
  y: number
  width: number
  height: number
}

export interface ProcessingOptions {
  blurKernel: number
  cannyLower: number
  cannyUpper: number
  contourAreaThreshold: number
  epsilon: number
}

export interface MobileOptimizations {
  isMobileDevice: boolean
  isTabletDevice: boolean
  shouldDisableEdgeDetection: boolean
  shouldOptimizeForMobile: boolean
  touchCapabilities: {
    supportsPinchZoom: boolean
    supportsMultiTouch: boolean
    hasHapticFeedback: boolean
  }
}

export interface ScannerState {
  step: ScannerStep
  pages: ScannerPage[]
  activePageId: string | null
  pendingCapture: string | null
  cameraError: string | null
  isCameraLoading: boolean
  isTorchAvailable: boolean
  isTorchEnabled: boolean
  isGeneratingPdf: boolean
  isSavingEdit: boolean
  isProcessingDocument: boolean
  captureRotation: CaptureRotation
  isPortraitViewport: boolean
  videoDimensions: { width: number; height: number }
  containerSize: { width: number; height: number }
  editCrop: { x: number; y: number }
  editZoom: number
  editFilter: ScannerFilter
  useAdvancedProcessing: boolean
  processingOptions: ProcessingOptions
  mobileOptimizations: MobileOptimizations
}

export type ScannerAction =
  | { type: 'SET_STEP'; payload: ScannerStep }
  | { type: 'SET_PAGES'; payload: ScannerPage[] }
  | { type: 'ADD_PAGE'; payload: ScannerPage }
  | { type: 'REMOVE_PAGE'; payload: string }
  | { type: 'SET_ACTIVE_PAGE_ID'; payload: string | null }
  | { type: 'SET_PENDING_CAPTURE'; payload: string | null }
  | { type: 'SET_CAMERA_ERROR'; payload: string | null }
  | { type: 'SET_CAMERA_LOADING'; payload: boolean }
  | { type: 'SET_TORCH_AVAILABLE'; payload: boolean }
  | { type: 'SET_TORCH_ENABLED'; payload: boolean }
  | { type: 'SET_GENERATING_PDF'; payload: boolean }
  | { type: 'SET_SAVING_EDIT'; payload: boolean }
  | { type: 'SET_PROCESSING_DOCUMENT'; payload: boolean }
  | { type: 'SET_CAPTURE_ROTATION'; payload: CaptureRotation }
  | { type: 'SET_PORTRAIT_VIEWPORT'; payload: boolean }
  | { type: 'SET_VIDEO_DIMENSIONS'; payload: { width: number; height: number } }
  | { type: 'SET_CONTAINER_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_EDIT_CROP'; payload: { x: number; y: number } }
  | { type: 'SET_EDIT_ZOOM'; payload: number }
  | { type: 'SET_EDIT_FILTER'; payload: ScannerFilter }
  | { type: 'SET_ADVANCED_PROCESSING'; payload: boolean }
  | { type: 'SET_PROCESSING_OPTIONS'; payload: ProcessingOptions }
  | { type: 'SET_MOBILE_OPTIMIZATIONS'; payload: MobileOptimizations }
  | { type: 'RESET_STATE' }

export interface ScannerContextValue {
  state: ScannerState
  dispatch: React.Dispatch<ScannerAction>
  callbacks: {
    handleClose: () => void
    handleToggleTorch: () => Promise<void>
    handleCapture: () => void
    handleCaptureDiscard: () => void
    handleCaptureKeep: (pendingCapture: string, addPageCallback: (page: ScannerPage) => void, cropArea?: Area | null) => Promise<void>
    handleRemovePage: (pageId: string) => void
    handleOpenEditor: (pageId: string) => void
    handleEditCancel: () => void
    handleEditReset: () => void
    handleEditSave: (activePage: ScannerPage, editCrop: { x: number; y: number }, editZoom: number, editFilter: ScannerFilter, cropArea: Area | null | undefined, savePageCallback: (updatedPage: ScannerPage) => void) => Promise<void>
    handleGeneratePdf: () => Promise<void>
    startCamera: () => Promise<void>
    stopCamera: () => void
    evaluateRotation: () => void
  }
}

export interface UseCameraSessionReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  streamRef: React.MutableRefObject<MediaStream | null>
  videoStyle: React.CSSProperties
  cameraError: string | null
  isCameraLoading: boolean
  isTorchAvailable: boolean
  isTorchEnabled: boolean
  videoDimensions: { width: number; height: number }
  captureRotation: CaptureRotation
  isPortraitViewport: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  handleToggleTorch: () => Promise<void>
  evaluateRotation: () => void
  getDisplayMetrics: () => {
    containerWidth: number
    containerHeight: number
    videoWidth: number
    videoHeight: number
    coverScale: number
  }
}

export interface UsePageProcessingReturn {
  isProcessingDocument: boolean
  isSavingEdit: boolean
  useAdvancedProcessing: boolean
  processingOptions: ProcessingOptions
  handleCaptureKeep: (pendingCapture: string, addPageCallback: (page: ScannerPage) => void, cropArea?: Area | null) => Promise<void>
  handleEditSave: (activePage: ScannerPage, editCrop: { x: number; y: number }, editZoom: number, editFilter: ScannerFilter, cropArea: Area | null | undefined, savePageCallback: (updatedPage: ScannerPage) => void) => Promise<void>
}

export interface UsePdfAssemblerReturn {
  isGeneratingPdf: boolean
  handleGeneratePdf: (pages: ScannerPage[], onComplete: (file: File) => void, handleClose: () => void) => Promise<void>
}

export interface ScannerCaptureStepProps {
  state: ScannerState
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  videoStyle: React.CSSProperties
  captureContainerRef: React.RefObject<HTMLDivElement>
  onCapture: () => void
  onToggleTorch: () => Promise<void>
  onClose: () => void
  onReviewPages: () => void
  onToggleAdvancedProcessing: () => void
}

export interface ScannerReviewStepProps {
  state: ScannerState
  onBack: () => void
  onAddMore: () => void
  onOpenEditor: (pageId: string) => void
  onRemovePage: (pageId: string) => void
  onReorderPages: (pages: ScannerPage[]) => void
  onGeneratePdf: () => Promise<void>
}

export interface ScannerEditStepProps {
  state: ScannerState
  activePage: ScannerPage | null
  editCrop: { x: number; y: number }
  editZoom: number
  editFilter: ScannerFilter
  onCropChange: (crop: { x: number; y: number }) => void
  onZoomChange: (zoom: number) => void
  onFilterChange: (filter: ScannerFilter) => void
  onCropComplete: (cropArea: Area) => void
  onSave: () => Promise<void>
  onReset: () => void
  onCancel: () => void
  onBack: () => void
}

export interface ScannerToolbarProps {
  pages: ScannerPage[]
  isTorchAvailable: boolean
  isTorchEnabled: boolean
  useAdvancedProcessing: boolean
  onClose: () => void
  onReviewPages: () => void
  onToggleTorch: () => Promise<void>
  onToggleAdvancedProcessing: () => void
}

export interface ScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (file: File) => void
}
