'use client'

import { useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import Cropper from 'react-easy-crop'
import { 
  Check, 
  Loader2, 
  RotateCcw, 
  X, 
  Crop,
  Palette,
  Sliders,
  Sun,
  Contrast,
  Circle,
  Move
} from 'lucide-react'
import type { ScannerEditStepProps, ScannerFilter } from '../types'
import { ManualCroppingEditor } from './ManualCroppingEditor'
import { CropPreviewComponent } from './CropPreviewComponent'
import { useCameraHaptics } from '../hooks/useHapticFeedback'

// Instagram/VSCO-style filter presets
const FILTER_PRESETS: Array<{
  value: ScannerFilter
  name: string
  preview: string
  style: React.CSSProperties
}> = [
  { 
    value: 'original', 
    name: 'Original',
    preview: 'No filter',
    style: {}
  },
  { 
    value: 'enhanced-contrast', 
    name: 'Vivid',
    preview: 'Enhanced contrast',
    style: { filter: 'contrast(1.3) brightness(1.1) saturate(1.2)' }
  },
  { 
    value: 'auto-brightness', 
    name: 'Bright',
    preview: 'Auto exposure',
    style: { filter: 'brightness(1.2) contrast(1.1)' }
  },
  { 
    value: 'text-sharpen', 
    name: 'Sharp',
    preview: 'Text optimized',
    style: { filter: 'contrast(1.2) brightness(1.05) saturate(0.9)' }
  },
  { 
    value: 'document-grayscale', 
    name: 'Clean',
    preview: 'Document gray',
    style: { filter: 'grayscale(1) contrast(1.1)' }
  },
  { 
    value: 'grayscale', 
    name: 'Mono',
    preview: 'Grayscale',
    style: { filter: 'grayscale(1)' }
  },
  { 
    value: 'bw', 
    name: 'B&W',
    preview: 'High contrast',
    style: { filter: 'grayscale(1) contrast(1.4) brightness(1.1)' }
  },
]

type EditMode = 'crop' | 'manual' | 'filters' | 'adjust'

export function ScannerEditStep({
  state,
  activePage,
  editCrop,
  editZoom,
  editFilter,
  onCropChange,
  onZoomChange,
  onFilterChange,
  onCropComplete,
  onSave,
  onReset,
  onCancel,
}: ScannerEditStepProps) {
  const [editMode, setEditMode] = useState<EditMode>('crop')
  const [brightness, setBrightness] = useState(1)
  const [contrast, setContrast] = useState(1)
  const [saturation, setSaturation] = useState(1)
  const [manualCorners, setManualCorners] = useState<{ x: number; y: number }[]>([])
  
  const haptics = useCameraHaptics({ enabled: true, autoDetect: true })

  if (!activePage) return null

  const handleFilterSelect = useCallback(async (filterValue: ScannerFilter) => {
    await haptics.buttonPressFeedback()
    onFilterChange(filterValue)
  }, [haptics, onFilterChange])

  const handleSave = useCallback(async () => {
    await haptics.processingStart()
    await onSave()
    await haptics.processingComplete()
  }, [haptics, onSave])

  const handleReset = useCallback(async () => {
    await haptics.buttonPressFeedback()
    onReset()
    setBrightness(1)
    setContrast(1)
    setSaturation(1)
  }, [haptics, onReset])

  const handleCancel = useCallback(async () => {
    await haptics.navigationFeedback()
    onCancel()
  }, [haptics, onCancel])

  const handleModeChange = useCallback(async (mode: EditMode) => {
    await haptics.buttonPressFeedback()
    setEditMode(mode)
  }, [haptics])

  const handleManualCropApply = useCallback(async () => {
    await haptics.processingStart()
    await onSave()
    await haptics.processingComplete()
  }, [haptics, onSave])

  const getFilterStyle = (): CSSProperties => {
    const baseFilter = FILTER_PRESETS.find(f => f.value === editFilter)?.style || {}
    const adjustments = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`
    
    if (baseFilter.filter) {
      return { filter: `${baseFilter.filter} ${adjustments}` }
    }
    return { filter: adjustments }
  }
  const previewStyle = getFilterStyle()

  // Simplified modern interface focused on cropping
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 text-slate-900 sm:px-6">
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
        >
          Cancel
        </button>
        
        <div className="text-center">
          <div className="text-base font-semibold text-slate-800">Edit & Crop</div>
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
            Page {state.pages.findIndex((page) => page.id === activePage.id) + 1}
          </div>
        </div>
        
        <button
          type="button"
          onClick={handleSave}
          disabled={state.isSavingEdit}
          className="text-sm font-semibold text-[#426115] disabled:opacity-50"
        >
          {state.isSavingEdit ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          ) : (
            'Done'
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center bg-slate-50 px-4 py-6 sm:px-6">
          <div className="relative max-w-sm w-full">
          {editMode === 'filters' || editMode === 'adjust' ? (
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[32px] bg-white shadow-[0_30px_90px_-55px_rgba(15,23,42,0.35)]">
              <img
                src={activePage.originalDataUrl}
                alt="Preview with filters"
                className="h-full w-full object-cover"
                style={previewStyle}
              />
              <div className="pointer-events-none absolute inset-3 rounded-[28px] border border-white/60 ring-1 ring-white/60" />
            </div>
          ) : (
            <CropPreviewComponent
              imageDataUrl={activePage.originalDataUrl}
              onCropChange={(cropData) => {
                // Update crop state based on the crop preview
                onCropComplete(cropData.area)
              }}
              onRetake={() => {
                // Reset to original state
                handleReset()
              }}
              previewStyle={previewStyle}
            />
          )}
        </div>
        </div>

        <div className="space-y-4 px-4 pb-10 sm:px-6">
          <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={state.isSavingEdit}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          
          <button
            type="button"
            onClick={() => handleModeChange('filters')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 px-4 text-sm font-semibold transition-colors ${
              editMode === 'filters'
                ? 'border-[#90c639] bg-[#90c639] text-white shadow-[0_12px_30px_-18px_rgba(144,198,57,0.65)]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Palette className="w-4 h-4" />
            Filters
          </button>
          
          <button
            type="button"
            onClick={() => handleModeChange('adjust')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 px-4 text-sm font-semibold transition-colors ${
              editMode === 'adjust'
                ? 'border-[#90c639] bg-[#90c639] text-white shadow-[0_12px_30px_-18px_rgba(144,198,57,0.65)]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Adjust
          </button>
        </div>

        {/* Filter Panel */}
        {editMode === 'filters' && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex overflow-x-auto gap-3 pb-1 -mx-1">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handleFilterSelect(preset.value)}
                  className="flex-shrink-0 text-center"
                >
                  <div className={`mb-2 h-16 w-16 rounded-lg border-2 transition-all ${
                    editFilter === preset.value
                      ? 'border-[#90c639] shadow-[0_10px_25px_-18px_rgba(144,198,57,0.65)]'
                      : 'border-slate-200'
                  }`}>
                    <img
                      src={activePage.processedDataUrl}
                      alt={preset.name}
                      className="w-full h-full object-cover rounded-md"
                      style={preset.style}
                    />
                  </div>
                  <div className={`text-xs font-medium ${
                    editFilter === preset.value ? 'text-[#365316]' : 'text-slate-500'
                  }`}>
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Adjust Panel */}
        {editMode === 'adjust' && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="max-h-44 space-y-4 overflow-y-auto pr-1">
            {/* Brightness */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Sun className="w-4 h-4" />
                  <span className="text-sm">Brightness</span>
                </div>
                <span className="text-sm font-semibold text-slate-600">{Math.round((brightness - 1) * 100)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.01}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="h-1 w-full rounded-lg bg-slate-200 accent-[#90c639]"
              />
            </div>

            {/* Contrast */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Contrast className="w-4 h-4" />
                  <span className="text-sm">Contrast</span>
                </div>
                <span className="text-sm font-semibold text-slate-600">{Math.round((contrast - 1) * 100)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.01}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="h-1 w-full rounded-lg bg-slate-200 accent-[#90c639]"
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Circle className="w-4 h-4" />
                  <span className="text-sm">Saturation</span>
                </div>
                <span className="text-sm font-semibold text-slate-600">{Math.round((saturation - 1) * 100)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.01}
                value={saturation}
                onChange={(e) => setSaturation(Number(e.target.value))}
                className="h-1 w-full rounded-lg bg-slate-200 accent-[#90c639]"
              />
            </div>
          </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )

}
