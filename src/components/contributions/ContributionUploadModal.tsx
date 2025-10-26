'use client'

import { useUpload } from '@/contexts/UploadContext'
import UploadModalLazy from '@/components/UploadModalLazy'
import { ScannerModalLazy } from '@/components/scanner/ScannerModalLazy'

export default function ContributionUploadModal() {
  const {
    isUploadModalOpen,
    isScannerOpen,
    scannedFile,
    closeUploadModal,
    openScanner,
    closeScanner,
    handleScanComplete,
    handleUploadSuccess,
  } = useUpload()

  return (
    <>
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
        onScanRequest={openScanner}
        scannedFile={scannedFile}
        onSuccess={handleUploadSuccess}
      />

      <ScannerModalLazy
        isOpen={isScannerOpen}
        onClose={closeScanner}
        onComplete={handleScanComplete}
      />
    </>
  )
}