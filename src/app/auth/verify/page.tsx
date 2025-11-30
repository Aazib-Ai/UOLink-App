'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import EmailVerificationIllustration from '@/components/EmailVerificationIllustration'

export default function VerifyEmailPage() {
    const { user, sendVerificationEmail, signInWithGoogle, loading } = useAuth()
    const router = useRouter()
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [resendCount, setResendCount] = useState(0)
    const [lastResendTime, setLastResendTime] = useState(0)

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/auth')
            } else if (user.emailVerified) {
                router.push('/')
            }
        }
    }, [user, loading, router])

    const handleResend = async () => {
        const now = Date.now()
        if (resendCount >= 3 && now - lastResendTime < 3600000) {
            setResendStatus('error')
            setErrorMessage('You have reached the maximum number of resends for now. Please try again in an hour.')
            return
        }

        try {
            setResendStatus('sending')
            setErrorMessage(null)
            await sendVerificationEmail()
            setResendStatus('sent')
            setResendCount(prev => prev + 1)
            setLastResendTime(now)
        } catch (error) {
            setResendStatus('error')
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send verification email.')
        }
    }

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle()
            // AuthContext will handle the redirect if successful
        } catch (error) {
            console.error('Google sign in failed', error)
        }
    }

    if (loading || !user) {
        return (
            <>
                <Navbar />
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
                </div>
            </>
        )
    }

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="p-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Verify your email</h2>
                            <p className="text-gray-600 mb-6">
                                We've sent a verification link to <span className="font-semibold text-black">{user.email}</span>
                            </p>
                        </div>

                        <EmailVerificationIllustration />

                        <div className="space-y-6 mt-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <p className="font-semibold mb-1">Can't find the email?</p>
                                <ul className="list-disc list-inside space-y-1 ml-1">
                                    <li>Check your spam or junk folder</li>
                                    <li>Wait a few minutes (it can take up to 5 mins)</li>
                                    <li>Search for "Uolink Verification"</li>
                                </ul>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={handleResend}
                                    disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                    ${resendStatus === 'sent' ? 'bg-green-600 hover:bg-green-700' : 'bg-black hover:bg-gray-800'} 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                                >
                                    {resendStatus === 'sending' ? 'Sending...' : resendStatus === 'sent' ? 'Email Sent!' : 'Resend Verification Email'}
                                </button>

                                {errorMessage && (
                                    <p className="text-red-600 text-sm text-center">{errorMessage}</p>
                                )}

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleGoogleSignIn}
                                    className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-colors"
                                >
                                    <span role="img" aria-label="Google">🔐</span>
                                    Google
                                </button>
                            </div>

                            <div className="text-center text-sm text-gray-500 mt-6">
                                <p>Still having trouble?</p>
                                <a href="mailto:support@uolink.com" className="font-medium text-green-600 hover:text-green-500">
                                    Contact Support
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
