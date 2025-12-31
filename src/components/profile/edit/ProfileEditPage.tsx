'use client'

import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '../../Navbar'
import ProfileEditForm from './ProfileEditForm'
import { useNavigationState } from '@/lib/cache/client'

export default function ProfileEditPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Enable state persistence for profile edit form (CRITICAL - unsaved user data)
  useNavigationState({
    selectors: {
      forms: '#profile-edit-form',
    },
    restoreOnMount: true,
    captureOnUnmount: true,
  })

  // Redirect if not authenticated
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-screen items-center justify-center bg-[#f6f9ee] pb-16 pt-24">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-lime-200/70 bg-white/80 px-6 py-8 text-sm font-semibold text-[#426014] shadow-lg backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin text-[#90c639]" />
            <span>Getting your profile ready...</span>
          </div>
        </div>
      </>
    )
  }

  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f6f9ee] pb-24 pt-24">
        <ProfileEditForm />
      </main>
    </>
  )
}