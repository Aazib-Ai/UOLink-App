'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { applyActionCode } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '@/lib/firebase'

type ActionStatus = 'loading' | 'success' | 'error'

interface ViewState {
  status: ActionStatus
  heading: string
  message: string
  detail?: string
}

const initialState: ViewState = {
  status: 'loading',
  heading: 'Checking your link',
  message: 'Hang tight while we verify your request.',
}

const sanitizeFirebaseError = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/expired-action-code':
        return 'This verification link has expired. Request a new email from the sign-in page.'
      case 'auth/invalid-action-code':
        return 'This verification link is invalid or has already been used.'
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact support if you believe this is a mistake.'
      default:
        return 'We could not verify this link. Please request a fresh email and try again.'
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Something went wrong while processing this link.'
}

const ActionStatusIcon = ({ status }: { status: ActionStatus }) => {
  if (status === 'loading') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#90c639]/40 bg-white">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#90c639] border-t-transparent" />
      </span>
    )
  }

  if (status === 'success') {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#90c639]/15 text-[#4a6b12]">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8">
          <path
            d="M9.5 16.25 5.75 12.5l1.77-1.77L9.5 12.71l7-7 1.77 1.77-8.77 8.77Z"
            fill="currentColor"
          />
        </svg>
      </span>
    )
  }

  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8">
        <path
          d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18.25A8.25 8.25 0 1 1 20.25 12 8.26 8.26 0 0 1 12 20.25Zm1-5.25v2h-2v-2Zm0-8v6h-2v-6Z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}

function AuthActionPage() {
  const searchParams = useSearchParams()
  const [viewState, setViewState] = useState<ViewState>(initialState)
  const [continuePath, setContinuePath] = useState<string | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) {
      return
    }
    handledRef.current = true

    const mode = searchParams.get('mode')
    const oobCode = searchParams.get('oobCode')
    const continueUrlParam = searchParams.get('continueUrl')

    if (continueUrlParam && continueUrlParam.startsWith('/')) {
      setContinuePath(continueUrlParam)
    }

    if (!mode || !oobCode) {
      setViewState({
        status: 'error',
        heading: 'Link not valid',
        message: 'We could not read the information in this link.',
        detail: 'Try opening the verification email again or request a fresh link from the sign-in page.',
      })
      return
    }

    const processAction = async () => {
      switch (mode) {
        case 'verifyEmail':
          try {
            setViewState({
              status: 'loading',
              heading: 'Verifying your email',
              message: 'This only takes a moment.',
            })
            await applyActionCode(auth, oobCode)
            await auth.currentUser?.reload().catch(() => undefined)
            setViewState({
              status: 'success',
              heading: 'Email verified!',
              message: 'Your university email address is confirmed. You can now sign in and start contributing.',
              detail: 'You can close this tab or continue back into Uolink.',
            })
          } catch (error) {
            setViewState({
              status: 'error',
              heading: 'We could not verify this link',
              message: sanitizeFirebaseError(error),
              detail: 'Return to the app and request a new verification email to continue.',
            })
          }
          break
        default:
          setViewState({
            status: 'error',
            heading: 'Unsupported link',
            message: 'This action is not available yet.',
            detail: 'Update the app or request a new email to continue.',
          })
      }
    }

    processAction()
  }, [searchParams])

  const renderActions = () => {
    if (viewState.status === 'loading') {
      return null
    }

    if (viewState.status === 'success') {
      const successHref = continuePath ?? '/'
      const successLabel = continuePath ? 'Continue to your destination' : 'Go to dashboard'
      return (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={successHref}
            className="inline-flex items-center justify-center rounded-lg bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7cab2f]"
          >
            {successLabel}
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-black"
          >
            Back to sign in
          </Link>
        </div>
      )
    }

    return (
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/auth"
          className="inline-flex items-center justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-900"
        >
          Return to sign in
        </Link>
        <a
          href="mailto:contribute@uolink.com"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-black"
        >
          Contact support
        </a>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#f4fbe8] via-white to-white">
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl flex-col items-center justify-center px-4 pb-16 pt-28 sm:px-6">
          <div className="w-full rounded-3xl border border-gray-100 bg-white/90 p-8 text-center shadow-lg backdrop-blur">
            <div className="flex flex-col items-center gap-4">
              <ActionStatusIcon status={viewState.status} />
              <h1 className="text-3xl font-semibold text-gray-900">{viewState.heading}</h1>
              <p className="text-sm text-gray-600">{viewState.message}</p>
              {viewState.detail && (
                <p className="text-xs text-gray-500">{viewState.detail}</p>
              )}
              {renderActions()}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export default function AuthActionPageWrapper() {
  return (
    <Suspense fallback={
      <>
        <Navbar />
        <main className="min-h-screen bg-gradient-to-b from-[#f4fbe8] via-white to-white">
          <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl flex-col items-center justify-center px-4 pb-16 pt-28 sm:px-6">
            <div className="w-full rounded-3xl border border-gray-100 bg-white/90 p-8 text-center shadow-lg backdrop-blur">
              <div className="flex flex-col items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#90c639]/40 bg-white">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#90c639] border-t-transparent" />
                </span>
                <h1 className="text-3xl font-semibold text-gray-900">Loading...</h1>
                <p className="text-sm text-gray-600">Hang tight while we verify your request.</p>
              </div>
            </div>
          </div>
        </main>
      </>
    }>
      <AuthActionPage />
    </Suspense>
  )
}
