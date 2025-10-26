'use client'

import { useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Loader2, Smartphone, Sparkles, X, Zap, ZapOff } from 'lucide-react'
import type { ScannerCaptureStepProps } from '../types'
import '../styles/mobile-optimizations.css'
import { useCameraHaptics } from '../hooks/useHapticFeedback'

const MAX_CAPTURED_PAGES = 30

export function ScannerCaptureStep({
  state,
  videoRef,
  canvasRef,
  videoStyle,
  captureContainerRef,
  onCapture,
  onToggleTorch,
  onClose,
  onReviewPages,
  onToggleAdvancedProcessing,
}: ScannerCaptureStepProps) {
  const haptics = useCameraHaptics({ enabled: true, autoDetect: true })
  const hasPages = state.pages.length > 0
  const lastCapturedPage = hasPages ? state.pages[state.pages.length - 1] : null

  const captureDisabled =
    !state.isPortraitViewport || state.isCameraLoading || state.pages.length >= MAX_CAPTURED_PAGES

  const handleCaptureWithHaptic = useCallback(async () => {
    await haptics.captureStart()
    onCapture()
  }, [haptics, onCapture])

  const handleCloseWithHaptic = useCallback(async () => {
    await haptics.navigationFeedback()
    onClose()
  }, [haptics, onClose])

  const handleReviewWithHaptic = useCallback(async () => {
    if (!hasPages) {
      return
    }
    await haptics.navigationFeedback()
    onReviewPages()
  }, [hasPages, haptics, onReviewPages])

  const handleTorchToggleWithHaptic = useCallback(async () => {
    if (state.isTorchEnabled) {
      await haptics.toggleOff()
    } else {
      await haptics.toggleOn()
    }
    await onToggleTorch()
  }, [haptics, onToggleTorch, state.isTorchEnabled])

  const handleAdvancedProcessingToggleWithHaptic = useCallback(async () => {
    if (state.useAdvancedProcessing) {
      await haptics.toggleOff()
    } else {
      await haptics.toggleOn()
    }
    onToggleAdvancedProcessing()
  }, [haptics, onToggleAdvancedProcessing, state.useAdvancedProcessing])

  return (
    <div
      ref={captureContainerRef}
      className="absolute inset-0 overflow-hidden scanner-capture-mobile scanner-interactive scanner-gpu-accelerated"
      style={{ minHeight: '100vh', minWidth: '100vw' }}
    >
      <video
        ref={videoRef}
        className="absolute"
        style={videoStyle}
        playsInline
        autoPlay
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 pointer-events-none">
        {/* Top chrome */}
        <div className="absolute inset-x-0 top-0 px-4 pt-8 pb-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-white/95 px-3 py-2 shadow-[0_12px_40px_-25px_rgba(15,23,42,0.35)] ring-1 ring-slate-100">
            <div className="pointer-events-auto">
              <button
                type="button"
                onClick={handleCloseWithHaptic}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all duration-200 hover:bg-slate-200 active:scale-95"
                aria-label="Close scanner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="pointer-events-none text-center">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-400 sm:text-xs">
                Document Scanner
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-700 sm:text-base">
                Align your page inside the frame
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
              <AnimatePresence initial={false} mode="wait">
                {state.isTorchAvailable && (
                  <motion.button
                    key={state.isTorchEnabled ? 'torch-on' : 'torch-off'}
                    type="button"
                    onClick={handleTorchToggleWithHaptic}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 transition-all duration-200 active:scale-95 ${
                      state.isTorchEnabled
                        ? 'bg-[#90c639] text-white shadow-[0_12px_30px_-15px_rgba(144,198,57,0.8)] hover:bg-[#83b432]'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-label={state.isTorchEnabled ? 'Disable torch' : 'Enable torch'}
                  >
                    {state.isTorchEnabled ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
                  </motion.button>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={handleAdvancedProcessingToggleWithHaptic}
                className={`hidden sm:flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                  state.useAdvancedProcessing
                    ? 'bg-[#90c639] text-white shadow-[0_12px_30px_-15px_rgba(144,198,57,0.8)] hover:bg-[#83b432]'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Enhance
              </button>
            </div>
          </div>

          <div className="pointer-events-none mx-auto mt-3 flex w-full max-w-sm items-center justify-center rounded-xl bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-500 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#90c639]" />
              <span>Natural lighting gives the best scan</span>
            </div>
          </div>
        </div>
      </div>

      {!state.isPortraitViewport && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center text-white">
          <Smartphone className="h-10 w-10 opacity-80" />
          <p className="text-lg font-semibold">Rotate your device</p>
          <p className="max-w-xs text-sm text-white/70">
            Portrait orientation keeps documents in frame. Rotate back to continue scanning.
          </p>
        </div>
      )}

      <AnimatePresence>
        {state.pendingCapture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col bg-black/90"
          >
            {state.isProcessingDocument && (
              <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
                  Processing scan
                </span>
              </div>
            )}
            <div className="flex-1 px-6 pt-16 pb-8">
              <div className="flex h-full items-center justify-center">
                <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-[#0f0f0f] shadow-[0_35px_110px_-60px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
                  <div className="aspect-[3/4] w-full bg-gradient-to-b from-white/10 to-black/50">
                    <img
                      src={state.pendingCapture}
                      alt="Captured page preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-4 rounded-[22px] border border-white/15" />
                  <div className="pointer-events-none absolute inset-x-10 bottom-8 h-3 rounded-full bg-black/40 blur-lg" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 px-6 pb-14 text-center">
              <span className="text-lg font-semibold text-white">Keep this capture?</span>
              <p className="max-w-sm text-sm text-white/70">
                If the page looks sharp and upright, save it. Otherwise, retake for a crisper result.
              </p>
              {/* Action buttons handled by parent */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-7 pt-10 sm:px-6">
        <div className="mx-auto flex w/full max-w-xl flex-col gap-4 rounded-[28px] bg-white/95 p-5 shadow-[0_-30px_90px_-55px_rgba(15,23,42,0.45)] ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-600">
              Ready to capture?
            </div>
            <button
              type="button"
              onClick={handleAdvancedProcessingToggleWithHaptic}
              className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                state.useAdvancedProcessing
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Smart enhance
            </button>
          </div>

          <div className="flex items-end justify-between">
            <div className="pointer-events-auto">
              {hasPages ? (
                <button
                  type="button"
                  onClick={handleReviewWithHaptic}
                  className="relative flex h-20 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition-all duration-200 hover:bg-slate-100 active:scale-95 sm:h-24 sm:w-20"
                >
                  <img
                    src={lastCapturedPage?.processedDataUrl}
                    alt="Last capture"
                    className="h-full w-full rounded-[18px] object-cover"
                  />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#90c639] text-xs font-bold text-white shadow-lg">
                    {state.pages.length}
                  </span>
                </button>
              ) : (
                <div className="flex h-20 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 sm:h-24 sm:w-20">
                  <FileText className="h-6 w-6" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCaptureWithHaptic}
              disabled={captureDisabled}
              className="pointer-events-auto relative flex h-24 w-24 items-center justify-center rounded-full border border-emerald-100 bg-white shadow-[0_28px_70px_-40px_rgba(144,198,57,0.55)] transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 sm:h-28 sm:w-28"
            >
              <div className="absolute inset-1 rounded-full bg-slate-100" />
              <div className="relative h-20 w-20 rounded-full bg-white transition-all duration-200 sm:h-24 sm:w-24" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent transition-all duration-200 active:border-emerald-200/60" />
            </button>

            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleReviewWithHaptic}
                disabled={!hasPages}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                <FileText className="h-4 w-4" />
                Review ({state.pages.length})
              </button>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {state.pages.length}/{MAX_CAPTURED_PAGES} pages
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
