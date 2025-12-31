'use client'

import { useRouter } from 'next/navigation'
import { Loader2, Settings, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '../Navbar'
import PasswordChangeSection from './PasswordChangeSection'
import { useProfileEditForm } from '@/hooks/useProfileEditForm'
import { useNavigationState } from '@/lib/cache'

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { profileData } = useProfileEditForm()

  // Enable state persistence for forms (high priority for unsaved changes)
  useNavigationState({
    selectors: {
      forms: '#password-change-form',
    },
    restoreOnMount: true,
    captureOnUnmount: true,
  })

  // Redirect if not authenticated
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-screen items-center justify-center bg-[#f6f9ee] pb-16 pt-20 md:pt-24">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-lime-200/70 bg-white/80 px-6 py-8 text-sm font-semibold text-[#426014] shadow-lg backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin text-[#90c639]" />
            <span>Loading settings...</span>
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
      <main className="min-h-screen bg-[#f6f9ee] pb-16 pt-20 md:pt-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="mb-6 md:mb-8">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#426014] hover:text-[#2d460b] transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="relative overflow-hidden rounded-3xl border border-lime-200/70 bg-white/90 shadow-xl backdrop-blur">
              <div className="absolute -left-12 md:-left-24 top-[-48px] md:top-[-96px] h-32 md:h-56 w-32 md:w-56 rounded-full bg-[#e3f2c7] blur-2xl md:blur-3xl" />
              <div className="absolute -bottom-16 md:-bottom-28 right-[-36px] md:right-[-72px] h-40 md:h-72 w-40 md:w-72 rounded-full bg-[#d1f0a8] blur-2xl md:blur-3xl" />
              <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-12">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-[#90c639]/10 rounded-full flex-shrink-0">
                    <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-[#90c639]" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.35em] sm:tracking-[0.45em] text-[#5f7f2a]/80">
                      Account Settings
                    </p>
                    <h1 className="text-2xl sm:text-3xl md:text-[2.6rem] font-semibold text-gray-900 leading-tight">
                      Manage your account
                    </h1>
                  </div>
                </div>
                <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600 leading-relaxed">
                  Control your profile visibility and account preferences. Keep your information up to date and manage how others find you.
                </p>
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="space-y-4 sm:space-y-6">
            {/* Password Change Section */}
            <PasswordChangeSection />

            {/* Additional settings sections can be added here */}
            {/* For example: Account Privacy, Notifications, etc. */}

            <div className="rounded-2xl border border-lime-100 bg-white/90 p-4 sm:p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">
                  More coming soon
                </p>
                <h3 className="text-base sm:text-lg font-semibold text-[#1f2f10]">Additional Settings</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                More settings options will be available soon, including privacy controls, notification preferences, and account security settings.
                Usernames are now fixed to your university roll number and cannot be changed.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
