'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { RotateCw, RefreshCw, RotateCcw } from 'lucide-react'
import { useCameraHaptics } from '../hooks/useHapticFeedback'

interface Point {
  x: number
  y: number
}

interface CropPreviewComponentProps {
  imageDataUrl: string
  onCropChange?: (cropData: { corners: Point[]; area: { x: number; y: number; width: number; height: number } }) => void
  onRetake?: () => void
  className?: string
  previewStyle?: React.CSSProperties
}

const CORNER_SIZE = 12
const TOUCH_SIZE = 44

export function CropPreviewComponent({
  imageDataUrl,
  onCropChange,
  onRetake,
  className = '',
  previewStyle,
}: CropPreviewComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  const [rotation, setRotation] = useState(0)
  
  const haptics = useCameraHaptics({ enabled: true, autoDetect: true })

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
      const maxWidth = containerRect.width - 20
      const maxHeight = containerRect.height - 20
      
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
      console.error('Failed to load image for crop preview')
    }
    
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Initialize corners with smart document detection
  useEffect(() => {
    if (!imageLoaded) return

    const canvas = canvasRef.current
    if (!canvas) return
    
    // Default corners with slight inset for document-like appearance
    const padding = 20
    const defaultCorners: Point[] = [
      { x: padding, y: padding }, // Top-left
      { x: canvas.width - padding, y: padding }, // Top-right
      { x: canvas.width - padding, y: canvas.height - padding }, // Bottom-right
      { x: padding, y: canvas.height - padding } // Bottom-left
    ]

    setCorners(defaultCorners)
  }, [imageLoaded])

  // Redraw canvas when corners or rotation change
  useEffect(() => {
    if (!imageLoaded || corners.length !== 4) return
    drawCanvas()
  }, [corners, imageLoaded, rotation])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Save context for transformations
    ctx.save()
    
    // Apply rotation from center
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    ctx.translate(centerX, centerY)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-centerX, -centerY)
    
    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    
    // Restore context
    ctx.restore()
    
    if (corners.length === 4) {
      // Draw semi-transparent overlay outside crop area
      ctx.save()
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
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
      
      // Draw crop outline - thin white line like in the screenshot
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()
      ctx.stroke()
      
      // Draw corner handles - white circles like in the screenshot
      corners.forEach((corner, index) => {
        const isActive = dragState?.cornerIndex === index
        
        // Outer circle (white)
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(corner.x, corner.y, CORNER_SIZE, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Inner circle for active state
        if (isActive) {
          ctx.fillStyle = '#90c639'
          ctx.beginPath()
          ctx.arc(corner.x, corner.y, CORNER_SIZE - 3, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }
  }, [corners, dragState, rotation])

  // Notify parent of crop changes
  useEffect(() => {
    if (corners.length !== 4 || !onCropChange) return
    
    // Convert to image coordinates, accounting for rotation
    const canvas = canvasRef.current
    if (!canvas) return
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    // Apply inverse rotation to get original image coordinates
    const imageCorners = corners.map(corner => {
      // Translate to origin
      let x = corner.x - centerX
      let y = corner.y - centerY
      
      // Apply inverse rotation
      const rad = (-rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const rotatedX = x * cos - y * sin
      const rotatedY = x * sin + y * cos
      
      // Translate back and convert to image coordinates
      return {
        x: (rotatedX + centerX) / canvasScale.x,
        y: (rotatedY + centerY) / canvasScale.y
      }
    })
    
    // Calculate bounding box
    const minX = Math.min(...imageCorners.map(p => p.x))
    const maxX = Math.max(...imageCorners.map(p => p.x))
    const minY = Math.min(...imageCorners.map(p => p.y))
    const maxY = Math.max(...imageCorners.map(p => p.y))
    
    onCropChange({
      corners: imageCorners,
      area: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    })
  }, [corners, canvasScale, rotation, onCropChange])

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
      if (distance <= TOUCH_SIZE / 2) {
        return i
      }
    }
    return -1
  }, [corners])

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
      
      await haptics.buttonPressFeedback()
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
    
    await haptics.buttonPressFeedback()
  }, [dragState, haptics])

  // Handle rotation - rotate both image and crop area
  const handleRotate = useCallback(async () => {
    await haptics.buttonPressFeedback()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    // Rotate crop corners by 90 degrees around canvas center
    setCorners(prevCorners => {
      return prevCorners.map(corner => {
        // Translate to origin
        const x = corner.x - centerX
        const y = corner.y - centerY
        
        // Rotate 90 degrees clockwise
        const rotatedX = -y
        const rotatedY = x
        
        // Translate back
        return {
          x: rotatedX + centerX,
          y: rotatedY + centerY
        }
      })
    })
    
    setRotation(prev => (prev + 90) % 360)
  }, [haptics])

  // Handle retake
  const handleRetake = useCallback(async () => {
    await haptics.navigationFeedback()
    if (onRetake) {
      onRetake()
    }
  }, [haptics, onRetake])

  // Reset transformations
  const resetTransformations = useCallback(() => {
    setRotation(0)
  }, [])

  // Reset crop area to default
  const resetCropArea = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const padding = 20
    const defaultCorners: Point[] = [
      { x: padding, y: padding },
      { x: canvas.width - padding, y: padding },
      { x: canvas.width - padding, y: canvas.height - padding },
      { x: padding, y: canvas.height - padding }
    ]
    
    setCorners(defaultCorners)
  }, [])

  // Handle crop reset
  const handleCropReset = useCallback(async () => {
    await haptics.buttonPressFeedback()
    resetCropArea()
  }, [haptics, resetCropArea])

  // Reset all transformations and crop area when image changes
  useEffect(() => {
    if (imageLoaded) {
      resetTransformations()
    }
  }, [imageDataUrl, resetTransformations])

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={containerRef}
        className="w-full aspect-[3/4] flex items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          className="touch-none max-w-full max-h-full rounded-lg shadow-2xl"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{ touchAction: 'none', ...(previewStyle ?? {}) }}
        />
      </div>
      
      {/* Control buttons on the right side like in the screenshot */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3">
        {/* Rotate button */}
        <button
          type="button"
          onClick={handleRotate}
          className="crop-control-button w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white border border-white/20"
        >
          <RotateCw className="w-5 h-5 rotate-animation" style={{ transform: `rotate(${rotation}deg)` }} />
        </button>
        
        {/* Crop Reset button */}
        <button
          type="button"
          onClick={handleCropReset}
          className="crop-control-button w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white border border-white/20"
        >
          <RefreshCw className="w-5 h-5 reset-animation" />
        </button>
      </div>
      
      {/* Bottom thumbnails like in the screenshot */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
        {/* Current image thumbnail */}
        <div className="crop-thumbnail w-16 h-20 bg-white/20 rounded-lg border-2 border-white/40 overflow-hidden">
          <img
            src={imageDataUrl}
            alt="Current scan"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Retake button (dashed border like in screenshot) */}
        <button
          type="button"
          onClick={handleRetake}
          className="retake-button w-16 h-20 bg-black/40 rounded-lg border-white/40 flex items-center justify-center text-white"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>
      
      {/* Instruction text */}
      <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-white/60 text-sm text-center">
        Drag corners to adjust crop area
      </div>
    </div>
  )
}
