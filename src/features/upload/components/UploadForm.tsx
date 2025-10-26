'use client'

import { Camera } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import { MAX_FILE_SIZE_MB, MATERIAL_TYPE_OPTIONS, MATERIAL_TYPE_OPTION_LABELS, SEQUENCE_OPTIONS } from '../constants'
import { getSupportedFileTypeSummary, resolveUploadDescriptorByExtension, resolveUploadDescriptorByMime, SUPPORTED_UPLOAD_ACCEPT_ATTRIBUTE, SUPPORTED_UPLOAD_EXTENSION_LIST } from '@/constants/uploadFileTypes'
import type { UploadFormProps } from '../types'

interface UploadFormComponentProps extends UploadFormProps {
  subjectSuggestions: string[]
  teacherSuggestions: string[]
  materialTypeLabel: string
  showSequenceDropdown: boolean
  materialSequencePlaceholder: string
  onSubjectChange: (value: string) => void
  onSubjectBlur: () => void
  onTeacherChange: (value: string) => void
  onTeacherBlur: () => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  submitButtonStyle?: 'modal' | 'page'
}

export function UploadForm({
  onSubmit,
  isActionDisabled,
  formData,
  onFormDataChange,
  onScanRequest,
  fileInputRef,
  subjectError,
  teacherWarning,
  onSubjectErrorChange,
  onTeacherWarningChange,
  teacherOverrideConfirmed,
  onTeacherOverrideConfirmedChange,
  submitting,
  subjectSuggestions,
  teacherSuggestions,
  materialTypeLabel,
  showSequenceDropdown,
  materialSequencePlaceholder,
  onSubjectChange,
  onSubjectBlur,
  onTeacherChange,
  onTeacherBlur,
  handleFileChange,
  submitButtonStyle = 'page'
}: UploadFormComponentProps) {
  const supportedFileSummary = getSupportedFileTypeSummary()
  const supportedExtensions = SUPPORTED_UPLOAD_EXTENSION_LIST.join(', ')
  const selectedFileExtension =
    formData.file?.name && formData.file.name.includes('.')
      ? (formData.file.name.split('.').pop() ?? '').toLowerCase()
      : ''
  const selectedFileDescriptor =
    formData.file
      ? resolveUploadDescriptorByMime(formData.file.type) ||
        (selectedFileExtension ? resolveUploadDescriptorByExtension(selectedFileExtension) : undefined)
      : undefined
  const fileBadgeLabel =
    (selectedFileDescriptor?.extension || selectedFileExtension || (formData.file ? 'file' : '')).toUpperCase()

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Document Upload */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <header>
          <h2 className="text-base font-semibold text-gray-900">Document file *</h2>
        </header>
        <div className="mt-4">
          <div className="space-y-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="material-file" className="text-sm font-semibold text-gray-800">
                Select a document ({supportedExtensions}) or scan with your camera
              </label>
              {onScanRequest && (
                <button
                  type="button"
                  onClick={onScanRequest}
                  disabled={isActionDisabled}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  Scan with camera
                </button>
              )}
            </div>
            <input
              id="material-file"
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_UPLOAD_ACCEPT_ATTRIBUTE}
              onChange={handleFileChange}
              className="w-full cursor-pointer text-sm text-gray-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#1f1f1f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              required={!formData.file}
              disabled={isActionDisabled}
            />
            {formData.file && (
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                <span className="text-xs font-bold text-[#90c639]">{fileBadgeLabel}</span>
                <span className="truncate">{formData.file.name}</span>
                {formData.fileSource === 'scanner' && (
                  <span className="ml-auto rounded-full bg-[#f4fbe8] px-2 py-0.5 text-[10px] font-semibold text-[#365316]">
                    Scanned with UOLink
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Supported formats: {supportedFileSummary} ({supportedExtensions}). Max {MAX_FILE_SIZE_MB}MB. Scans are optimized automatically for clarity.
            </p>
          </div>
        </div>
      </section>

      {/* Material Info */}
      <section className="rounded-2xl border border-amber-200/70 bg-white p-4 shadow-sm">
        <header>
          <h2 className="text-base font-semibold text-gray-900">Material info</h2>
        </header>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(event) => onFormDataChange({ title: event.target.value })}
              className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Material title"
              required
              maxLength={120}
              disabled={isActionDisabled}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Subject *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                onBlur={onSubjectBlur}
                className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Subject name"
                required
                maxLength={80}
                disabled={isActionDisabled}
              />
              {subjectError && (
                <p className="mt-2 text-xs font-semibold text-rose-600">{subjectError}</p>
              )}
              {subjectSuggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Matching subjects
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subjectSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          onSubjectChange(suggestion)
                          onSubjectErrorChange(null)
                        }}
                        disabled={isActionDisabled}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#90c639] hover:bg-[#f0f9e8] disabled:opacity-60"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Teacher *
              </label>
              <input
                type="text"
                value={formData.teacher}
                onChange={(event) => onTeacherChange(event.target.value)}
                onBlur={onTeacherBlur}
                className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Teacher name"
                required
                maxLength={80}
                disabled={isActionDisabled}
              />
              {teacherSuggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Matching teachers
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teacherSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          onTeacherChange(suggestion)
                          onTeacherWarningChange(null)
                          onTeacherOverrideConfirmedChange(false)
                        }}
                        disabled={isActionDisabled}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#90c639] hover:bg-[#f0f9e8] disabled:opacity-60"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {teacherWarning && (
                <p className="mt-2 text-xs font-semibold text-amber-600">{teacherWarning}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Type *
              </label>
              <div className="mt-2 relative">
                <CustomSelect
                  options={[...MATERIAL_TYPE_OPTION_LABELS]}
                  placeholder="Select Material Type"
                  value={materialTypeLabel || undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === 'Select Material Type') {
                      onFormDataChange({ materialType: '', materialSequence: '' })
                      return
                    }
                    const match = MATERIAL_TYPE_OPTIONS.find((option) => option.label === selectedOption)
                    if (match) {
                      onFormDataChange({ 
                        materialType: match.value,
                        materialSequence: !['assignment', 'quiz'].includes(match.value) ? '' : formData.materialSequence
                      })
                    } else {
                      const normalized = selectedOption.trim().toLowerCase().replace(/\s+/g, '-')
                      onFormDataChange({ 
                        materialType: normalized,
                        materialSequence: !['assignment', 'quiz'].includes(normalized) ? '' : formData.materialSequence
                      })
                    }
                  }}
                  disabled={isActionDisabled}
                  className="!border-amber-200 !bg-white focus:!border-[#90c639] focus:!ring-2 focus:!ring-[#90c639]/20"
                />
                {formData.materialType && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-2 h-2 rounded-full bg-[#90c639] animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showSequenceDropdown && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Number *
              </label>
              <div className="mt-2 relative">
                <CustomSelect
                  options={[...SEQUENCE_OPTIONS]}
                  placeholder={materialSequencePlaceholder}
                  value={formData.materialSequence || undefined}
                  onChange={(selectedOption) => {
                    onFormDataChange({ materialSequence: selectedOption })
                  }}
                  disabled={isActionDisabled}
                  className="!border-amber-200 !bg-white focus:!border-[#90c639] focus:!ring-2 focus:!ring-[#90c639]/20"
                />
                {formData.materialSequence && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-2 h-2 rounded-full bg-[#90c639] animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isActionDisabled}
        className={`w-full rounded-2xl px-6 py-4 text-base font-semibold text-white shadow-lg transition focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400 ${
          submitButtonStyle === 'modal'
            ? 'bg-[#90c639] hover:bg-[#7ab332] focus:ring-2 focus:ring-[#90c639]/30'
            : 'bg-[#1f1f1f] hover:bg-black focus:ring-2 focus:ring-black/30'
        }`}
      >
        {submitting ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  )
}
