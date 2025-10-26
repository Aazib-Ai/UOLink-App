'use client'

import { useState } from 'react'
import Link from 'next/link'

import Navbar from '@/components/Navbar'
import { ScannerModalLazy } from '@/components/scanner/ScannerModalLazy'
import { useUploadForm, UploadForm, UploadStatusBanner } from '@/features/upload'

export default function UploadPage() {
  const uploadForm = useUploadForm(true) // Enable draft persistence for page
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const handleScannerComplete = (scannedFile: File) => {
    uploadForm.handleScannedFile(scannedFile)
    setIsScannerOpen(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const success = await uploadForm.handleSubmit(event)
    if (success) {
      uploadForm.resetForm()
    }
  }

  return (
    <>
      <ScannerModalLazy
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onComplete={handleScannerComplete}
      />
      <Navbar />
      <div className="container md:mt-24 mt-20 mx-auto px-4 pb-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-3xl border border-gray-200 bg-white/70 p-4 shadow-xl backdrop-blur-sm sm:p-6">
            <header className="text-center sm:text-left">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Upload material</h1>
            </header>

            <div className="mt-6">
              <UploadStatusBanner status={uploadForm.status} />
            </div>

            {!uploadForm.loading && !uploadForm.user && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-700 shadow-inner sm:text-base">
                You must{' '}
                <Link href="/auth" className="font-semibold underline">
                  sign in with your university email
                </Link>{' '}
                before uploading materials.
              </div>
            )}

            <div className="mt-6">
              <UploadForm
                onSubmit={handleSubmit}
                isActionDisabled={uploadForm.isActionDisabled}
                status={uploadForm.status}
                formData={uploadForm.formData}
                onFormDataChange={uploadForm.updateFormData}
                profileData={uploadForm.profileData}
                profileStatus={uploadForm.profileStatus}
                submitting={uploadForm.submitting}
                onScanRequest={() => setIsScannerOpen(true)}
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
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

