/**
 * React Hook for Haptic Feedback Integration
 * Provides easy-to-use haptic feedback for React components
 */

import { useCallback, useEffect, useState } from 'react'
import {
    triggerHaptic,
    setHapticEnabled,
    isHapticSupported,
    getHapticCapabilities,
    HAPTIC_PATTERNS,
    type HapticFeedbackOptions,
    type HapticCapabilities,
    type HapticPattern
} from '../utils/hapticFeedback'

export interface UseHapticFeedbackReturn {
    // Core haptic functions
    trigger: (pattern: HapticPattern | string, options?: HapticFeedbackOptions) => Promise<boolean>

    // Convenience functions for common patterns
    tapFeedback: () => Promise<boolean>
    captureFeedback: () => Promise<boolean>
    successFeedback: () => Promise<boolean>
    errorFeedback: () => Promise<boolean>
    buttonPressFeedback: () => Promise<boolean>
    navigationFeedback: () => Promise<boolean>

    // State and capabilities
    isSupported: boolean
    isEnabled: boolean
    capabilities: HapticCapabilities

    // Control functions
    enable: () => void
    disable: () => void
    toggle: () => void
}

export interface UseHapticFeedbackOptions {
    enabled?: boolean
    autoDetect?: boolean
}

/**
 * Hook for haptic feedback functionality
 */
export function useHapticFeedback(options: UseHapticFeedbackOptions = {}): UseHapticFeedbackReturn {
    const { enabled = true, autoDetect = true } = options

    const [isEnabled, setIsEnabled] = useState(enabled)
    const [capabilities, setCapabilities] = useState<HapticCapabilities>(() => getHapticCapabilities())

    // Initialize haptic feedback settings
    useEffect(() => {
        if (autoDetect) {
            const caps = getHapticCapabilities()
            setCapabilities(caps)

            // Only enable if device supports haptic feedback
            if (caps.isSupported && enabled) {
                setHapticEnabled(true)
                setIsEnabled(true)
            } else {
                setHapticEnabled(false)
                setIsEnabled(false)
            }
        } else {
            setHapticEnabled(enabled)
            setIsEnabled(enabled)
        }
    }, [enabled, autoDetect])

    // Core trigger function
    const trigger = useCallback(async (pattern: HapticPattern | string, options?: HapticFeedbackOptions): Promise<boolean> => {
        if (!isEnabled || !capabilities.isSupported) {
            return false
        }

        try {
            return await triggerHaptic(pattern, options)
        } catch (error) {
            console.error('[useHapticFeedback] Error triggering haptic:', error)
            return false
        }
    }, [isEnabled, capabilities.isSupported])

    // Convenience functions for common patterns
    const tapFeedback = useCallback(() => trigger(HAPTIC_PATTERNS.BUTTON_PRESS), [trigger])
    const captureFeedback = useCallback(() => trigger(HAPTIC_PATTERNS.CAPTURE), [trigger])
    const successFeedback = useCallback(() => trigger(HAPTIC_PATTERNS.CAPTURE_SUCCESS), [trigger])
    const errorFeedback = useCallback(() => trigger(HAPTIC_PATTERNS.CAPTURE_ERROR), [trigger])
    const buttonPressFeedback = useCallback(() => trigger(HAPTIC_PATTERNS.BUTTON_PRESS), [trigger])
    const navigationFeedback = useCallback(() => trigger(HAPTIC_PATTERNS.NAVIGATION), [trigger])

    // Control functions
    const enable = useCallback(() => {
        setHapticEnabled(true)
        setIsEnabled(true)
    }, [])

    const disable = useCallback(() => {
        setHapticEnabled(false)
        setIsEnabled(false)
    }, [])

    const toggle = useCallback(() => {
        const newState = !isEnabled
        setHapticEnabled(newState)
        setIsEnabled(newState)
    }, [isEnabled])

    return {
        // Core functions
        trigger,

        // Convenience functions
        tapFeedback,
        captureFeedback,
        successFeedback,
        errorFeedback,
        buttonPressFeedback,
        navigationFeedback,

        // State
        isSupported: capabilities.isSupported,
        isEnabled,
        capabilities,

        // Control
        enable,
        disable,
        toggle
    }
}

/**
 * Hook for enhanced button interactions with haptic feedback
 */
export function useHapticButton(options: UseHapticFeedbackOptions = {}) {
    const haptic = useHapticFeedback(options)

    const createHapticHandler = useCallback((
        originalHandler?: () => void | Promise<void>,
        hapticPattern: HapticPattern | string = HAPTIC_PATTERNS.BUTTON_PRESS
    ) => {
        return async () => {
            // Trigger haptic feedback first for immediate response
            await haptic.trigger(hapticPattern)

            // Then execute the original handler
            if (originalHandler) {
                await originalHandler()
            }
        }
    }, [haptic])

    const createTouchHandlers = useCallback((
        onPress?: () => void | Promise<void>,
        onRelease?: () => void | Promise<void>
    ) => {
        return {
            onTouchStart: async () => {
                await haptic.trigger(HAPTIC_PATTERNS.TOUCH_START)
                if (onPress) await onPress()
            },
            onTouchEnd: async () => {
                await haptic.trigger(HAPTIC_PATTERNS.TOUCH_END)
                if (onRelease) await onRelease()
            }
        }
    }, [haptic])

    return {
        ...haptic,
        createHapticHandler,
        createTouchHandlers
    }
}

/**
 * Hook for camera-specific haptic feedback patterns
 */
export function useCameraHaptics(options: UseHapticFeedbackOptions = {}) {
    const haptic = useHapticFeedback(options)

    const captureStart = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.CAPTURE), [haptic])
    const captureSuccess = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.CAPTURE_SUCCESS), [haptic])
    const captureError = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.CAPTURE_ERROR), [haptic])
    const processingStart = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.PROCESSING_START), [haptic])
    const processingComplete = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.PROCESSING_COMPLETE), [haptic])
    const processingError = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.PROCESSING_ERROR), [haptic])
    const toggleOn = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.TOGGLE_ON), [haptic])
    const toggleOff = useCallback(() => haptic.trigger(HAPTIC_PATTERNS.TOGGLE_OFF), [haptic])

    return {
        ...haptic,
        captureStart,
        captureSuccess,
        captureError,
        processingStart,
        processingComplete,
        processingError,
        toggleOn,
        toggleOff
    }
}

export default useHapticFeedback