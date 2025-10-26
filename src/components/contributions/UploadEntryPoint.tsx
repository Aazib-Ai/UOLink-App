'use client'

import { Camera } from 'lucide-react'
import { useUpload } from '@/contexts/UploadContext'

interface UploadEntryPointProps {
  contributorDisplayName: string
}

export default function UploadEntryPoint({
  contributorDisplayName
}: UploadEntryPointProps) {
  const { openUploadModal } = useUpload()

  return (
    <button
      type="button"
      onClick={openUploadModal}
      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#90c639] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white/95"
    >
      <Camera className="h-4 w-4" />
      Upload new note
    </button>
  )
}