import type { Metadata, Viewport } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { Inter } from 'next/font/google'
import './globals.css'
import '@/styles/pwa.css'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import { NotesContextProvider } from '@/contexts/NotesContextProvider'
import { SavedNotesContextProvider } from '@/contexts/SavedNotesContextProvider'
import { UserInteractionsProvider } from '@/contexts/UserInteractionsContext'
import { DashboardStateProvider } from '@/hooks/useDashboardState'
import { AuthProvider } from '@/contexts/AuthContext'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import PWAUpdateNotification from '@/components/PWAUpdateNotification'
import OfflineBanner from '@/components/OfflineBanner'
import SplashScreen from '@/components/SplashScreen'
import MainContent from '@/components/MainContent'
import PWAProvider from '@/components/PWAProvider'
import { SplashProvider } from '@/contexts/SplashContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://uolink.com'),
  applicationName: 'UoLink',
  title: {
    default: 'UoLink - University Notes & Study Hub',
    template: '%s | UoLink',
  },
  description: 'Share, discover and collaborate on university notes with your peers. Access study materials offline with our progressive web app.',
  keywords: [
    'uolink',
    'uo link',
    'uollink',
    'university notes',
    'study hub',
    'education',
    'student collaboration',
    'campus resources',
  ],
  authors: [{ name: 'UoLink Team' }],
  creator: 'UoLink',
  publisher: 'UoLink',
  category: 'Education',
  referrer: 'origin-when-cross-origin',
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
      'en-GB': '/',
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/Icon.png',
    shortcut: '/Icon.png',
    apple: '/Icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UoLink',
  },
  appLinks: {
    web: {
      url: 'https://uolink.com',
    },
  },
  openGraph: {
    type: 'website',
    url: '/',
    locale: 'en_US',
    siteName: 'UoLink',
    title: 'UoLink - University Notes & Study Hub',
    description: 'Share, discover and collaborate on university notes with your peers',
    images: [
      {
        url: '/Icon.png',
        width: 512,
        height: 512,
        alt: 'UoLink Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UoLink - University Notes & Study Hub',
    description: 'Share, discover and collaborate on university notes with your peers',
    images: ['/Icon.png'],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#90c639' },
    { media: '(prefers-color-scheme: dark)', color: '#90c639' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await nextHeaders()).get('x-csp-nonce') || undefined
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/Icon.png" />
        <link rel="apple-touch-icon" href="/Icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="UoLink" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'UoLink',
              alternateName: ['UoLink', 'Uollink', 'Uo Link'],
              url: 'https://uolink.com',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://uolink.com/search?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />

      </head>
      <body className={inter.className}>
        <PWAProvider>
          <SplashProvider>
            <AuthProvider>
              <UserInteractionsProvider>
                <NotesContextProvider>
                  <SavedNotesContextProvider>
                    <DashboardStateProvider>
                    <SplashScreen />
                    <MainContent>
                      <OfflineBanner />
                      <div className="min-h-screen bg-gradient-to-r flex flex-col from-yellow-50 to-amber-50 mobile-viewport">
                        {children}
                      </div>
                      <PWAInstallPrompt />
                      <PWAUpdateNotification />
                    </MainContent>
                    </DashboardStateProvider>
                  </SavedNotesContextProvider>
                </NotesContextProvider>
              </UserInteractionsProvider>
            </AuthProvider>
          </SplashProvider>
        </PWAProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
