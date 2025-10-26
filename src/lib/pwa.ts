'use client';

export const registerServiceWorker = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            // Wait for the page to load completely
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve(true);
                } else {
                    window.addEventListener('load', () => resolve(true));
                }
            });

            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });

            console.log('Service Worker registered successfully:', registration);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New content is available, show update notification
                            showUpdateNotification();
                        }
                    });
                }
            });

            // Check for waiting service worker
            if (registration.waiting) {
                showUpdateNotification();
            }

            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }
    return null;
};

export const unregisterServiceWorker = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.unregister();
                console.log('Service Worker unregistered successfully');
                return true;
            }
        } catch (error) {
            console.error('Service Worker unregistration failed:', error);
        }
    }
    return false;
};

const showUpdateNotification = () => {
    // Create a custom event for update notification
    const event = new CustomEvent('sw-update-available');
    window.dispatchEvent(event);
};

export const checkForUpdates = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.update();
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }
};

// Utility to detect if app is installed
export const isAppInstalled = (): boolean => {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;

    return isStandalone || isIOSStandalone;
};

// Utility to detect mobile device
export const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false;

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
};

// Utility to detect iOS
export const isIOSDevice = (): boolean => {
    if (typeof window === 'undefined') return false;

    return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Add to home screen detection
export const canInstallApp = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Check if already installed
    if (isAppInstalled()) return false;

    // Check if browser supports installation
    return 'serviceWorker' in navigator && 'PushManager' in window;
};