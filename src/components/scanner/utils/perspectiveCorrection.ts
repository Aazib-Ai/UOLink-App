'use client'

import { loadOpenCV } from '../opencvUtils'

export interface Point {
    x: number
    y: number
}

export interface PerspectiveCorrectionResult {
    success: boolean
    correctedImageUrl: string | null
    error?: string
}

/**
 * Apply perspective correction to an image using manually selected corner points
 */
export async function applyManualPerspectiveCorrection(
    imageDataUrl: string,
    corners: Point[]
): Promise<PerspectiveCorrectionResult> {
    if (corners.length !== 4) {
        return {
            success: false,
            correctedImageUrl: null,
            error: 'Exactly 4 corner points are required'
        }
    }

    try {
        await loadOpenCV()
        const cv = window.cv

        if (!cv) {
            throw new Error('OpenCV not available')
        }

        return new Promise((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'

            img.onload = () => {
                let src: any = null
                let srcPoints: any = null
                let dstPoints: any = null
                let M: any = null
                let warped: any = null
                let enhanced: any = null

                try {
                    src = cv.imread(img)

                    // Order corners: top-left, top-right, bottom-right, bottom-left
                    const orderedCorners = orderCorners(corners)

                    // Calculate output dimensions based on the perspective-corrected rectangle
                    const width1 = calculateDistance(orderedCorners[0], orderedCorners[1])
                    const width2 = calculateDistance(orderedCorners[3], orderedCorners[2])
                    const height1 = calculateDistance(orderedCorners[0], orderedCorners[3])
                    const height2 = calculateDistance(orderedCorners[1], orderedCorners[2])

                    const outputWidth = Math.max(width1, width2)
                    const outputHeight = Math.max(height1, height2)

                    // Ensure minimum output size
                    const minWidth = 300
                    const minHeight = 400
                    const finalWidth = Math.max(outputWidth, minWidth)
                    const finalHeight = Math.max(outputHeight, minHeight)

                    // Create source points matrix (from manual selection)
                    srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
                        orderedCorners[0].x, orderedCorners[0].y,  // top-left
                        orderedCorners[1].x, orderedCorners[1].y,  // top-right
                        orderedCorners[2].x, orderedCorners[2].y,  // bottom-right
                        orderedCorners[3].x, orderedCorners[3].y   // bottom-left
                    ])

                    // Create destination points matrix (perfect rectangle)
                    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
                        0, 0,                    // top-left
                        finalWidth, 0,           // top-right
                        finalWidth, finalHeight, // bottom-right
                        0, finalHeight           // bottom-left
                    ])

                    // Calculate perspective transformation matrix
                    M = cv.getPerspectiveTransform(srcPoints, dstPoints)

                    // Apply perspective transformation
                    warped = new cv.Mat()
                    cv.warpPerspective(
                        src,
                        warped,
                        M,
                        new cv.Size(finalWidth, finalHeight),
                        cv.INTER_LINEAR,
                        cv.BORDER_CONSTANT,
                        new cv.Scalar(255, 255, 255, 255)
                    )

                    // Post-processing to enhance the corrected image
                    enhanced = new cv.Mat()

                    // Apply bilateral filter to reduce noise while preserving edges
                    cv.bilateralFilter(warped, enhanced, 9, 75, 75)

                    // Convert result to canvas and get data URL
                    const canvas = document.createElement('canvas')
                    cv.imshow(canvas, enhanced)
                    const correctedImageUrl = canvas.toDataURL('image/jpeg', 0.95)

                    resolve({
                        success: true,
                        correctedImageUrl
                    })

                } catch (error) {
                    console.error('Perspective correction error:', error)

                    // Fallback: return original image
                    const canvas = document.createElement('canvas')
                    canvas.width = img.width
                    canvas.height = img.height
                    const ctx = canvas.getContext('2d')
                    if (ctx) {
                        ctx.drawImage(img, 0, 0)
                    }

                    resolve({
                        success: false,
                        correctedImageUrl: canvas.toDataURL('image/jpeg', 0.92),
                        error: 'Perspective correction failed, returning original image'
                    })
                } finally {
                    // Clean up OpenCV matrices
                    if (src) src.delete()
                    if (srcPoints) srcPoints.delete()
                    if (dstPoints) dstPoints.delete()
                    if (M) M.delete()
                    if (warped) warped.delete()
                    if (enhanced) enhanced.delete()
                }
            }

            img.onerror = () => {
                resolve({
                    success: false,
                    correctedImageUrl: null,
                    error: 'Failed to load image'
                })
            }

            img.src = imageDataUrl
        })

    } catch (error) {
        console.error('OpenCV loading error:', error)
        return {
            success: false,
            correctedImageUrl: null,
            error: 'Failed to load OpenCV'
        }
    }
}

/**
 * Order corner points in clockwise order starting from top-left
 */
function orderCorners(points: Point[]): Point[] {
    if (points.length !== 4) {
        throw new Error('Exactly 4 points required')
    }

    // Calculate centroid
    const centroid = {
        x: points.reduce((sum, p) => sum + p.x, 0) / 4,
        y: points.reduce((sum, p) => sum + p.y, 0) / 4
    }

    // Sort points by angle from centroid
    const sortedPoints = points.map(point => ({
        point,
        angle: Math.atan2(point.y - centroid.y, point.x - centroid.x)
    })).sort((a, b) => a.angle - b.angle)

    // Find the top-left point (smallest sum of coordinates)
    let topLeftIndex = 0
    let minSum = Infinity

    sortedPoints.forEach((item, index) => {
        const sum = item.point.x + item.point.y
        if (sum < minSum) {
            minSum = sum
            topLeftIndex = index
        }
    })

    // Reorder starting from top-left, going clockwise
    const orderedPoints: Point[] = []
    for (let i = 0; i < 4; i++) {
        const index = (topLeftIndex + i) % 4
        orderedPoints.push(sortedPoints[index].point)
    }

    return orderedPoints
}

/**
 * Calculate Euclidean distance between two points
 */
function calculateDistance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

/**
 * Validate that the four corners form a reasonable quadrilateral
 */
export function validateCropCorners(corners: Point[]): {
    isValid: boolean
    issues: string[]
} {
    const issues: string[] = []

    if (corners.length !== 4) {
        issues.push('Exactly 4 corners are required')
        return { isValid: false, issues }
    }

    // Check for minimum area
    const area = calculateQuadrilateralArea(corners)
    if (area < 1000) { // Minimum area threshold
        issues.push('Selected area is too small')
    }

    // Check for reasonable aspect ratio
    const orderedCorners = orderCorners(corners)
    const width1 = calculateDistance(orderedCorners[0], orderedCorners[1])
    const width2 = calculateDistance(orderedCorners[3], orderedCorners[2])
    const height1 = calculateDistance(orderedCorners[0], orderedCorners[3])
    const height2 = calculateDistance(orderedCorners[1], orderedCorners[2])

    const avgWidth = (width1 + width2) / 2
    const avgHeight = (height1 + height2) / 2
    const aspectRatio = avgWidth / avgHeight

    if (aspectRatio < 0.1 || aspectRatio > 10) {
        issues.push('Aspect ratio is too extreme')
    }

    // Check for self-intersecting quadrilateral
    if (isQuadrilateralSelfIntersecting(orderedCorners)) {
        issues.push('Selected area forms a self-intersecting shape')
    }

    return {
        isValid: issues.length === 0,
        issues
    }
}

/**
 * Calculate the area of a quadrilateral using the shoelace formula
 */
function calculateQuadrilateralArea(corners: Point[]): number {
    if (corners.length !== 4) return 0

    let area = 0
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        area += corners[i].x * corners[j].y
        area -= corners[j].x * corners[i].y
    }
    return Math.abs(area) / 2
}

/**
 * Check if a quadrilateral is self-intersecting
 */
function isQuadrilateralSelfIntersecting(corners: Point[]): boolean {
    if (corners.length !== 4) return true

    // Check if any two non-adjacent edges intersect
    const edges = [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]]
    ]

    for (let i = 0; i < 4; i++) {
        for (let j = i + 2; j < 4; j++) {
            if (j === 3 && i === 0) continue // Adjacent edges

            if (doLinesIntersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1])) {
                return true
            }
        }
    }

    return false
}

/**
 * Check if two line segments intersect
 */
function doLinesIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
    const orientation = (p: Point, q: Point, r: Point): number => {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
        if (val === 0) return 0 // Collinear
        return val > 0 ? 1 : 2 // Clockwise or counterclockwise
    }

    const onSegment = (p: Point, q: Point, r: Point): boolean => {
        return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
            q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)
    }

    const o1 = orientation(p1, q1, p2)
    const o2 = orientation(p1, q1, q2)
    const o3 = orientation(p2, q2, p1)
    const o4 = orientation(p2, q2, q1)

    // General case
    if (o1 !== o2 && o3 !== o4) return true

    // Special cases
    if (o1 === 0 && onSegment(p1, p2, q1)) return true
    if (o2 === 0 && onSegment(p1, q2, q1)) return true
    if (o3 === 0 && onSegment(p2, p1, q2)) return true
    if (o4 === 0 && onSegment(p2, q1, q2)) return true

    return false
}