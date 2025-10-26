'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'
import { ScannerModalLazy } from '@/components/scanner/ScannerModalLazy'

interface ScannerEntryPointProps {
  onScanComplete: (file: File) => void
  buttonText?: string
  buttonClassName?: string
}

export default function ScannerEntryPoint({
  onScanComplete,
  buttonText = 'Scan Document',
  buttonClassName = "inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
}: ScannerEntryPointProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const handleScannerComplete = (file: File) => {
    setIsScannerOpen(false)
    onScanComplete(file)
  }

  const handleScannerClose = () => {
    setIsScannerOpen(false)
  }

  const openScanner = () => {
    setIsScannerOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={openScanner}
        className={buttonClassName}
      >
        <Camera className="h-4 w-4" />
        {buttonText}
      </button>

      <ScannerModalLazy
        isOpen={isScannerOpen}
        onClose={handleScannerClose}
        onComplete={handleScannerComplete}
      />
    </>
  )
}