'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Check, RotateCcw, X, Grid3X3, AlertTriangle, Move, ZoomIn, ZoomOut, Eye } from 'lucide-react'
import { applyManualPerspectiveCorrection, validateCropCorners } from '../utils/perspectiveCorrection'
import { useCameraHaptics } from '../hooks/useHapticFeedback'

export interface Point {
  x: number
  y: number
}

export interface ManualCroppingEditorProps {
  imageDataUrl: string
  initialCorners?: Point[]
  onCornersChange: (corners: Point[]) => void
  onApply: (corners: Point[]) => Promise<void>
  onCancel: () => void
  onReset: () => void
  isProcessing?: boolean
  className?: string
}

const CORNER_SIZE = 16
const TOUCH_SIZE = 44 // Increased for better mobile touch
const MOBILE_CORNER_SIZE = 20
const MOBILE_TOUCH_SIZE = 56

export function ManualCroppingEditor({
  imageDataUrl,
  initialCorners,
  onCornersChange,
  onApply,
  onCancel,
  onReset,
  isProcessing = false,
  className = ''
}: ManualCroppingEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  
  const [corners, setCorners] = useState<Point[]>([])
  const [dragState, setDragState] = useState<{
    isDragging: boolean
    cornerIndex: number
    startPos: Point
  } | null>(null)
  
  const [imageLoaded, setImageLoaded] = useState(false)
  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 })
  const [showGrid, setShowGrid] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  
  const [validationState, setValidationState] = useState<{
    isValid: boolean
    issues: string[]
  }>({ isValid: true, issues: [] })

  const haptics = useCameraHaptics({ enabled: true, autoDetect: true })
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  
  const cornerSize = isMobile ? MOBILE_CORNER_SIZE : CORNER_SIZE
  const touchSize = isMobile ? MOBILE_TOUCH_SIZE : TOUCH_SIZE

  // Load image and setup canvas
  useEffect(() => {
    if (!imageDataUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      imageRef.current = img
      
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      // Calculate canvas size to fit container while maintaining aspect ratio
      const containerRect = container.getBoundingClientRect()
      const maxWidth = containerRect.width - 40
      const maxHeight = containerRect.height - 40
      
      const imageAspect = img.width / img.height
      const containerAspect = maxWidth / maxHeight
      
      let canvasWidth, canvasHeight
      
      if (imageAspect > containerAspect) {
        canvasWidth = maxWidth
        canvasHeight = maxWidth / imageAspect
      } else {
        canvasHeight = maxHeight
        canvasWidth = maxHeight * imageAspect
      }
      
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      canvas.style.width = `${canvasWidth}px`
      canvas.style.height = `${canvasHeight}px`
      
      setCanvasScale({
        x: canvasWidth / img.width,
        y: canvasHeight / img.height
      })
      
      setImageLoaded(true)
    }
    
    img.onerror = () => {
      console.error('Failed to load image for manual cropping')
    }
    
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Initialize corners
  useEffect(() => {
    if (!imageLoaded) return

    let defaultCorners: Point[]
    
    if (initialCorners && initialCorners.length === 4) {
      // Convert image coordinates to canvas coordinates
      defaultCorners = initialCorners.map(corner => ({
        x: corner.x * canvasScale.x,
        y: corner.y * canvasScale.y
      }))
    } else {
      // Default corners with padding
      const canvas = canvasRef.current
      if (!canvas) return
      
      const padding = 30
      defaultCorners = [
        { x: padding, y: padding },
        { x: canvas.width - padding, y: padding },
        { x: canvas.width - padding, y: canvas.height - padding },
        { x: padding, y: canvas.height - padding }
      ]
    }

    setCorners(defaultCorners)
  }, [imageLoaded, canvasScale])

  // Redraw canvas when corners or settings change
  useEffect(() => {
    if (!imageLoaded) return
    drawCanvas()
  }, [corners, showGrid, imageLoaded])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    
    if (corners.length === 4) {
      // Draw overlay outside crop area
      ctx.save()
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Cut out crop area
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      
      // Draw grid if enabled
      if (showGrid) {
        ctx.save()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        
        // Clip to crop area
        ctx.beginPath()
        ctx.moveTo(corners[0].x, corners[0].y)
        for (let i = 1; i < 4; i++) {
          ctx.lineTo(corners[i].x, corners[i].y)
        }
        ctx.closePath()
        ctx.clip()
        
        // Draw rule of thirds grid
        for (let i = 1; i < 3; i++) {
          const x = (canvas.width / 3) * i
          const y = (canvas.height / 3) * i
          
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvas.height)
          ctx.stroke()
          
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(canvas.width, y)
          ctx.stroke()
        }
        ctx.restore()
      }
      
      // Draw crop outline
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()
      ctx.stroke()
      
      // Draw corner handles
      corners.forEach((corner, index) => {
        const isActive = dragState?.cornerIndex === index
        
        // Handle background with mobile-optimized size
        ctx.fillStyle = isActive ? '#90c639' : '#3b82f6'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = isMobile ? 3 : 2
        ctx.beginPath()
        ctx.arc(corner.x, corner.y, cornerSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Corner number with mobile-optimized font
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${isMobile ? '14px' : '10px'} sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((index + 1).toString(), corner.x, corner.y)
        
        // Add touch indicator ring for mobile
        if (isMobile && isActive) {
          ctx.strokeStyle = 'rgba(144, 198, 57, 0.3)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(corner.x, corner.y, touchSize / 2, 0, Math.PI * 2)
          ctx.stroke()
        }
      })
    }
  }, [corners, showGrid, dragState])

  const generatePreview = useCallback(() => {
    if (corners.length !== 4 || !imageRef.current) {
      setPreviewDataUrl(null)
      return
    }

    const canvas = previewCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set preview size
    canvas.width = 280
    canvas.height = 350

    // Convert canvas coordinates to image coordinates
    const imageCorners = corners.map(corner => ({
      x: corner.x / canvasScale.x,
      y: corner.y / canvasScale.y
    }))

    // Calculate bounding box
    const minX = Math.min(...imageCorners.map(p => p.x))
    const maxX = Math.max(...imageCorners.map(p => p.x))
    const minY = Math.min(...imageCorners.map(p => p.y))
    const maxY = Math.max(...imageCorners.map(p => p.y))
    
    const cropWidth = maxX - minX
    const cropHeight = maxY - minY
    
    // Scale to fit preview
    const scale = Math.min(canvas.width / cropWidth, canvas.height / cropHeight) * 0.9
    const previewWidth = cropWidth * scale
    const previewHeight = cropHeight * scale
    
    const offsetX = (canvas.width - previewWidth) / 2
    const offsetY = (canvas.height - previewHeight) / 2
    
    // Clear and draw preview
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(
      imageRef.current,
      minX, minY, cropWidth, cropHeight,
      offsetX, offsetY, previewWidth, previewHeight
    )
    
    setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.85))
  }, [corners, canvasScale])

  // Handle corner changes asynchronously to avoid setState during render
  useEffect(() => {
    if (corners.length !== 4) return
    
    // Convert to image coordinates
    const imageCorners = corners.map(corner => ({
      x: corner.x / canvasScale.x,
      y: corner.y / canvasScale.y
    }))
    
    // Validate
    const validation = validateCropCorners(imageCorners)
    setValidationState(validation)
    
    // Notify parent
    onCornersChange(imageCorners)
    
    // Generate preview
    generatePreview()
  }, [corners, canvasScale, onCornersChange, generatePreview])

  const getEventPosition = useCallback((event: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in event) {
      const touch = event.touches[0] || event.changedTouches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      }
    } else {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    }
  }, [])

  const findCornerAtPosition = useCallback((pos: Point): number => {
    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i]
      const distance = Math.sqrt(
        Math.pow(pos.x - corner.x, 2) + Math.pow(pos.y - corner.y, 2)
      )
      if (distance <= touchSize / 2) {
        return i
      }
    }
    return -1
  }, [corners, touchSize])

  const constrainPosition = useCallback((pos: Point): Point => {
    const canvas = canvasRef.current
    if (!canvas) return pos

    return {
      x: Math.max(10, Math.min(canvas.width - 10, pos.x)),
      y: Math.max(10, Math.min(canvas.height - 10, pos.y))
    }
  }, [])

  const handleStart = useCallback(async (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault()
    
    const pos = getEventPosition(event)
    const cornerIndex = findCornerAtPosition(pos)
    
    if (cornerIndex >= 0) {
      setDragState({
        isDragging: true,
        cornerIndex,
        startPos: pos
      })
      
      // Enhanced haptic feedback
      await haptics.trigger('drag-start')
    }
  }, [getEventPosition, findCornerAtPosition, haptics])

  const handleMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!dragState?.isDragging) return
    
    event.preventDefault()
    
    const pos = getEventPosition(event)
    const constrainedPos = constrainPosition(pos)
    
    setCorners(prev => {
      const newCorners = [...prev]
      newCorners[dragState.cornerIndex] = constrainedPos
      return newCorners
    })
  }, [dragState, getEventPosition, constrainPosition])

  const handleEnd = useCallback(async (event: React.MouseEvent | React.TouchEvent) => {
    if (!dragState?.isDragging) return
    
    event.preventDefault()
    setDragState(null)
    
    // Final haptic feedback
    await haptics.trigger('drag-end')
  }, [dragState, haptics])

  const handleReset = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const padding = 30
    const defaultCorners = [
      { x: padding, y: padding },
      { x: canvas.width - padding, y: padding },
      { x: canvas.width - padding, y: canvas.height - padding },
      { x: padding, y: canvas.height - padding }
    ]
    
    setCorners(defaultCorners)
    onReset()
  }, [onReset])

  const handleApply = useCallback(async () => {
    if (!validationState.isValid || corners.length !== 4) return
    
    const imageCorners = corners.map(corner => ({
      x: corner.x / canvasScale.x,
      y: corner.y / canvasScale.y
    }))
    
    try {
      const result = await applyManualPerspectiveCorrection(imageDataUrl, imageCorners)
      if (result.success) {
        await onApply(imageCorners)
      } else {
        console.error('Perspective correction failed:', result.error)
        await onApply(imageCorners)
      }
    } catch (error) {
      console.error('Error during perspective correction:', error)
      await onApply(imageCorners)
    }
  }, [corners, canvasScale, imageDataUrl, validationState, onApply])

  if (isMobile) {
    return (
      <div className={`h-full bg-black flex flex-col ${className}`}>
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 bg-black/90 backdrop-blur-sm text-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Manual Crop</h2>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              Drag corners
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await haptics.buttonPressFeedback()
                setShowGrid(!showGrid)
              }}
              className={`p-2 rounded-lg transition-colors scanner-touch-button ${
                showGrid 
                  ? 'bg-[#90c639] text-white' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={async () => {
                await haptics.buttonPressFeedback()
                setShowPreview(!showPreview)
              }}
              className={`p-2 rounded-lg transition-colors scanner-touch-button ${
                showPreview 
                  ? 'bg-[#90c639] text-white' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Messages */}
        {!validationState.isValid && (
          <div className="mx-4 mb-4 p-3 bg-amber-500/90 backdrop-blur-sm rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">Crop Area Issues</div>
                <ul className="mt-1 text-sm text-amber-100 list-disc list-inside">
                  {validationState.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Canvas Area */}
        <div className="flex-1 relative">
          <div 
            ref={containerRef}
            className="h-full w-full flex items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              className="touch-none max-w-full max-h-full"
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              style={{ touchAction: 'none' }}
            />
          </div>

          {/* Mobile Preview Overlay */}
          {showPreview && previewDataUrl && (
            <div className="absolute top-4 right-4 w-24 h-32 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
              <img
                src={previewDataUrl}
                alt="Crop preview"
                className="w-full h-full object-contain rounded"
              />
            </div>
          )}

          {/* Corner Instructions */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
            Drag the numbered corners to adjust crop area
          </div>
        </div>

        {/* Mobile Action Bar */}
        <div className="p-4 bg-black/90 backdrop-blur-sm border-t border-white/10">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={async () => {
                await haptics.buttonPressFeedback()
                handleReset()
              }}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium text-white bg-white/20 rounded-xl hover:bg-white/30 disabled:opacity-50 transition-colors scanner-touch-button"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            
            <button
              type="button"
              onClick={async () => {
                await haptics.navigationFeedback()
                onCancel()
              }}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium text-white bg-white/20 rounded-xl hover:bg-white/30 disabled:opacity-50 transition-colors scanner-touch-button"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            
            <button
              type="button"
              onClick={async () => {
                await haptics.processingStart()
                await handleApply()
                await haptics.processingComplete()
              }}
              disabled={isProcessing || !validationState.isValid}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium text-white bg-[#90c639] rounded-xl hover:bg-[#7ab332] disabled:opacity-50 disabled:cursor-not-allowed transition-colors scanner-touch-button"
            >
              <Check className="w-4 h-4" />
              {isProcessing ? 'Processing...' : 'Apply'}
            </button>
          </div>
        </div>

        {/* Hidden preview canvas */}
        <canvas ref={previewCanvasRef} className="hidden" />
      </div>
    )
  }

  // Desktop Layout
  return (
    <div className={`h-full bg-gray-50 ${className}`}>
      {/* Desktop Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Manual Crop</h2>
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition ${
              showGrid 
                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </button>
        </div>
        
        <div className="text-sm text-gray-500">
          Drag corner handles to adjust crop area
        </div>
      </div>

      {/* Validation Messages */}
      {!validationState.isValid && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-800">Crop Area Issues</div>
              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                {validationState.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Main Content */}
      <div className="flex h-full">
        {/* Canvas Area */}
        <div className="flex-1 p-4">
          <div 
            ref={containerRef}
            className="h-full flex items-center justify-center bg-gray-900 rounded-lg"
          >
            <canvas
              ref={canvasRef}
              className="cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>

        {/* Desktop Preview Panel */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-3">Preview</div>
          
          <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 mb-4">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Crop preview"
                className="max-w-full max-h-full object-contain rounded"
              />
            ) : (
              <div className="text-center text-gray-500">
                <div className="text-sm">Preview will appear here</div>
                <div className="text-xs mt-1">Adjust corners to see result</div>
              </div>
            )}
          </div>

          {/* Desktop Controls */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !validationState.isValid}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {isProcessing ? 'Processing...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden preview canvas */}
      <canvas ref={previewCanvasRef} className="hidden" />
    </div>
  )
}