'use client'

import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  noteTitle: string
  noteSubject: string
  isDeleting?: boolean
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  noteTitle,
  noteSubject,
  isDeleting = false
}: DeleteConfirmModalProps) {

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, isDeleting])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isDeleting ? undefined : onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Delete Note</h2>
          </div>
          {!isDeleting && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <X className="w-5 h-5 text-gray-500 group-hover:text-red-600 transition-colors" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning Message */}
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-amber-800 font-medium text-sm">
              ⚠️ This action cannot be undone
            </p>
          </div>

          {/* Note Details */}
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Are you sure you want to delete this note?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="font-semibold text-gray-900">{noteTitle || 'Untitled Note'}</p>
              <p className="text-sm text-gray-600 mt-1">Subject: {noteSubject || 'Unknown'}</p>
            </div>
          </div>

          {/* Consequences */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">This will permanently delete:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• The stored document file</li>
              <li>• All associated metadata</li>
              <li>• Any comments and interactions</li>
              <li>• Download history and statistics</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Delete Note
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
