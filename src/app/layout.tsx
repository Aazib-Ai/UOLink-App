import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@/styles/pwa.css'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import { NotesContextProvider } from '@/contexts/NotesContextProvider'
import { SavedNotesContextProvider } from '@/contexts/SavedNotesContextProvider'
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Check if app is installed (PWA) and create immediate splash
              if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
                // Create splash overlay immediately
                const splashOverlay = document.createElement('div');
                splashOverlay.className = 'pwa-splash-overlay';
                splashOverlay.innerHTML = \`
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                    <div style="width: 96px; height: 96px; background: white; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                      <img src="/Icon.png" alt="UoLink" style="width: 64px; height: 64px;" />
                    </div>
                    <div style="text-align: center;">
                      <h1 style="font-size: 24px; font-weight: bold; color: white; margin: 0 0 8px 0;">UoLink</h1>
                      <p style="color: rgba(251, 191, 36, 0.8); margin: 0;">University Notes & Study Hub</p>
                    </div>
                    <div style="display: flex; gap: 4px; margin-top: 32px;">
                      <div style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: bounce 1s infinite;"></div>
                      <div style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: bounce 1s infinite 0.1s;"></div>
                      <div style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: bounce 1s infinite 0.2s;"></div>
                    </div>
                  </div>
                \`;
                
                // Add bounce animation
                const style = document.createElement('style');
                style.textContent = \`
                  @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                  }
                \`;
                document.head.appendChild(style);
                document.body.appendChild(splashOverlay);
                
                // Remove splash after 2 seconds
                setTimeout(() => {
                  document.body.classList.add('splash-complete');
                  setTimeout(() => {
                    if (splashOverlay.parentNode) {
                      splashOverlay.parentNode.removeChild(splashOverlay);
                    }
                  }, 500);
                }, 2000);
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <PWAProvider>
          <SplashProvider>
            <AuthProvider>
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
            </AuthProvider>
          </SplashProvider>
        </PWAProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
