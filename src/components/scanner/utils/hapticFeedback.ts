/**
 * Haptic Feedback Utility for Mobile Scanner
 * Provides tactile feedback for user interactions with fallback support
 */

export interface HapticFeedbackOptions {
    pattern?: number | number[]
    duration?: number
    intensity?: 'light' | 'medium' | 'heavy'
}

export interface HapticCapabilities {
    isSupported: boolean
    hasVibrationAPI: boolean
    hasHapticActuator: boolean
    supportedPatterns: string[]
}

class HapticFeedbackManager {
    private isSupported: boolean = false
    private hasVibrationAPI: boolean = false
    private hasHapticActuator: boolean = false
    private isEnabled: boolean = true

    constructor() {
        this.detectCapabilities()
    }

    /**
     * Detect device haptic capabilities
     */
    private detectCapabilities(): void {
        // Check for Vibration API support
        this.hasVibrationAPI = 'vibrate' in navigator

        // Check for Haptic Actuator API (experimental)
        this.hasHapticActuator = 'getGamepads' in navigator &&
            navigator.getGamepads().some(gamepad =>
                gamepad && 'hapticActuators' in gamepad
            )

        // Overall support check
        this.isSupported = this.hasVibrationAPI || this.hasHapticActuator

        console.log('[HapticFeedback] Capabilities detected:', {
            isSupported: this.isSupported,
            hasVibrationAPI: this.hasVibrationAPI,
            hasHapticActuator: this.hasHapticActuator
        })
    }

    /**
     * Get haptic capabilities information
     */
    getCapabilities(): HapticCapabilities {
        return {
            isSupported: this.isSupported,
            hasVibrationAPI: this.hasVibrationAPI,
            hasHapticActuator: this.hasHapticActuator,
            supportedPatterns: this.getSupportedPatterns()
        }
    }

    /**
     * Get list of supported haptic patterns
     */
    private getSupportedPatterns(): string[] {
        const patterns: string[] = []

        if (this.hasVibrationAPI) {
            patterns.push('tap', 'double-tap', 'success', 'error', 'warning', 'capture')
        }

        return patterns
    }

    /**
     * Enable or disable haptic feedback
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled
        console.log('[HapticFeedback] Haptic feedback', enabled ? 'enabled' : 'disabled')
    }

    /**
     * Check if haptic feedback is enabled
     */
    isHapticEnabled(): boolean {
        return this.isEnabled && this.isSupported
    }

    /**
     * Trigger haptic feedback with specified pattern
     */
    async triggerHaptic(pattern: string, options: HapticFeedbackOptions = {}): Promise<boolean> {
        if (!this.isHapticEnabled()) {
            return false
        }

        try {
            switch (pattern) {
                case 'tap':
                    return this.vibrate(50)

                case 'double-tap':
                    return this.vibrate([50, 50, 50])

                case 'success':
                    return this.vibrate([100, 50, 100])

                case 'error':
                    return this.vibrate([200, 100, 200, 100, 200])

                case 'warning':
                    return this.vibrate([150, 75, 150])

                case 'capture':
                    return this.vibrate([75, 25, 75])

                case 'button-press':
                    return this.vibrate(30)

                case 'selection':
                    return this.vibrate(25)

                case 'navigation':
                    return this.vibrate(40)

                case 'custom':
                    if (options.pattern) {
                        return this.vibrate(options.pattern)
                    }
                    return this.vibrate(options.duration || 50)

                default:
                    console.warn('[HapticFeedback] Unknown pattern:', pattern)
                    return false
            }
        } catch (error) {
            console.error('[HapticFeedback] Error triggering haptic:', error)
            return false
        }
    }

    /**
     * Low-level vibration function
     */
    private vibrate(pattern: number | number[]): boolean {
        if (!this.hasVibrationAPI) {
            return false
        }

        try {
            const result = navigator.vibrate(pattern)
            return result
        } catch (error) {
            console.error('[HapticFeedback] Vibration error:', error)
            return false
        }
    }

    /**
     * Stop all haptic feedback
     */
    stopHaptic(): boolean {
        if (!this.hasVibrationAPI) {
            return false
        }

        try {
            return navigator.vibrate(0)
        } catch (error) {
            console.error('[HapticFeedback] Error stopping haptic:', error)
            return false
        }
    }

    /**
     * Test haptic feedback functionality
     */
    async testHaptic(): Promise<void> {
        console.log('[HapticFeedback] Testing haptic feedback...')

        if (!this.isSupported) {
            console.log('[HapticFeedback] Haptic feedback not supported on this device')
            return
        }

        const patterns = ['tap', 'double-tap', 'success', 'capture']

        for (const pattern of patterns) {
            console.log(`[HapticFeedback] Testing pattern: ${pattern}`)
            await this.triggerHaptic(pattern)
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        console.log('[HapticFeedback] Haptic test complete')
    }
}

// Create singleton instance
const hapticFeedback = new HapticFeedbackManager()

// Export convenience functions
export const triggerHaptic = (pattern: string, options?: HapticFeedbackOptions) =>
    hapticFeedback.triggerHaptic(pattern, options)

export const stopHaptic = () => hapticFeedback.stopHaptic()

export const setHapticEnabled = (enabled: boolean) => hapticFeedback.setEnabled(enabled)

export const isHapticSupported = () => hapticFeedback.getCapabilities().isSupported

export const getHapticCapabilities = () => hapticFeedback.getCapabilities()

export const testHaptic = () => hapticFeedback.testHaptic()

// Export the manager instance
export default hapticFeedback

// Predefined haptic patterns for common scanner actions
export const HAPTIC_PATTERNS = {
    // Button interactions
    BUTTON_PRESS: 'button-press',
    BUTTON_SELECTION: 'selection',

    // Navigation
    NAVIGATION: 'navigation',
    BACK: 'tap',

    // Camera actions
    CAPTURE: 'capture',
    CAPTURE_SUCCESS: 'success',
    CAPTURE_ERROR: 'error',

    // Processing feedback
    PROCESSING_START: 'tap',
    PROCESSING_COMPLETE: 'success',
    PROCESSING_ERROR: 'error',

    // UI feedback
    TOGGLE_ON: 'tap',
    TOGGLE_OFF: 'tap',
    WARNING: 'warning',

    // Touch interactions
    TOUCH_START: 'selection',
    TOUCH_END: 'tap',
    DRAG_START: 'selection',
    DRAG_END: 'tap'
} as const

export type HapticPattern = typeof HAPTIC_PATTERNS[keyof typeof HAPTIC_PATTERNS]