interface ImageOptimizationConfig {
    quality: number
    format: 'webp' | 'avif' | 'jpeg' | 'png'
    width?: number
    height?: number
    devicePixelRatio?: number
}

interface ConnectionInfo {
    effectiveType?: '2g' | '3g' | '4g' | 'slow-2g'
    downlink?: number
    saveData?: boolean
}

// Get network connection information
export function getConnectionInfo(): ConnectionInfo {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
        return {}
    }

    const connection = (navigator as any).connection
    return {
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        saveData: connection?.saveData
    }
}

// Determine optimal image quality based on connection
export function getOptimalQuality(baseQuality: number = 75): number {
    const connection = getConnectionInfo()

    if (connection.saveData) {
        return Math.min(baseQuality, 40)
    }

    switch (connection.effectiveType) {
        case 'slow-2g':
            return Math.min(baseQuality, 30)
        case '2g':
            return Math.min(baseQuality, 50)
        case '3g':
            return Math.min(baseQuality, 65)
        case '4g':
        default:
            return baseQuality
    }
}

// Generate responsive image sizes
export function generateResponsiveSizes(
    baseWidth: number,
    aspectRatio: number = 16 / 9
): string {
    const breakpoints = [640, 768, 1024, 1280, 1536]
    const sizes = []

    for (let i = 0; i < breakpoints.length; i++) {
        const breakpoint = breakpoints[i]
        const nextBreakpoint = breakpoints[i + 1]

        let width = Math.min(baseWidth, breakpoint)

        if (nextBreakpoint) {
            sizes.push(`(max-width: ${breakpoint}px) ${width}px`)
        } else {
            sizes.push(`${width}px`)
        }
    }

    return sizes.join(', ')
}

// Optimize image URL for mobile delivery
export function optimizeImageUrl(
    originalUrl: string,
    config: Partial<ImageOptimizationConfig> = {}
): string {
    const {
        quality = getOptimalQuality(),
        format = 'webp',
        width,
        height
    } = config

    // Handle Google Drive URLs
    if (originalUrl.includes('drive.google.com')) {
        const fileIdMatch = originalUrl.match(/\/d\/([^/]+)/) || originalUrl.match(/id=([^&]+)/)
        if (fileIdMatch?.[1]) {
            const size = width ? `w${width}` : 'w1200'
            return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=${size}`
        }
    }

    // For other URLs, return as-is (Next.js Image will handle optimization)
    return originalUrl
}

// Check if browser supports modern image formats
export function getSupportedImageFormat(): 'avif' | 'webp' | 'jpeg' {
    if (typeof window === 'undefined') {
        return 'webp' // Default for SSR
    }

    // Check AVIF support
    const avifCanvas = document.createElement('canvas')
    avifCanvas.width = 1
    avifCanvas.height = 1
    if (avifCanvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
        return 'avif'
    }

    // Check WebP support
    const webpCanvas = document.createElement('canvas')
    webpCanvas.width = 1
    webpCanvas.height = 1
    if (webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        return 'webp'
    }

    return 'jpeg'
}