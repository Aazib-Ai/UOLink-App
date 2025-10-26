'use client';

import { useEffect } from 'react';
import { registerServiceWorker, checkForUpdates } from '@/lib/pwa';
import { initializeMobilePWA, forceReloadIfStuck } from '@/lib/mobile-pwa-fix';

interface PWAProviderProps {
  children: React.ReactNode;
}

export default function PWAProvider({ children }: PWAProviderProps) {
  useEffect(() => {
    // Initialize mobile PWA fixes first
    initializeMobilePWA();

    // Set up force reload if stuck
    forceReloadIfStuck();

    // Add mobile debugging
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('PWA Provider - Mobile device detected:', isMobile);
    console.log('PWA Provider - User agent:', navigator.userAgent);
    console.log('PWA Provider - Service Worker support:', 'serviceWorker' in navigator);

    // Register service worker with error handling and retry logic
    const registerWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const registration = await registerServiceWorker();
          if (registration) {
            console.log('PWA Provider - Service Worker registered successfully');
            return registration;
          }
        } catch (error) {
          console.error(`PWA Provider - Service Worker registration attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error('PWA Provider - All service worker registration attempts failed');
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
      return null;
    };

    registerWithRetry();

    // Check for updates periodically (less frequent on mobile to save battery)
    const checkInterval = setInterval(() => {
      checkForUpdates();
    }, isMobile ? 300000 : 60000); // 5 minutes on mobile, 1 minute on desktop

    // Check for updates when the app becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('PWA Provider - App became visible, checking for updates');
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Add viewport height CSS custom property for mobile
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      console.log('PWA Provider - Viewport height set:', vh);
    };

    setVH();

    // Add debounced resize handler for better mobile performance
    let resizeTimeout: NodeJS.Timeout;
    const debouncedSetVH = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(setVH, 100);
    };

    window.addEventListener('resize', debouncedSetVH);
    window.addEventListener('orientationchange', () => {
      // Delay for orientation change to complete
      setTimeout(setVH, 500);
    });

    return () => {
      window.removeEventListener('resize', debouncedSetVH);
      window.removeEventListener('orientationchange', setVH);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Add mobile-specific optimizations and failsafe
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isPWA = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

    console.log('PWA Provider - Device info:', { isMobile, isPWA });

    if (isMobile) {
      // Add mobile class to body (not html to avoid hydration issues)
      document.body.classList.add('mobile-device');

      // Prevent pull-to-refresh on mobile
      document.body.style.overscrollBehavior = 'contain';
    }

    // Always ensure content is visible - prevent getting stuck
    document.body.classList.add('pwa-ready');

    // Failsafe: Force content visibility after 2 seconds
    const failsafeTimer = setTimeout(() => {
      document.body.classList.add('pwa-loaded', 'splash-complete');
      console.log('PWA Provider - Failsafe content visibility applied');

      // Remove any stuck splash screens
      const splashElements = document.querySelectorAll('.pwa-splash-overlay, .splash-screen');
      splashElements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }, 2000);

    return () => {
      clearTimeout(failsafeTimer);
    };
  }, []);

  return <>{children}</>;
}