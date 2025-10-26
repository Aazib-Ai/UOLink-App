'use client'

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useScanner } from '../contexts/ScannerContext'
import type { UseCameraSessionReturn } from '../types'

export function useCameraSession(): UseCameraSessionReturn {
  const { state, dispatch } = useScanner()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getDisplayMetrics = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    const fallbackWidth = isMobile ? window.innerWidth : 720
    const fallbackHeight = isMobile ? window.innerHeight : 900

    const containerWidth = state.containerSize.width > 0 ? state.containerSize.width : fallbackWidth
    const containerHeight = state.containerSize.height > 0 ? state.containerSize.height : fallbackHeight

    const { width: videoWidth, height: videoHeight } = state.videoDimensions
    if (!videoWidth || !videoHeight) {
      return {
        containerWidth,
        containerHeight,
        videoWidth: 0,
        videoHeight: 0,
        coverScale: 1,
      }
    }

    const quarterTurn = Math.abs(state.captureRotation) === 90
    const baseWidth = quarterTurn ? videoHeight : videoWidth
    const baseHeight = quarterTurn ? videoWidth : videoHeight

    const coverScaleCandidate = Math.max(
      containerWidth / (baseWidth || 1),
      containerHeight / (baseHeight || 1)
    )
    const coverScale =
      Number.isFinite(coverScaleCandidate) && coverScaleCandidate > 0 ? coverScaleCandidate : 1

    return {
      containerWidth,
      containerHeight,
      videoWidth,
      videoHeight,
      coverScale,
    }
  }, [state.captureRotation, state.containerSize, state.videoDimensions])

  const videoStyle = useMemo<CSSProperties>(() => {
    const {
      containerWidth,
      containerHeight,
      videoWidth,
      videoHeight,
      coverScale,
    } = getDisplayMetrics()

    const baseStyle: CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transformOrigin: 'center center',
      objectFit: 'cover',
      maxWidth: 'none',
      maxHeight: 'none',
    }

    const transforms: string[] = ['translate(-50%, -50%)']
    if (state.captureRotation !== 0) {
      transforms.push(`rotate(${state.captureRotation}deg)`)
    }

    if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
      return {
        ...baseStyle,
        width: '100%',
        height: '100%',
        transform: transforms.join(' '),
      }
    }

    transforms.push(`scale(${coverScale})`)

    return {
      ...baseStyle,
      width: videoWidth,
      height: videoHeight,
      transform: transforms.join(' '),
    }
  }, [state.captureRotation, getDisplayMetrics])

  const evaluateRotation = useCallback(() => {
    const viewportIsPortrait =
      typeof window === 'undefined' ? true : window.innerHeight >= window.innerWidth
    dispatch({ type: 'SET_PORTRAIT_VIEWPORT', payload: viewportIsPortrait })

    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      dispatch({ type: 'SET_CAPTURE_ROTATION', payload: -90 })
      return
    }

    const isVideoLandscape = video.videoWidth > video.videoHeight

    if (!viewportIsPortrait) {
      dispatch({ type: 'SET_CAPTURE_ROTATION', payload: 0 })
      return
    }

    dispatch({ type: 'SET_CAPTURE_ROTATION', payload: isVideoLandscape ? -90 : 0 })
  }, [dispatch])

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Camera access is not supported in this environment.' })
      return
    }

    try {
      dispatch({ type: 'SET_CAMERA_LOADING', payload: true })

      const viewportIsPortrait =
        typeof window === 'undefined' ? true : window.innerHeight >= window.innerWidth
      dispatch({ type: 'SET_PORTRAIT_VIEWPORT', payload: viewportIsPortrait })

      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        try {
          await video.play()
        } catch {
          // Safari automatically starts the video on load.
        }

        const updateVideoMetrics = () => {
          dispatch({
            type: 'SET_VIDEO_DIMENSIONS',
            payload: {
              width: video.videoWidth || 0,
              height: video.videoHeight || 0,
            }
          })
          evaluateRotation()
        }

        if (video.readyState >= 2) {
          updateVideoMetrics()
        } else {
          video.addEventListener(
            'loadedmetadata',
            () => {
              updateVideoMetrics()
            },
            { once: true }
          )
        }
      }

      const [videoTrack] = stream.getVideoTracks()
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const capabilities = videoTrack.getCapabilities()
        if (capabilities && 'torch' in capabilities) {
          dispatch({ type: 'SET_TORCH_AVAILABLE', payload: Boolean(capabilities.torch) })
        }
      }

      dispatch({ type: 'SET_CAMERA_ERROR', payload: null })
    } catch (error) {
      console.warn('[useCameraSession] Failed to start camera', error)
      dispatch({
        type: 'SET_CAMERA_ERROR',
        payload: `Unable to access the camera: ${error instanceof Error ? error.message : 'Unknown error'}. Please grant permission or try again on a supported device.`
      })
    } finally {
      dispatch({ type: 'SET_CAMERA_LOADING', payload: false })
    }
  }, [dispatch, evaluateRotation])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // no-op
        }
      })
    }
    streamRef.current = null
    dispatch({ type: 'SET_TORCH_ENABLED', payload: false })
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [dispatch])

  const handleToggleTorch = useCallback(async () => {
    const stream = streamRef.current
    if (!stream) return

    const [track] = stream.getVideoTracks()
    if (!track || typeof track.applyConstraints !== 'function') {
      dispatch({ type: 'SET_TORCH_AVAILABLE', payload: false })
      return
    }

    const constraintSet: MediaTrackConstraintSet & { advanced?: Array<Record<string, unknown>> } = {}
    constraintSet.advanced = [{ torch: !state.isTorchEnabled }]

    try {
      await track.applyConstraints(constraintSet)
      dispatch({ type: 'SET_TORCH_ENABLED', payload: !state.isTorchEnabled })
    } catch (error) {
      console.warn('[useCameraSession] Torch toggle failed', error)
      dispatch({ type: 'SET_TORCH_AVAILABLE', payload: false })
    }
  }, [state.isTorchEnabled, dispatch])

  useEffect(() => {
    if (state.step !== 'capture') return

    const video = videoRef.current
    const stream = streamRef.current

    if (!video || !stream) return

    if (video.srcObject !== stream) {
      video.srcObject = stream
    }

    const updateVideoMetrics = () => {
      dispatch({
        type: 'SET_VIDEO_DIMENSIONS',
        payload: {
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
        },
      })
      evaluateRotation()
    }

    const handleLoadedMetadata = () => {
      updateVideoMetrics()
    }

    if (video.readyState >= 2) {
      updateVideoMetrics()
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
    }

    try {
      const playPromise = video.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // Some browsers block autoplay; ignore silently as user interaction will retrigger.
        })
      }
    } catch {
      // Swallow errors from autoplay attempts
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [state.step, dispatch, evaluateRotation])

  return useMemo(() => ({
    videoRef,
    canvasRef,
    streamRef,
    videoStyle,
    cameraError: state.cameraError,
    isCameraLoading: state.isCameraLoading,
    isTorchAvailable: state.isTorchAvailable,
    isTorchEnabled: state.isTorchEnabled,
    videoDimensions: state.videoDimensions,
    captureRotation: state.captureRotation,
    isPortraitViewport: state.isPortraitViewport,
    startCamera,
    stopCamera,
    handleToggleTorch,
    evaluateRotation,
    getDisplayMetrics,
  }), [
    videoRef,
    canvasRef,
    streamRef,
    videoStyle,
    state.cameraError,
    state.isCameraLoading,
    state.isTorchAvailable,
    state.isTorchEnabled,
    state.videoDimensions,
    state.captureRotation,
    state.isPortraitViewport,
    startCamera,
    stopCamera,
    handleToggleTorch,
    evaluateRotation,
    getDisplayMetrics,
  ])
}
