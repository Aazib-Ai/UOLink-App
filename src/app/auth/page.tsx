'use client'

import { FormEvent, useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import UploadModalLazy from '@/components/UploadModalLazy'

export default function AuthPage() {
  const {
    user,
    signInWithGoogle,
    authenticateWithEmail,
    sendVerificationEmail,
    error,
    clearError
  } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setVerificationMessage(null)
    clearError()

    if (mode === 'register' && password !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)
      await authenticateWithEmail(email.trim(), password, mode)
      if (mode === 'register') {
        setStatus('Registration successful! Check your university inbox for a verification email before continuing.')
        setVerificationMessage(`A verification link was sent to ${email.trim()}.`)
        return
      }

      setStatus('Signed in successfully. Redirecting to dashboard...')
      router.push('/')
    } catch (authError) {
      setStatus(typeof authError === 'string' ? authError : null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setStatus(null)
    setVerificationMessage(null)
    clearError()
    try {
      setSubmitting(true)
      await signInWithGoogle()

      // For Google Sign-In, we need to determine if this is a new user or existing user
      // Since we can't easily determine this from the auth context, we'll redirect to dashboard
      // New users can navigate to profile edit from the dashboard if needed
      setStatus('Signed in with Google successfully. Redirecting to dashboard...')
      router.push('/')
    } catch {
      setStatus(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    setVerificationMessage(null)
    try {
      setResendingVerification(true)
      await sendVerificationEmail()
      setVerificationMessage('Verification email sent. Please check your inbox and spam folder.')
    } catch (err) {
      setVerificationMessage(
        err instanceof Error ? err.message : 'Unable to send verification email right now. Please try again later.'
      )
    } finally {
      setResendingVerification(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="container md:mt-24 mt-20 mx-auto px-4 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <h1 className="text-3xl font-bold text-center mb-6">Become a Contributor</h1>

            {user && (
              <div
                className={`mb-6 rounded-lg border p-4 ${
                  user.emailVerified
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {user.emailVerified ? (
                  <>
                    You are signed in as <strong>{user.email}</strong>.{' '}
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="underline font-semibold hover:no-underline"
                    >
                      Upload materials
                    </button>{' '}
                    to share your knowledge.
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Verify your email to continue contributing.</p>
                    <p className="mt-2 text-sm">
                      We sent a verification link to <strong>{user.email}</strong>. Open it to activate your account
                      fully.
                    </p>
                    {verificationMessage && (
                      <p className="mt-2 text-xs">
                        {verificationMessage}
                      </p>
                    )}
                    <button
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="mt-3 inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-400"
                    >
                      {resendingVerification ? 'Sending...' : 'Resend verification email'}
                    </button>
                    <p className="mt-2 text-xs text-amber-700">
                      After verifying, refresh this page or sign in again to continue.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-6">
                <h3 className="text-xl font-semibold mb-3">Eligibility</h3>
                <p className="text-gray-700">
                  Only official University of Lahore student emails are allowed. Use an address like <code>12345678@student.uol.edu.pk</code>.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between rounded-full bg-gray-100 p-1">
                <button
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-black shadow' : 'text-gray-500 hover:text-black'}`}
                  onClick={() => {
                    setMode('login')
                    clearError()
                    setStatus(null)
                    setVerificationMessage(null)
                  }}
                  type="button"
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white text-black shadow' : 'text-gray-500 hover:text-black'}`}
                  onClick={() => {
                    setMode('register')
                    clearError()
                    setStatus(null)
                    setVerificationMessage(null)
                  }}
                  type="button"
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuth} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">University Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="12345678@student.uol.edu.pk"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="Enter your password"
                    required
                    minLength={8}
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                      placeholder="Re-enter your password"
                      required
                    />
                  </div>
                )}

                {(error || status) && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}
                  >
                    {error || status}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-black px-6 py-3 font-semibold text-white transition-all hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Register'}
                </button>
              </form>

              <div className="mt-8 flex items-center">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="px-4 text-sm text-gray-500">OR</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-all hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span role="img" aria-label="Google">
                  🔐
                </span>
                Continue with Google
              </button>

              <p className="mt-6 text-center text-sm text-gray-500">
                Having trouble? Contact{' '}
                <a href="mailto:contribute@uolink.com" className="font-semibold text-[#90c639] underline">
                  contribute@uolink.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </>
  )
}
