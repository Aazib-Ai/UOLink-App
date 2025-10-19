'use client'

declare global {
  interface Window {
    cv: any
  }
}

let cvReady = false
let cvLoadPromise: Promise<void> | null = null

export const loadOpenCV = (): Promise<void> => {
  if (cvReady) return Promise.resolve()
  if (cvLoadPromise) return cvLoadPromise

  cvLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('OpenCV can only be loaded in browser'))
      return
    }

    if (window.cv && window.cv.Mat) {
      cvReady = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
    script.async = true
    
    script.onload = () => {
      if (window.cv && window.cv.Mat) {
        cvReady = true
        resolve()
      } else {
        const checkInterval = setInterval(() => {
          if (window.cv && window.cv.Mat) {
            clearInterval(checkInterval)
            cvReady = true
            resolve()
          }
        }, 100)
        
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('OpenCV loading timeout'))
        }, 10000)
      }
    }
    
    script.onerror = () => reject(new Error('Failed to load OpenCV'))
    document.head.appendChild(script)
  })

  return cvLoadPromise
}

interface Point {
  x: number
  y: number
}

interface ProcessingOptions {
  blurKernel?: number
  gaussianKernel?: number
  cannyLower?: number
  cannyUpper?: number
  contourAreaThreshold?: number
  epsilon?: number
  adaptiveBlockSize?: number
  adaptiveConstant?: number
  morphKernelSize?: number
  dilateIterations?: number
}

interface EnhancedProcessingResult {
  processedDataUrl: string
  detectedCorners: Point[] | null
  confidence: number
  processingTime: number
}

const orderPoints = (points: Point[]): Point[] => {
  const sorted = points.sort((a, b) => a.y - b.y)
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x)
  return [top[0], top[1], bottom[1], bottom[0]]
}

const enhanceImagePreprocessing = (src: any, cv: any, options: ProcessingOptions = {}) => {
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const enhanced = new cv.Mat()
  const thresholded = new cv.Mat()
  const cleaned = new cv.Mat()
  const edges = new cv.Mat()

  const gaussianKernelSize = Math.max(3, ((options.gaussianKernel ?? options.blurKernel ?? 5) | 1))
  const cannyLower = options.cannyLower ?? 50
  const cannyUpper = options.cannyUpper ?? 150
  const adaptiveBlockSize = Math.max(3, ((options.adaptiveBlockSize ?? 11) | 1))
  const adaptiveConstant = options.adaptiveConstant ?? 2
  const morphKernelSize = Math.max(3, ((options.morphKernelSize ?? 5) | 1))
  const dilateIterations = Math.max(0, Math.floor(options.dilateIterations ?? 1))

  // Convert to grayscale to simplify further processing
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

  // Slight Gaussian blur to smooth background texture while keeping page edges
  cv.GaussianBlur(gray, blurred, new cv.Size(gaussianKernelSize, gaussianKernelSize), 0)

  // Contrast-limited adaptive histogram equalization to boost document contrast
  const clahe = new cv.CLAHE()
  clahe.setClipLimit(2.0)
  clahe.setTilesGridSize(new cv.Size(8, 8))
  clahe.apply(blurred, enhanced)
  clahe.delete()

  // Adaptive threshold to separate the bright paper from complex backgrounds
  cv.adaptiveThreshold(
    enhanced,
    thresholded,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    adaptiveBlockSize,
    adaptiveConstant
  )

  // Morphological operations clean up noise and reinforce the page outline
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(morphKernelSize, morphKernelSize))
  cv.morphologyEx(thresholded, cleaned, cv.MORPH_CLOSE, kernel)
  cv.morphologyEx(cleaned, cleaned, cv.MORPH_OPEN, kernel)

  // Edge detection on the cleaned binary image keeps the document prominent
  cv.Canny(cleaned, edges, cannyLower, cannyUpper)

  if (dilateIterations > 0) {
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), dilateIterations)
  }

  kernel.delete()

  return { gray, blurred, enhanced, thresholded, cleaned, edges }
}

const findBestDocumentContour = (contours: any, src: any, cv: any, options: ProcessingOptions = {}) => {
  const { contourAreaThreshold = 0.1, epsilon = 0.02 } = options
  const minArea = src.rows * src.cols * contourAreaThreshold

  const contourCandidates: { index: number; area: number }[] = []
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const area = cv.contourArea(contour)
    contourCandidates.push({ index: i, area })
    contour.delete()
  }

  contourCandidates.sort((a, b) => b.area - a.area)

  let bestContour: any = null
  let bestCorners: Point[] | null = null
  let confidence = 0

  for (const { index, area } of contourCandidates) {
    if (area < minArea) {
      break
    }

    const contour = contours.get(index)
    const peri = cv.arcLength(contour, true)
    const approx = new cv.Mat()
    cv.approxPolyDP(contour, approx, epsilon * peri, true)

    if (approx.rows === 4) {
      const points: Point[] = []
      for (let j = 0; j < 4; j++) {
        points.push({
          x: approx.data32S[j * 2],
          y: approx.data32S[j * 2 + 1]
        })
      }

      const hull = new cv.Mat()
      cv.convexHull(contour, hull)
      const hullArea = cv.contourArea(hull)
      hull.delete()

      const convexity = hullArea > 0 ? area / hullArea : 0
      const areaRatio = area / (src.rows * src.cols)
      const normalizedArea = Math.min(
        1,
        areaRatio / Math.max(contourAreaThreshold * 1.5, 0.02)
      )
      const confidenceScore = Math.min(1, convexity * 0.6 + normalizedArea * 0.4)

      const rect = cv.boundingRect(approx)
      const aspectRatio = rect.height === 0 ? 0 : rect.width / rect.height
      const aspectValid = aspectRatio > 0.3 && aspectRatio < 3.5

      if (convexity > 0.85 && aspectValid) {
        bestContour = approx
        bestCorners = points
        confidence = confidenceScore
        contour.delete()
        break
      }
    }

    approx.delete()
    contour.delete()
  }

  return { contour: bestContour, corners: bestCorners, confidence }
}

const applyPerspectiveTransform = (src: any, corners: Point[], cv: any): string => {
  const ordered = orderPoints(corners)
  const [tl, tr, br, bl] = ordered

  // Calculate the dimensions of the transformed image
  const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2))
  const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2))
  const maxWidth = Math.max(widthA, widthB)

  const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2))
  const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2))
  const maxHeight = Math.max(heightA, heightB)

  // Ensure minimum size for the output
  const outputWidth = Math.max(maxWidth, 300)
  const outputHeight = Math.max(maxHeight, 400)

  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y,
    tr.x, tr.y,
    br.x, br.y,
    bl.x, bl.y
  ])

  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    outputWidth, 0,
    outputWidth, outputHeight,
    0, outputHeight
  ])

  const M = cv.getPerspectiveTransform(srcPoints, dstPoints)
  const warped = new cv.Mat()
  cv.warpPerspective(src, warped, M, new cv.Size(outputWidth, outputHeight))

  // Post-processing to improve quality
  const enhanced = new cv.Mat()
  cv.bilateralFilter(warped, enhanced, 5, 80, 80)

  const canvas = document.createElement('canvas')
  cv.imshow(canvas, enhanced)
  const result = canvas.toDataURL('image/jpeg', 0.95)

  srcPoints.delete()
  dstPoints.delete()
  M.delete()
  warped.delete()
  enhanced.delete()

  return result
}

export const detectDocument = async (dataUrl: string): Promise<string> => {
  await loadOpenCV()
  const cv = window.cv

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      let src: any = null
      let gray: any = null
      let blurred: any = null
      let enhanced: any = null
      let thresholded: any = null
      let cleaned: any = null
      let edges: any = null
      let contours: any = null
      let hierarchy: any = null

      try {
        src = cv.imread(img)

        // Use enhanced preprocessing
        const processed = enhanceImagePreprocessing(src, cv)
        gray = processed.gray
        blurred = processed.blurred
        enhanced = processed.enhanced
        thresholded = processed.thresholded
        cleaned = processed.cleaned
        edges = processed.edges

        contours = new cv.MatVector()
        hierarchy = new cv.Mat()
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

        const { contour: bestContour, corners, confidence } = findBestDocumentContour(contours, src, cv)

        if (bestContour && corners && confidence > 0.3) {
          const result = applyPerspectiveTransform(src, corners, cv)
          bestContour.delete()
          resolve(result)
        } else {
          // Fallback to original image if no good document found
          const canvas = document.createElement('canvas')
          cv.imshow(canvas, src)
          resolve(canvas.toDataURL('image/jpeg', 0.92))
        }
      } catch (error) {
        console.error('OpenCV processing error:', error)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      } finally {
        if (src) src.delete()
        if (gray) gray.delete()
        if (blurred) blurred.delete()
        if (enhanced) enhanced.delete()
        if (thresholded) thresholded.delete()
        if (cleaned) cleaned.delete()
        if (edges) edges.delete()
        if (contours) contours.delete()
        if (hierarchy) hierarchy.delete()
      }
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

export const processDocumentAdvanced = async (
  dataUrl: string,
  options: ProcessingOptions = {}
): Promise<EnhancedProcessingResult> => {
  const startTime = performance.now()
  await loadOpenCV()
  const cv = window.cv

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      let src: any = null
      let processed: any = null
      let contours: any = null
      let hierarchy: any = null

      try {
        src = cv.imread(img)

        // Enhanced preprocessing
        processed = enhanceImagePreprocessing(src, cv, options)

        contours = new cv.MatVector()
        hierarchy = new cv.Mat()
        cv.findContours(processed.edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

        const { contour: bestContour, corners, confidence } = findBestDocumentContour(
          contours,
          src,
          cv,
          options
        )

        const processingTime = performance.now() - startTime

        if (bestContour && corners && confidence > 0.3) {
          const processedDataUrl = applyPerspectiveTransform(src, corners, cv)
          bestContour.delete()

          resolve({
            processedDataUrl,
            detectedCorners: corners,
            confidence,
            processingTime
          })
        } else {
          // Return original image with metadata
          const canvas = document.createElement('canvas')
          cv.imshow(canvas, src)
          const processedDataUrl = canvas.toDataURL('image/jpeg', 0.92)

          resolve({
            processedDataUrl,
            detectedCorners: null,
            confidence: 0,
            processingTime
          })
        }
      } catch (error) {
        console.error('Advanced document processing error:', error)
        const processingTime = performance.now() - startTime

        // Fallback to original image
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0)

        resolve({
          processedDataUrl: canvas.toDataURL('image/jpeg', 0.92),
          detectedCorners: null,
          confidence: 0,
          processingTime
        })
      } finally {
        if (src) src.delete()
        if (processed) {
          if (processed.gray) processed.gray.delete()
          if (processed.blurred) processed.blurred.delete()
          if (processed.enhanced) processed.enhanced.delete()
          if (processed.thresholded) processed.thresholded.delete()
          if (processed.cleaned) processed.cleaned.delete()
          if (processed.edges) processed.edges.delete()
        }
        if (contours) contours.delete()
        if (hierarchy) hierarchy.delete()
      }
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

// Real-time video processing for live preview
export interface LiveDetectionResult {
  corners: Point[] | null
  confidence: number
  frameTime: number
}

const createOptimizedProcessingOptions = (): ProcessingOptions => ({
  blurKernel: 3, // Smaller kernel for faster processing
  cannyLower: 30,
  cannyUpper: 100,
  contourAreaThreshold: 0.05, // Lower threshold for better detection
  epsilon: 0.03,
  adaptiveBlockSize: 15,
  adaptiveConstant: 4,
  morphKernelSize: 5,
  dilateIterations: 1
})

export const detectDocumentFromVideo = async (
  videoElement: HTMLVideoElement,
  cv: any
): Promise<LiveDetectionResult> => {
  const startTime = performance.now()

  if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    return { corners: null, confidence: 0, frameTime: 0 }
  }

  try {
    // Create a small canvas for video frame capture
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { corners: null, confidence: 0, frameTime: 0 }
    }

    // Downscale for performance (process at 480p max)
    const maxDimension = 480
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight

    if (aspectRatio > 1) {
      canvas.width = maxDimension
      canvas.height = maxDimension / aspectRatio
    } else {
      canvas.height = maxDimension
      canvas.width = maxDimension * aspectRatio
    }

    // Draw current video frame to canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

    // Process frame with OpenCV
    let src: any = null
    let processed: any = null
    let contours: any = null
    let hierarchy: any = null

    try {
      src = cv.imread(canvas)

      // Use optimized processing for real-time
      const optimizedOptions = createOptimizedProcessingOptions()
      const processedData = enhanceImagePreprocessing(src, cv, optimizedOptions)
      processed = processedData

      contours = new cv.MatVector()
      hierarchy = new cv.Mat()
      cv.findContours(processed.edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

      const { corners, confidence } = findBestDocumentContour(
        contours,
        src,
        cv,
        optimizedOptions
      )

      const frameTime = performance.now() - startTime

      // Scale corners back to original video dimensions
      if (corners && confidence > 0.15) {
        const scaleX = videoElement.videoWidth / canvas.width
        const scaleY = videoElement.videoHeight / canvas.height

        const scaledCorners = corners.map(point => ({
          x: point.x * scaleX,
          y: point.y * scaleY
        }))

        return {
          corners: scaledCorners,
          confidence,
          frameTime
        }
      }

      return {
        corners: null,
        confidence: 0,
        frameTime
      }
    } finally {
      if (src) src.delete()
      if (processed) {
        if (processed.gray) processed.gray.delete()
        if (processed.blurred) processed.blurred.delete()
        if (processed.enhanced) processed.enhanced.delete()
        if (processed.thresholded) processed.thresholded.delete()
        if (processed.cleaned) processed.cleaned.delete()
        if (processed.edges) processed.edges.delete()
      }
      if (contours) contours.delete()
      if (hierarchy) hierarchy.delete()
    }
  } catch (error) {
    console.error('Live detection error:', error)
    return {
      corners: null,
      confidence: 0,
      frameTime: performance.now() - startTime
    }
  }
}

export class LiveDocumentDetector {
  private isRunning = false
  private animationId: number | null = null
  private videoElement: HTMLVideoElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private lastDetectionTime = 0
  private detectionInterval = 100 // ms between detections (10 FPS)
  private smoothingFactor = 0.3
  private smoothedCorners: Point[] | null = null
  private lastDetectionResult: LiveDetectionResult | null = null
  private isDestroyed = false
  private startToken: symbol | null = null

  constructor(
    private onDetectionUpdate: (result: LiveDetectionResult) => void,
    private targetFPS: number = 10
  ) {
    this.detectionInterval = 1000 / targetFPS
  }

  async start(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) {
    if (this.isDestroyed) return

    const startToken = Symbol('live-detector-start')
    this.startToken = startToken

    await loadOpenCV()
    if (this.startToken !== startToken || this.isDestroyed) {
      return
    }

    const cv = window.cv
    if (!cv) {
      console.error('OpenCV not loaded')
      return
    }

    this.videoElement = videoElement
    this.canvasElement = canvasElement
    this.ctx = canvasElement.getContext('2d')
    if (!this.ctx) {
      console.warn('[LiveDocumentDetector] Unable to acquire 2D context for overlay canvas')
      this.videoElement = null
      this.canvasElement = null
      this.startToken = null
      return
    }
    this.isRunning = true
    this.startToken = startToken

    // Set canvas size to match video display size
    this.updateCanvasSize()
    this.clearCanvas()

    this.processFrame()
  }

  stop() {
    if (this.isDestroyed) return

    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.clearCanvas()
    this.startToken = null

    // Clear references to help garbage collection
    this.videoElement = null
    this.canvasElement = null
    this.ctx = null
    this.smoothedCorners = null
    this.lastDetectionResult = null
  }

  destroy() {
    this.stop()
    this.isDestroyed = true
  }

  private updateCanvasSize() {
    if (!this.videoElement || !this.canvasElement) return

    const rect = this.videoElement.getBoundingClientRect()
    const width = Math.max(Math.round(rect.width), 1)
    const height = Math.max(Math.round(rect.height), 1)

    if (this.canvasElement.width !== width || this.canvasElement.height !== height) {
      this.canvasElement.width = width
      this.canvasElement.height = height
    }

    this.canvasElement.style.width = `${rect.width}px`
    this.canvasElement.style.height = `${rect.height}px`
  }

  private clearCanvas() {
    if (!this.ctx || !this.canvasElement) return
    this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)
  }

  private smoothCorners(newCorners: Point[]): Point[] {
    if (!this.smoothedCorners) {
      this.smoothedCorners = [...newCorners]
      return this.smoothedCorners
    }

    this.smoothedCorners = this.smoothedCorners.map((corner, index) => ({
      x: corner.x * (1 - this.smoothingFactor) + newCorners[index].x * this.smoothingFactor,
      y: corner.y * (1 - this.smoothingFactor) + newCorners[index].y * this.smoothingFactor
    }))

    return this.smoothedCorners
  }

  private async processFrame() {
    if (!this.isRunning || this.isDestroyed || !this.videoElement || !this.ctx) return

    this.updateCanvasSize()

    const now = performance.now()

    // Process at target interval
    if (now - this.lastDetectionTime >= this.detectionInterval) {
      this.lastDetectionTime = now

      const cv = window.cv
      if (cv && this.videoElement.readyState >= 2) {
        const result = await detectDocumentFromVideo(this.videoElement, cv)

        if (!this.isRunning || this.isDestroyed || !this.canvasElement || !this.ctx) {
          return
        }

        // Apply smoothing to corner positions
        let cornersToRender = result.corners
        if (result.corners && result.confidence > 0.15) {
          cornersToRender = this.smoothCorners(result.corners)
        }

        const renderedResult: LiveDetectionResult = {
          ...result,
          corners: cornersToRender,
        }

        this.lastDetectionResult = renderedResult
        this.renderDetection(renderedResult)
        this.onDetectionUpdate(renderedResult)
      }
    }

    // Only request next frame if still running and not destroyed
    if (this.isRunning && !this.isDestroyed) {
      this.animationId = requestAnimationFrame(() => this.processFrame())
    }
  }

  private renderDetection(result: LiveDetectionResult) {
    if (!this.ctx || !this.canvasElement) return

    this.clearCanvas()

    if (result.corners && result.confidence > 0.15) {
      // Convert video coordinates to canvas coordinates
      const video = this.videoElement!
      const canvasWidth = this.canvasElement.width
      const canvasHeight = this.canvasElement.height

      const scaleX = canvasWidth / video.videoWidth
      const scaleY = canvasHeight / video.videoHeight

      const canvasCorners = result.corners.map(point => ({
        x: point.x * scaleX,
        y: point.y * scaleY
      }))

      this.drawDocumentOutline(canvasCorners, result.confidence)
    }
  }

  private drawDocumentOutline(corners: Point[], confidence: number) {
    if (!this.ctx) return

    const ctx = this.ctx
    ctx.save()

    // Set line style based on confidence
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Color gradient based on confidence
    const hue = confidence * 120 // From red (0) to green (120)
    ctx.strokeStyle = `hsla(${hue}, 70%, 50%, 0.8)`
    ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.1)`

    // Draw the outline
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y)
    }
    ctx.closePath()

    // Fill and stroke
    ctx.fill()
    ctx.stroke()

    // Draw corner circles
    corners.forEach(corner => {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.9)`
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    ctx.restore()
  }

  getLastDetectionResult(): LiveDetectionResult | null {
    return this.lastDetectionResult
  }
}
