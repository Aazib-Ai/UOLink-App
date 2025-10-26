'use client'

/**
 * Mobile device detection utility for scanner optimization
 * Provides comprehensive device detection for mobile-specific features
 */

export interface TouchCapabilities {
    supportsPinchZoom: boolean
    supportsMultiTouch: boolean
    hasHapticFeedback: boolean
}

export interface ViewportInfo {
    width: number
    height: number
    isPortrait: boolean
    devicePixelRatio: number
}

export interface MobileDetectionResult {
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
    platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'
    browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'unknown'
    touchCapabilities: TouchCapabilities
    viewport: ViewportInfo
    shouldDisableEdgeDetection: boolean
    shouldOptimizeForMobile: boolean
}

/**
 * Detects if the current device is a mobile device
 */
export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false

    // Check user agent for mobile indicators
    const userAgent = navigator.userAgent.toLowerCase()
    const mobileKeywords = [
        'mobile', 'android', 'iphone', 'ipad', 'ipod',
        'blackberry', 'windows phone', 'opera mini'
    ]

    const hasMobileKeyword = mobileKeywords.some(keyword =>
        userAgent.includes(keyword)
    )

    // Check for touch capability
    const hasTouch = 'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0

    // Check viewport size (mobile-like dimensions)
    const viewport = getViewportInfo()
    const isMobileViewport = viewport.width <= 768 ||
        (viewport.isPortrait && viewport.width <= 1024)

    return hasMobileKeyword || (hasTouch && isMobileViewport)
}

/**
 * Detects if the current device is a tablet
 */
export function isTabletDevice(): boolean {
    if (typeof window === 'undefined') return false

    const userAgent = navigator.userAgent.toLowerCase()
    const viewport = getViewportInfo()

    // iPad detection
    const isIpad = userAgent.includes('ipad') ||
        (userAgent.includes('macintosh') && navigator.maxTouchPoints > 1)

    // Android tablet detection
    const isAndroidTablet = userAgent.includes('android') &&
        !userAgent.includes('mobile')

    // Size-based tablet detection
    const isTabletSize = viewport.width >= 768 && viewport.width <= 1024

    return isIpad || isAndroidTablet ||
        (isTabletSize && 'ontouchstart' in window)
}

/**
 * Gets detailed platform information
 */
export function getPlatform(): MobileDetectionResult['platform'] {
    if (typeof window === 'undefined') return 'unknown'

    const userAgent = navigator.userAgent.toLowerCase()

    if (userAgent.includes('iphone') || userAgent.includes('ipad') ||
        userAgent.includes('ipod') ||
        (userAgent.includes('macintosh') && navigator.maxTouchPoints > 1)) {
        return 'ios'
    }

    if (userAgent.includes('android')) {
        return 'android'
    }

    if (userAgent.includes('windows')) {
        return 'windows'
    }

    if (userAgent.includes('macintosh') || userAgent.includes('mac os')) {
        return 'macos'
    }

    if (userAgent.includes('linux')) {
        return 'linux'
    }

    return 'unknown'
}

/**
 * Gets browser information
 */
export function getBrowser(): MobileDetectionResult['browser'] {
    if (typeof window === 'undefined') return 'unknown'

    const userAgent = navigator.userAgent.toLowerCase()

    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        return 'safari'
    }

    if (userAgent.includes('chrome')) {
        return 'chrome'
    }

    if (userAgent.includes('firefox')) {
        return 'firefox'
    }

    if (userAgent.includes('edge')) {
        return 'edge'
    }

    return 'unknown'
}

/**
 * Analyzes touch capabilities of the device
 */
export function getTouchCapabilities(): TouchCapabilities {
    if (typeof window === 'undefined') {
        return {
            supportsPinchZoom: false,
            supportsMultiTouch: false,
            hasHapticFeedback: false
        }
    }

    const hasTouch = 'ontouchstart' in window
    const maxTouchPoints = navigator.maxTouchPoints || 0

    return {
        supportsPinchZoom: hasTouch && maxTouchPoints >= 2,
        supportsMultiTouch: maxTouchPoints > 1,
        hasHapticFeedback: 'vibrate' in navigator
    }
}

/**
 * Gets current viewport information
 */
export function getViewportInfo(): ViewportInfo {
    if (typeof window === 'undefined') {
        return {
            width: 0,
            height: 0,
            isPortrait: false,
            devicePixelRatio: 1
        }
    }

    const width = window.innerWidth
    const height = window.innerHeight

    return {
        width,
        height,
        isPortrait: height > width,
        devicePixelRatio: window.devicePixelRatio || 1
    }
}

/**
 * Determines if edge detection should be disabled
 * Based on mobile device detection and known problematic platforms
 */
export function shouldDisableEdgeDetection(): boolean {
    const mobile = isMobileDevice()
    const platform = getPlatform()
    const browser = getBrowser()

    // Disable edge detection on all mobile devices
    if (mobile) return true

    // Disable on Safari (known issues with WebGL/OpenCV)
    if (browser === 'safari') return true

    // Disable on iOS devices (including iPad)
    if (platform === 'ios') return true

    return false
}

/**
 * Determines if mobile optimizations should be applied
 */
export function shouldOptimizeForMobile(): boolean {
    const mobile = isMobileDevice()
    const tablet = isTabletDevice()
    const viewport = getViewportInfo()

    // Apply mobile optimizations for mobile devices
    if (mobile) return true

    // Apply mobile optimizations for tablets in portrait mode
    if (tablet && viewport.isPortrait) return true

    // Apply mobile optimizations for small viewports with touch
    const hasTouch = getTouchCapabilities().supportsMultiTouch
    if (hasTouch && viewport.width <= 768) return true

    return false
}

/**
 * Comprehensive mobile detection with all relevant information
 */
export function detectMobileDevice(): MobileDetectionResult {
    const mobile = isMobileDevice()
    const tablet = isTabletDevice()
    const platform = getPlatform()
    const browser = getBrowser()
    const touchCapabilities = getTouchCapabilities()
    const viewport = getViewportInfo()

    return {
        isMobile: mobile,
        isTablet: tablet,
        isDesktop: !mobile && !tablet,
        platform,
        browser,
        touchCapabilities,
        viewport,
        shouldDisableEdgeDetection: shouldDisableEdgeDetection(),
        shouldOptimizeForMobile: shouldOptimizeForMobile()
    }
}

/**
 * Hook-like function for reactive mobile detection
 * Can be used in React components with useEffect for updates
 */
export function createMobileDetectionListener(
    callback: (result: MobileDetectionResult) => void
): () => void {
    if (typeof window === 'undefined') {
        return () => { }
    }

    const handleResize = () => {
        callback(detectMobileDevice())
    }

    const handleOrientationChange = () => {
        // Delay to allow viewport to update
        setTimeout(() => {
            callback(detectMobileDevice())
        }, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)

    // Initial detection
    handleResize()

    // Return cleanup function
    return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('orientationchange', handleOrientationChange)
    }
}