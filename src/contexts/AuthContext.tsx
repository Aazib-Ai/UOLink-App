'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  sendEmailVerification,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '@/lib/firebase'

const allowedEmailPattern = /^[^@]*\d{5,}@(student\.)?uol\.edu\.pk$/i

type AuthMode = 'login' | 'register'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  clearError: () => void
  signInWithGoogle: () => Promise<void>
  authenticateWithEmail: (email: string, password: string, mode: AuthMode) => Promise<void>
  signOut: () => Promise<void>
  sendVerificationEmail: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const sanitizeError = (error: unknown): string => {
  if (typeof error === 'string') return error
  if (error instanceof FirebaseError) {
    const code = error.code || ''
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered.'
      case 'auth/invalid-email':
        return 'Please enter a valid university email.'
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 8 characters.'
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled.'
      case 'auth/internal-error':
        return 'Registration failed due to a temporary issue. Please retry.'
      case 'auth/popup-blocked':
        return 'Popup blocked. Please disable popup blockers and try again.'
      case 'auth/popup-closed-by-user':
        return 'Popup closed before completing sign in.'
      case 'auth/account-exists-with-different-credential':
        return 'An account exists with different sign-in method. Use email sign-in.'
      case 'auth/unauthorized-domain':
        return 'Unauthorized domain. Check Firebase auth domain settings.'
      default:
        return error.message || 'Authentication failed. Please try again.'
    }
  }
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}

const ensureAllowedEmail = (email: string | null | undefined) => {
  if (!email) {
    throw new Error('A valid university email address is required.')
  }

  if (!allowedEmailPattern.test(email.trim())) {
    throw new Error('Only uol.edu.pk emails containing a roll number are allowed.')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.email) {
        if (allowedEmailPattern.test(currentUser.email)) {
          setUser(currentUser)
          setLoading(false)
          return
        }
        firebaseSignOut(auth).finally(() => {
          setUser(null)
          setError('Only uol.edu.pk emails containing a roll number can be used to sign in.')
          setLoading(false)
        })
        return
      }
      // Only set user to null and stop loading if we're sure there's no user
      // This prevents the flash of signed-out state during page reloads
      setUser(null)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result && result.user) {
          ensureAllowedEmail(result.user.email)
          setUser(result.user)
        }
      } catch (err) {
        await firebaseSignOut(auth).catch(() => undefined)
        setUser(null)
        setError(sanitizeError(err))
      }
    }

    // Process any pending redirect sign-in result after mount
    handleRedirectResult()
  }, [])

  const signInWithGoogle = async () => {
    try {
      setError(null)
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account', hd: 'uol.edu.pk' })
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const isIOS = /iPhone|iPad|iPod/.test(ua)
      const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)
      const preferRedirect = isIOS || isSafari

      if (preferRedirect) {
        await signInWithRedirect(auth, provider)
        return
      }

      try {
        const result = await signInWithPopup(auth, provider)
        ensureAllowedEmail(result.user.email)
        setUser(result.user)
      } catch (popupError) {
        const code = (popupError as FirebaseError)?.code || ''
        const shouldFallback =
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/operation-not-supported-in-this-environment'

        if (shouldFallback) {
          await signInWithRedirect(auth, provider)
          return
        }
        throw popupError
      }
    } catch (err) {
      await firebaseSignOut(auth).catch(() => undefined)
      setUser(null)
      setError(sanitizeError(err))
      throw err
    }
  }

  const authenticateWithEmail = async (email: string, password: string, mode: AuthMode) => {
    try {
      setError(null)
      ensureAllowedEmail(email)
      if (mode === 'register') {
        const { user: createdUser } = await createUserWithEmailAndPassword(auth, email, password)
        ensureAllowedEmail(createdUser.email)
        try {
          await sendEmailVerification(createdUser)
        } catch (e) {
          // Non-blocking: proceed even if verification email fails
        }
        setUser(createdUser)
      } else {
        const { user: loggedInUser } = await signInWithEmailAndPassword(auth, email, password)
        ensureAllowedEmail(loggedInUser.email)
        setUser(loggedInUser)
      }
    } catch (err) {
      setError(sanitizeError(err))
      throw err
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
  }

  const sendVerificationEmail = async () => {
    try {
      setError(null)
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be signed in to request a verification email.')
      }
      await sendEmailVerification(currentUser)
    } catch (err) {
      setError(sanitizeError(err))
      throw err
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      clearError: () => setError(null),
      signInWithGoogle,
      authenticateWithEmail,
      signOut,
      sendVerificationEmail,
    }),
    [user, loading, error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
