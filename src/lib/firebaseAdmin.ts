import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const getPrivateKey = () => {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY
  if (!key) {
    throw new Error(
      'FIREBASE_ADMIN_PRIVATE_KEY is not set. Add it to your environment configuration (GOOGLE_PRIVATE_KEY is accepted for backwards compatibility).'
    )
  }
  return key.replace(/\\n/g, '\n')
}

const ensureApp = () => {
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing. Check your environment variables.')
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL

  if (!clientEmail) {
    throw new Error(
      'FIREBASE_ADMIN_CLIENT_EMAIL is missing. Set it in your environment variables (GOOGLE_CLIENT_EMAIL is accepted for backwards compatibility).'
    )
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail,
        privateKey: getPrivateKey(),
      }),
    })
  }
}

export const getAdminAuth = () => {
  ensureApp()
  return getAuth()
}

export const getAdminDb = () => {
  ensureApp()
  return getFirestore()
}
