'use client'

import {
  Sparkles,
  X,
  Zap,
  ZapOff,
} from 'lucide-react'
import type { ScannerToolbarProps } from '../types'

export function ScannerToolbar({
  pages,
  isTorchAvailable,
  isTorchEnabled,
  useAdvancedProcessing,
  onClose,
  onReviewPages,
  onToggleTorch,
  onToggleAdvancedProcessing,
}: ScannerToolbarProps) {
  return (
    <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent px-6 pt-12 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm p-3 text-white transition hover:bg-white/30"
          >
            <X className="h-6 w-6" />
          </button>
          {pages.length > 0 && (
            <button
              type="button"
              onClick={onReviewPages}
              className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30"
            >
              <Sparkles className="h-5 w-5" />
              Review ({pages.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {isTorchAvailable && (
            <button
              type="button"
              onClick={onToggleTorch}
              className="inline-flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm p-3 text-white transition hover:bg-white/30"
            >
              {isTorchEnabled ? (
                <Zap className="h-6 w-6 text-amber-400" />
              ) : (
                <ZapOff className="h-6 w-6" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleAdvancedProcessing}
            className={`inline-flex items-center justify-center rounded-full backdrop-blur-sm p-3 text-white transition ${
              useAdvancedProcessing ? 'bg-[#90c639]/80 hover:bg-[#90c639]' : 'bg-white/20 hover:bg-white/30'
            }`}
            title={useAdvancedProcessing ? 'Advanced processing enabled' : 'Advanced processing disabled'}
          >
            <Sparkles className={`h-6 w-6 ${useAdvancedProcessing ? 'text-white' : 'text-white/70'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
