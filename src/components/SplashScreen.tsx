'use client';

import React from 'react';
import { useSplash } from '@/contexts/SplashContext';

export default function SplashScreen() {
  const { isSplashVisible } = useSplash();

  // Don't render splash screen at all to prevent conflicts
  // The PWA splash is handled by the inline script and CSS
  if (typeof window !== 'undefined') {
    // Add a failsafe to hide any stuck splash screens
    React.useEffect(() => {
      const failsafeTimer = setTimeout(() => {
        const splashElements = document.querySelectorAll('.splash-screen, .pwa-splash-overlay');
        splashElements.forEach(el => {
          if (el.parentNode && el instanceof HTMLElement) {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
          }
        });
        document.body.classList.add('splash-complete', 'pwa-loaded');
      }, 4000); // 4 second failsafe

      return () => clearTimeout(failsafeTimer);
    }, []);
  }

  // Only show splash if explicitly visible and not in PWA mode
  const isPWA = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

  if (isPWA || !isSplashVisible) {
    return null;
  }

  return (
    <div
      className="splash-screen"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #90c639 0%, #f59e0b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        opacity: isSplashVisible ? 1 : 0,
        visibility: isSplashVisible ? 'visible' : 'hidden',
        pointerEvents: isSplashVisible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease, visibility 0.3s ease'
      }}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg">
          <img
            src="/Icon.png"
            alt="UoLink"
            className="w-16 h-16"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">UoLink</h1>
          <p className="text-amber-100">University Notes & Study Hub</p>
        </div>
        <div className="flex space-x-1 mt-8">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
}
