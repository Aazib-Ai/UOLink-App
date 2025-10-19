import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { NotesContextProvider } from '@/contexts/NotesContextProvider'
import { SavedNotesContextProvider } from '@/contexts/SavedNotesContextProvider'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'UOLINK',
  description: 'A platform for sharing and accessing study materials',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <NotesContextProvider>
            <SavedNotesContextProvider>
              <div className="min-h-screen bg-gradient-to-r flex items-center flex-col from-yellow-50 to-amber-50">
                {children}
              </div>
            </SavedNotesContextProvider>
          </NotesContextProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
