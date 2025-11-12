'use client'

import { useState, useEffect } from 'react'
import { Flag, AlertTriangle, X, Shield, LogIn, RotateCcw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { reportNote, getReportStatus, undoReport } from '@/lib/api/reports'
import Link from 'next/link'

interface ReportButtonProps {
  noteId: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'button' | 'icon'
  onReportUpdate?: (noteId: string, reportCount: number, hasReported: boolean) => void
}

const REPORT_REASONS = [
  'Inappropriate content',
  'Spam or misleading',
  'Copyright violation',
  'Incorrect information',
  'Poor quality content',
  'Not related to studies',
  'Other'
]

const SIZE_CONFIGS = {
  sm: {
    button: 'px-2 py-1 text-xs',
    icon: 'w-3.5 h-3.5',
    dialog: 'max-w-sm mx-4'
  },
  md: {
    button: 'px-3 py-1.5 text-sm',
    icon: 'w-4 h-4',
    dialog: 'max-w-md mx-4'
  },
  lg: {
    button: 'px-4 py-2 text-base',
    icon: 'w-5 h-5',
    dialog: 'max-w-lg mx-4'
  }
}

export default function ReportButton({
  noteId,
  className = '',
  size = 'sm',
  variant = 'icon',
  onReportUpdate
}: ReportButtonProps) {
  const { user } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [showUndoDialog, setShowUndoDialog] = useState(false)
  const [hasReported, setHasReported] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [undoSuccess, setUndoSuccess] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')

  const sizeConfig = SIZE_CONFIGS[size]

  // Check report status on mount
  useEffect(() => {
    const checkReportStatus = async () => {
      if (!noteId) return

      try {
        const status = await getReportStatus(noteId)
        setHasReported(status.hasReported)
        setReportCount(status.reportCount)
      } catch (err) {
        console.error('Error checking report status:', err)
      }
    }

    checkReportStatus()
  }, [noteId])

  const handleReportClick = (event?: React.MouseEvent) => {
    // Prevent any default behavior and event bubbling
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    console.log(`Report button clicked - noteId: ${noteId}, hasReported: ${hasReported}`)

    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (hasReported) {
      setShowUndoDialog(true)
      return
    }

    setShowDialog(true)
    setError(null)
    setSelectedReason('')
    setDescription('')
  }

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      setError('Please select a reason for reporting')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await reportNote(noteId, selectedReason, description.trim())
      
      // Get updated report status from server
      const updatedStatus = await getReportStatus(noteId)
      
      setHasReported(true)
      setReportCount(updatedStatus.reportCount)
      setSuccess(true)
      setSelectedReason('')
      setDescription('')

      // Notify parent component of the report update
      onReportUpdate?.(noteId, updatedStatus.reportCount, true)

      // Close dialog after success
      setTimeout(() => {
        setShowDialog(false)
        setSuccess(false)
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUndoReport = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      await undoReport(noteId)
      
      // Get updated report status from server
      const updatedStatus = await getReportStatus(noteId)
      
      setHasReported(false)
      setReportCount(updatedStatus.reportCount)
      setUndoSuccess(true)

      // Notify parent component of the report update
      onReportUpdate?.(noteId, updatedStatus.reportCount, false)

      // Close dialog after success
      setTimeout(() => {
        setShowUndoDialog(false)
        setUndoSuccess(false)
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Failed to undo report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseDialog = () => {
    if (!isSubmitting && !success) {
      setShowDialog(false)
      setSelectedReason('')
      setDescription('')
      setError(null)
    }
  }

  const handleCloseUndoDialog = () => {
    if (!isSubmitting && !undoSuccess) {
      setShowUndoDialog(false)
      setError(null)
    }
  }

  // Dialog render function
  const renderDialog = () => {
    if (!showDialog) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className={`w-full ${sizeConfig.dialog} bg-white rounded-3xl border border-lime-100 shadow-sm max-h-[90vh] overflow-y-auto`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-lime-100 bg-gradient-to-b from-[#f7fbe9] via-white to-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8f3d2] text-[#90c639]">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1f2f10]">Report Content</h3>
                <p className="text-xs text-[#4c5c3c]">Help keep our community safe</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleCloseDialog()
              }}
              disabled={isSubmitting || success}
              className="rounded-lg p-1 text-[#4c5c3c] hover:bg-[#f7fbe9] hover:text-[#1f2f10] transition-colors disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {success ? (
              <div className="text-center py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f3d2] text-[#90c639] mx-auto mb-4">
                  <Shield className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-semibold text-[#1f2f10] mb-2">Report Submitted</h4>
                <p className="text-sm text-[#4c5c3c]">
                  Thank you for helping keep our community safe. We'll review this content soon.
                </p>
              </div>
            ) : (
              <>
                {/* Report Reasons */}
                <div>
                  <label className="block text-sm font-medium text-[#1f2f10] mb-3">
                    Why are you reporting this content?
                  </label>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className={`
                          flex items-center p-3 rounded-2xl border-2 cursor-pointer transition-all
                          ${selectedReason === reason
                            ? 'border-[#90c639] bg-[#f7fbe9] ring-2 ring-[#e8f3d2]'
                            : 'border-lime-100 hover:border-[#90c639] bg-white'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          value={reason}
                          checked={selectedReason === reason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`
                          w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0
                          ${selectedReason === reason
                            ? 'border-[#90c639] bg-[#90c639]'
                            : 'border-lime-200'
                          }
                        `}>
                          {selectedReason === reason && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-[#334125]">{reason}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#1f2f10] mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide any additional context that might help us review this content..."
                    className="w-full min-h-[80px] px-3 py-2 border border-lime-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#e8f3d2] focus:border-[#90c639] text-sm"
                    maxLength={500}
                  />
                  <p className="text-xs text-[#4c5c3c] mt-1">
                    {description.length}/500 characters
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-[#f0f6e2] border border-lime-200 rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#90c639] mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-[#1f2f10]">{error}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleCloseDialog()
                    }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 border border-lime-100 text-[#334125] rounded-full hover:border-[#90c639] hover:text-[#1f2f10] transition-colors disabled:cursor-not-allowed touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSubmitReport()
                    }}
                    disabled={isSubmitting || !selectedReason}
                    className="flex-1 px-4 py-2.5 bg-[#90c639] text-white rounded-full hover:bg-[#7ab332] transition-colors disabled:cursor-not-allowed disabled:bg-lime-300 touch-manipulation flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Report'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Undo dialog render function
  const renderUndoDialog = () => {
    if (!showUndoDialog) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className={`w-full ${sizeConfig.dialog} bg-white rounded-3xl border border-lime-100 shadow-sm max-h-[90vh] overflow-y-auto`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-lime-100 bg-gradient-to-b from-[#f7fbe9] via-white to-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8f3d2] text-[#90c639]">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1f2f10]">Undo Report</h3>
                <p className="text-xs text-[#4c5c3c]">Remove your report from this content</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleCloseUndoDialog()
              }}
              disabled={isSubmitting || undoSuccess}
              className="rounded-lg p-1 text-[#4c5c3c] hover:bg-[#f7fbe9] hover:text-[#1f2f10] transition-colors disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {undoSuccess ? (
              <div className="text-center py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f3d2] text-[#90c639] mx-auto mb-4">
                  <Shield className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-semibold text-[#1f2f10] mb-2">Report Removed</h4>
                <p className="text-sm text-[#4c5c3c]">
                  Your report has been successfully removed. The content's status has been updated.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0f6e2] text-[#90c639] mx-auto mb-3">
                    <RotateCcw className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-semibold text-[#1f2f10] mb-2">Remove Your Report?</h4>
                  <p className="text-sm text-[#4c5c3c] mb-4">
                    Are you sure you want to undo your report? This action will remove your report from the system.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-[#f0f6e2] border border-lime-200 rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#90c639] mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-[#1f2f10]">{error}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleCloseUndoDialog()
                    }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 border border-lime-100 text-[#334125] rounded-full hover:border-[#90c639] hover:text-[#1f2f10] transition-colors disabled:cursor-not-allowed touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleUndoReport()
                    }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-[#90c639] text-white rounded-full hover:bg-[#7ab332] transition-colors disabled:cursor-not-allowed disabled:bg-lime-300 touch-manipulation flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Undo Report
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Login prompt render function
  const renderLoginPrompt = () => {
    if (!showLoginPrompt) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-lime-100 shadow-sm p-4">
          <div className="text-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f3d2] text-[#90c639] mx-auto mb-3">
              <LogIn className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-[#1f2f10] mb-2">Sign In Required</h3>
            <p className="text-sm text-[#4c5c3c]">
              Please sign in to report content and help keep our community safe.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowLoginPrompt(false)
              }}
              className="flex-1 px-4 py-2.5 border border-lime-100 text-[#334125] rounded-full hover:border-[#90c639] hover:text-[#1f2f10] transition-colors touch-manipulation"
            >
              Cancel
            </button>
            <Link
              href="/auth"
              className="flex-1 text-center px-4 py-2.5 bg-[#90c639] text-white rounded-full hover:bg-[#7ab332] transition-colors touch-manipulation"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Button variants
  if (variant === 'button') {
    return (
      <>
        <button
          type="button"
          onClick={(e) => handleReportClick(e)}
          className={`
            inline-flex items-center gap-1.5 rounded-full border
            ${hasReported
              ? 'border-[#90c639] bg-[#f7fbe9] text-[#90c639] hover:bg-[#e8f3d2] hover:border-[#7ab332]'
              : 'border-lime-200 bg-[#f0f6e2] text-[#90c639] hover:bg-[#e8f3d2] hover:border-[#90c639]'
            }
            transition-all duration-200 focus:outline-none focus:ring-2
            focus:ring-2 focus:ring-offset-1 focus:ring-[#e8f3d2]
            disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation
            ${sizeConfig.button} ${className}
          `}
        >
          {hasReported ? (
            <>
              <RotateCcw className={sizeConfig.icon} />
              Undo Report
            </>
          ) : (
            <>
              <Flag className={sizeConfig.icon} />
              Report
            </>
          )}
        </button>

        {renderDialog()}
        {renderUndoDialog()}
        {renderLoginPrompt()}
      </>
    )
  }

  // Icon variant (default)
  return (
    <>
      <button
        type="button"
        onClick={(e) => handleReportClick(e)}
        className={`
          flex items-center justify-center rounded-lg border p-1.5 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-1 touch-manipulation
          ${hasReported
            ? 'border-[#90c639] bg-[#f7fbe9] text-[#90c639] hover:bg-[#e8f3d2] hover:border-[#7ab332] focus:ring-[#e8f3d2]'
            : 'border-lime-200 bg-[#f0f6e2] text-[#90c639] hover:bg-[#e8f3d2] hover:border-[#90c639] focus:ring-[#e8f3d2]'
          }
          ${className}
        `}
        title={hasReported ? 'Undo report' : 'Report content'}
      >
        {hasReported ? (
          <RotateCcw className={sizeConfig.icon} />
        ) : (
          <Flag className={sizeConfig.icon} />
        )}
      </button>

      {renderDialog()}
      {renderUndoDialog()}
      {renderLoginPrompt()}
    </>
  )
}
