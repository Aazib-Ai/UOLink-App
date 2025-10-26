'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'
import { useUploadForm, UploadForm, UploadStatusBanner } from '@/features/upload'
import dynamic from 'next/dynamic'

// Dynamically import ScannerModal to avoid SSR issues
const ScannerModal = dynamic(() => import('./scanner/ScannerModal'), { ssr: false })

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onScanRequest?: () => void
  scannedFile?: File | null
}

export default function UploadModal({ isOpen, onClose, onScanRequest, scannedFile }: UploadModalProps) {
  const uploadForm = useUploadForm(false) // No draft persistence for modal
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const handleOpenScanner = () => {
    setIsScannerOpen(true)
  }

  const handleScannerClose = () => {
    setIsScannerOpen(false)
  }

  const handleScannerComplete = (file: File) => {
    // Handle the scanned document file
    uploadForm.handleScannedFile(file)
    setIsScannerOpen(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const success = await uploadForm.handleSubmit(event)
    if (success) {
      // Reset form and close modal after successful upload
      setTimeout(() => {
        uploadForm.resetForm()
        onClose()
      }, 2000)
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle scanned file from parent
  useEffect(() => {
    if (scannedFile) {
      console.log('[UploadModal] Received scanned file:', scannedFile.name)
      uploadForm.handleScannedFile(scannedFile)
    }
  }, [scannedFile, uploadForm.handleScannedFile])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Upload material</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-amber-50 transition-colors group"
          >
            <X className="w-5 h-5 text-gray-500 group-hover:text-[#90c639] transition-colors" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-6">
          {!uploadForm.loading && !uploadForm.user && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-700 shadow-inner">
              You must{' '}
              <Link href="/auth" className="font-semibold underline">
                sign in with your university email
              </Link>{' '}
              before uploading materials.
            </div>
          )}

          <UploadStatusBanner status={uploadForm.status} />

          <UploadForm
            onSubmit={handleSubmit}
            isActionDisabled={uploadForm.isActionDisabled}
            status={uploadForm.status}
            formData={uploadForm.formData}
            onFormDataChange={uploadForm.updateFormData}
            profileData={uploadForm.profileData}
            profileStatus={uploadForm.profileStatus}
            submitting={uploadForm.submitting}
            onScanRequest={handleOpenScanner}
            fileInputRef={uploadForm.fileInputRef}
            subjectError={uploadForm.subjectError}
            teacherWarning={uploadForm.teacherWarning}
            onSubjectErrorChange={uploadForm.setSubjectError}
            onTeacherWarningChange={uploadForm.setTeacherWarning}
            teacherOverrideConfirmed={uploadForm.teacherOverrideConfirmed}
            onTeacherOverrideConfirmedChange={uploadForm.setTeacherOverrideConfirmed}
            subjectSuggestions={uploadForm.subjectSuggestions}
            teacherSuggestions={uploadForm.teacherSuggestions}
            materialTypeLabel={uploadForm.materialTypeLabel}
            showSequenceDropdown={uploadForm.showSequenceDropdown}
            materialSequencePlaceholder={uploadForm.materialSequencePlaceholder}
            onSubjectChange={uploadForm.handleSubjectChange}
            onSubjectBlur={uploadForm.handleSubjectBlur}
            onTeacherChange={uploadForm.handleTeacherChange}
            onTeacherBlur={uploadForm.handleTeacherBlur}
            handleFileChange={uploadForm.handleFileChange}
            submitButtonStyle="modal"
          />
        </div>
      </div>

      {/* Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={handleScannerClose}
        onComplete={handleScannerComplete}
      />
    </div>
  )
}
