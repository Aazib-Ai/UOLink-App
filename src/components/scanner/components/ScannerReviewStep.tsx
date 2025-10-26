'use client'

import { useCallback } from 'react'
import { Reorder } from 'framer-motion'
import { Camera, Edit3, FileText, GripVertical, Loader2, Sparkles, Trash2 } from 'lucide-react'
import type { ScannerReviewStepProps } from '../types'
import { useCameraHaptics } from '../hooks/useHapticFeedback'

const MAX_REVIEWABLE_PAGES = 30

export function ScannerReviewStep({
  state,
  onBack,
  onAddMore,
  onOpenEditor,
  onRemovePage,
  onReorderPages,
  onGeneratePdf,
}: ScannerReviewStepProps) {
  const haptics = useCameraHaptics({ enabled: true, autoDetect: true })
  const pageCount = state.pages.length
  const pageLabel = `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`

  const handleBack = useCallback(async () => {
    await haptics.navigationFeedback()
    onBack()
  }, [haptics, onBack])

  const handleAddMore = useCallback(async () => {
    await haptics.buttonPressFeedback()
    onAddMore()
  }, [haptics, onAddMore])

  const handleGeneratePdf = useCallback(async () => {
    await haptics.buttonPressFeedback()
    await onGeneratePdf()
  }, [haptics, onGeneratePdf])

  return (
    <div className="flex h-full flex-col bg-white text-slate-900">
      <main className="flex-1 overflow-y-auto bg-slate-50 px-5 pb-32 pt-6 sm:px-8">
        {pageCount === 0 ? (
          <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-5 text-center text-slate-600">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-slate-400">
              <Camera className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">No pages yet</h2>
              <p className="mt-2 text-sm">Capture documents to build your PDF.</p>
            </div>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-3 rounded-2xl bg-[#90c639] px-6 py-3 text-base font-semibold text-white shadow-[0_12px_30px_-18px_rgba(144,198,57,0.65)] transition-all duration-200 hover:bg-[#83b432] active:scale-95"
            >
              <Camera className="h-5 w-5" />
              Start scanning
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-3">
            <Reorder.Group axis="y" values={state.pages} onReorder={onReorderPages}>
              {state.pages.map((page, index) => (
                <Reorder.Item
                  key={page.id}
                  value={page}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-[#90c639]/40 sm:gap-4 sm:p-3.5"
                >
                  <div className="flex h-10 min-w-[2.75rem] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-500">
                    <span className="whitespace-nowrap">#{index + 1}</span>
                    <GripVertical className="h-3 w-3 opacity-60" />
                  </div>

                  <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <img
                      src={page.processedDataUrl}
                      alt={`Scanned page ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">Page {index + 1}</p>
                        {page.processingInfo?.wasAutoProcessed && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.6rem] font-semibold text-emerald-700">
                            <Sparkles className="h-3 w-3" />
                            Auto enhanced
                          </div>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <span>
                          {index + 1} of {pageCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await haptics.buttonPressFeedback()
                          onOpenEditor(page.id)
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-100 active:scale-95"
                        aria-label={`Edit page ${index + 1}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await haptics.buttonPressFeedback()
                          onRemovePage(page.id)
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-600 transition-all duration-200 hover:bg-rose-100 active:scale-95"
                        aria-label={`Remove page ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )}
      </main>

      <footer className="pointer-events-none sticky bottom-0 z-30 border-t border-slate-100 bg-white/95 px-5 pb-6 pt-5 backdrop-blur-sm sm:px-8">
        <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_-20px_70px_-50px_rgba(15,23,42,0.45)] ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
            <span>{pageLabel}</span>
            <span>
              {pageCount}/{MAX_REVIEWABLE_PAGES} pages
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAddMore}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 active:scale-95"
            >
              <Camera className="h-4 w-4" />
              Add pages
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={!pageCount || state.isGeneratingPdf}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#90c639] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(144,198,57,0.65)] transition-all duration-200 hover:bg-[#83b432] active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {state.isGeneratingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate PDF
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
