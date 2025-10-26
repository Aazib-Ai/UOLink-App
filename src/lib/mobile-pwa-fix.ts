'use client';

// Mobile PWA loading fixes
export const initializeMobilePWA = () => {
    if (typeof window === 'undefined') return;

    // Add mobile debugging
    console.log('Mobile PWA Fix - Initializing...');
    console.log('Mobile PWA Fix - User Agent:', navigator.userAgent);
    console.log('Mobile PWA Fix - Display Mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
    console.log('Mobile PWA Fix - Service Worker Support:', 'serviceWorker' in navigator);

    // Fix iOS viewport issues (safe for hydration)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        console.log('Mobile PWA Fix - iOS device detected');

        // Fix iOS viewport height issues
        const setIOSViewport = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setIOSViewport();
        window.addEventListener('resize', setIOSViewport);
        window.addEventListener('orientationchange', () => {
            setTimeout(setIOSViewport, 500);
        });
    }

    // Fix Android viewport issues (simplified to avoid hydration issues)
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isAndroid) {
        console.log('Mobile PWA Fix - Android device detected');
        // Android-specific fixes will be handled via CSS and meta tags
    }

    // Fix PWA loading issues (simplified to avoid hydration issues)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA) {
        console.log('Mobile PWA Fix - PWA mode detected');
        // PWA-specific fixes will be handled by PWAProvider
    }

    // Add network status monitoring
    const updateNetworkStatus = () => {
        const isOnline = navigator.onLine;
        console.log('Mobile PWA Fix - Network status:', isOnline ? 'online' : 'offline');
        document.body.classList.toggle('offline', !isOnline);
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Add performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            console.log('Mobile PWA Fix - Page load time:', loadTime.toFixed(2), 'ms');

            // Report slow loading
            if (loadTime > 3000) {
                console.warn('Mobile PWA Fix - Slow loading detected:', loadTime.toFixed(2), 'ms');
            }
        });
    }
};

// Check if PWA is installable
export const checkPWAInstallability = () => {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const hasServiceWorker = 'serviceWorker' in navigator;

    console.log('PWA Installability Check:', {
        isStandalone,
        isIOSStandalone,
        hasServiceWorker,
        userAgent: navigator.userAgent
    });

    return hasServiceWorker && !isStandalone && !isIOSStandalone;
};

// Force reload if PWA is stuck
export const forceReloadIfStuck = () => {
    if (typeof window === 'undefined') return;

    // Check if app is stuck loading
    setTimeout(() => {
        const isLoading = document.querySelector('.pwa-loading') ||
            document.querySelector('.splash-screen[style*="opacity: 1"]');

        if (isLoading) {
            console.warn('Mobile PWA Fix - App appears stuck, forcing reload');
            window.location.reload();
        }
    }, 10000); // 10 seconds timeout
};