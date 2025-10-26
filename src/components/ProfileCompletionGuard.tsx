'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { checkProfileCompletion, checkRequiredProfileFields } from '@/lib/profile/completion'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import Link from 'next/link'

interface ProfileCompletionGuardProps {
  children: React.ReactNode
  redirectTo?: string
  showWarning?: boolean
}

export default function ProfileCompletionGuard({
  children,
  redirectTo = '/complete-profile',
  showWarning = true
}: ProfileCompletionGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isCheckingProfile, setIsCheckingProfile] = useState(true)
  const [isProfileComplete, setIsProfileComplete] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])

  useEffect(() => {
    const checkProfile = async () => {
      if (loading) return

      if (!user) {
        router.push('/auth')
        return
      }

      try {
        setIsCheckingProfile(true)

        // Check if profile is completed
        const completed = await checkProfileCompletion()
        setIsProfileComplete(completed)

        if (!completed) {
          // Get missing fields for better error message
          const { missingFields: fields } = await checkRequiredProfileFields()
          setMissingFields(fields)

          if (showWarning) {
            // Don't redirect immediately, show warning first
            return
          } else {
            // Redirect immediately
            router.push(redirectTo)
            return
          }
        }
      } catch (error) {
        console.error('Error checking profile completion:', error)
        setIsProfileComplete(false)
        setMissingFields(['Unable to verify profile status'])
      } finally {
        setIsCheckingProfile(false)
      }
    }

    checkProfile()
  }, [user, loading, router, redirectTo, showWarning])

  // Show loading state while checking
  if (loading || isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#90c639] mx-auto mb-4"></div>
          <p className="text-gray-600">Checking profile status...</p>
        </div>
      </div>
    )
  }

  // Show profile completion warning if profile is not complete and warning is enabled
  if (!isProfileComplete && showWarning && missingFields.length > 0) {
    return (
      <div className="min-h-screen bg-yellow-50 pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-amber-100">
            {/* Warning Icon */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
            </div>

            {/* Warning Message */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-3">
                Complete Your Profile
              </h1>
              <p className="text-gray-600 text-lg mb-4">
                You need to complete your profile before accessing this feature.
              </p>

              {/* Missing Fields List */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-amber-800 mb-2">Missing Information:</h3>
                <ul className="text-left text-amber-700 space-y-1">
                  {missingFields.map((field, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-gray-500 text-sm">
                This information helps make your contributions more valuable to other students.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/complete-profile"
                className="inline-flex items-center justify-center rounded-lg bg-[#90c639] px-6 py-3 font-semibold text-white transition-all hover:bg-[#7ab332]"
              >
                Complete Profile Now
              </Link>

              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If profile is complete or warning is disabled, show children
  return <>{children}</>
}