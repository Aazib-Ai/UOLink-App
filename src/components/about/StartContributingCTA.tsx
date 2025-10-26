'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import UploadModalLazy from '@/components/UploadModalLazy'
import { useAuth } from '@/contexts/AuthContext'

interface StartContributingCTAProps {
  className?: string
  label?: string
}

export default function StartContributingCTA({ className = '', label = 'Start Contributing' }: StartContributingCTAProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const handleClick = useCallback(() => {
    if (loading) {
      return
    }

    if (user) {
      setIsUploadModalOpen(true)
      return
    }

    router.push('/auth?mode=login')
  }, [loading, user, router])

  const handleCloseModal = useCallback(() => {
    setIsUploadModalOpen(false)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#90c639] to-[#5a7c27] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#90c639]/30 transition hover:shadow-[#90c639]/50 ${className}`.trim()}
      >
        {label}
      </button>
      <UploadModalLazy isOpen={isUploadModalOpen} onClose={handleCloseModal} />
    </>
  )
}
