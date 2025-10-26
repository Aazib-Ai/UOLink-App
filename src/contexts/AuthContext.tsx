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
  signOut as firebaseSignOut,
  sendEmailVerification,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

const allowedEmailPattern = /^\d{8}@student\.uol\.edu\.pk$/i

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
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}

const ensureAllowedEmail = (email: string | null | undefined) => {
  if (!email) {
    throw new Error('A valid university email address is required.')
  }

  if (!allowedEmailPattern.test(email.trim())) {
    throw new Error('Only university emails (8 digits @student.uol.edu.pk) are allowed.')
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
          setError('Only university emails (8 digits @student.uol.edu.pk) can be used to sign in.')
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

  const signInWithGoogle = async () => {
    try {
      setError(null)
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      ensureAllowedEmail(result.user.email)
      setUser(result.user)
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
        await sendEmailVerification(createdUser)
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
