'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface UploadContextType {
  isUploadModalOpen: boolean
  isScannerOpen: boolean
  scannedFile: File | null
  openUploadModal: () => void
  closeUploadModal: () => void
  openScanner: () => void
  closeScanner: () => void
  setScannedFile: (file: File | null) => void
  handleScanComplete: (file: File) => void
  handleUploadSuccess: () => void
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

export function useUpload() {
  const context = useContext(UploadContext)
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return context
}

interface UploadProviderProps {
  children: ReactNode
  onUploadSuccess?: () => void
}

export function UploadProvider({ children, onUploadSuccess }: UploadProviderProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannedFile, setScannedFile] = useState<File | null>(null)

  const openUploadModal = useCallback(() => {
    setIsUploadModalOpen(true)
  }, [])

  const closeUploadModal = useCallback(() => {
    setIsUploadModalOpen(false)
    setScannedFile(null)
  }, [])

  const openScanner = useCallback(() => {
    setIsScannerOpen(true)
    setIsUploadModalOpen(false)
  }, [])

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false)
    setScannedFile(null)
  }, [])

  const handleScanComplete = useCallback((file: File) => {
    setScannedFile(file)
    setIsScannerOpen(false)
    setIsUploadModalOpen(true)
  }, [])

  const handleUploadSuccess = useCallback(() => {
    closeUploadModal()
    onUploadSuccess?.()
  }, [closeUploadModal, onUploadSuccess])

  const value: UploadContextType = {
    isUploadModalOpen,
    isScannerOpen,
    scannedFile,
    openUploadModal,
    closeUploadModal,
    openScanner,
    closeScanner,
    setScannedFile,
    handleScanComplete,
    handleUploadSuccess,
  }

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  )
}

export default UploadContext