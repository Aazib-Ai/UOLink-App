'use client'

import { useState, useEffect } from 'react'
import { Flag, AlertTriangle, X, Shield, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { reportContent, getReportStatus } from '@/lib/firebase'
import Link from 'next/link'

interface ReportButtonProps {
  noteId: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'button' | 'icon'
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
  variant = 'icon'
}: ReportButtonProps) {
  const { user } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [hasReported, setHasReported] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
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

  const handleReportClick = () => {
    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (hasReported) {
      setError('You have already reported this content')
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
      await reportContent(noteId, selectedReason, description.trim())
      setHasReported(true)
      setReportCount(prev => prev + 1)
      setSuccess(true)
      setSelectedReason('')
      setDescription('')

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

  const handleCloseDialog = () => {
    if (!isSubmitting && !success) {
      setShowDialog(false)
      setSelectedReason('')
      setDescription('')
      setError(null)
    }
  }

  // Dialog render function
  const renderDialog = () => {
    if (!showDialog) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className={`w-full ${sizeConfig.dialog} bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Report Content</h3>
                <p className="text-xs text-gray-600">Help keep our community safe</p>
              </div>
            </div>
            <button
              onClick={handleCloseDialog}
              disabled={isSubmitting || success}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {success ? (
              <div className="text-center py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
                  <Shield className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Report Submitted</h4>
                <p className="text-sm text-gray-600">
                  Thank you for helping keep our community safe. We'll review this content soon.
                </p>
              </div>
            ) : (
              <>
                {/* Report Reasons */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Why are you reporting this content?
                  </label>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className={`
                          flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${selectedReason === reason
                            ? 'border-red-300 bg-red-50 ring-2 ring-red-200'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
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
                            ? 'border-red-500 bg-red-500'
                            : 'border-gray-300'
                          }
                        `}>
                          {selectedReason === reason && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{reason}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide any additional context that might help us review this content..."
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 text-sm"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {description.length}/500 characters
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-not-allowed touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={isSubmitting || !selectedReason}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 touch-manipulation flex items-center justify-center gap-2"
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

  // Login prompt render function
  const renderLoginPrompt = () => {
    if (!showLoginPrompt) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4">
          <div className="text-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mx-auto mb-3">
              <LogIn className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign In Required</h3>
            <p className="text-sm text-gray-600">
              Please sign in to report content and help keep our community safe.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation"
            >
              Cancel
            </button>
            <Link
              href="/auth"
              className="flex-1 text-center px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors touch-manipulation"
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
          onClick={handleReportClick}
          className={`
            inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600
            transition-all duration-200 hover:bg-red-100 hover:border-red-300
            focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-1
            disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation
            ${sizeConfig.button} ${className}
          `}
          disabled={hasReported}
        >
          <Flag className={sizeConfig.icon} />
          {hasReported ? 'Reported' : 'Report'}
          {reportCount > 0 && (
            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-xs font-semibold">
              {reportCount}
            </span>
          )}
        </button>

        {renderDialog()}
        {renderLoginPrompt()}
      </>
    )
  }

  // Icon variant (default)
  return (
    <>
      <button
        onClick={handleReportClick}
        className={`
          flex items-center justify-center rounded-lg border border-red-200 bg-red-50
          text-red-600 hover:bg-red-100 hover:border-red-300 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-1
          p-1.5 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation
          ${className}
        `}
        disabled={hasReported}
        title={hasReported ? 'Already reported' : 'Report content'}
      >
        <Flag className={sizeConfig.icon} />
        {reportCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
            {reportCount > 9 ? '9+' : reportCount}
          </span>
        )}
      </button>

      {renderDialog()}
      {renderLoginPrompt()}
    </>
  )
}