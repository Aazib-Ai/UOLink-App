'use client'

import { useState, useEffect } from 'react'
import UploadModal from './UploadModal'

interface AppWithScannerProps {
  children: React.ReactNode
}

export default function AppWithScanner({ children }: AppWithScannerProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [scannedFile, setScannedFile] = useState<File | null>(null)

  // Listen for upload modal open events
  useEffect(() => {
    const handleOpenUploadModal = () => {
      setIsUploadModalOpen(true)
    }

    window.addEventListener('openUploadModal', handleOpenUploadModal)
    
    return () => {
      window.removeEventListener('openUploadModal', handleOpenUploadModal)
    }
  }, [])

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false)
    setScannedFile(null)
  }

  const handleScanComplete = (file: File) => {
    setScannedFile(file)
    setIsUploadModalOpen(true)
  }

  return (
    <>
      {children}
      
      {/* Upload Modal with Scanner Integration */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={handleCloseUploadModal}
        scannedFile={scannedFile}
      />
    </>
  )
}