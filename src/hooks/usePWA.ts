'use client';

import { useState, useEffect } from 'react';

interface PWAState {
    isInstalled: boolean;
    isInstallable: boolean;
    isOffline: boolean;
    installPrompt: any;
}

export function usePWA() {
    const [pwaState, setPwaState] = useState<PWAState>({
        isInstalled: false,
        isInstallable: false,
        isOffline: false,
        installPrompt: null,
    });

    useEffect(() => {
        // Check if app is installed (standalone mode)
        const checkInstalled = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSStandalone = (window.navigator as any).standalone === true;
            return isStandalone || isIOSStandalone;
        };

        // Check online/offline status
        const updateOnlineStatus = () => {
            setPwaState(prev => ({
                ...prev,
                isOffline: !navigator.onLine
            }));
        };

        // Listen for install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setPwaState(prev => ({
                ...prev,
                isInstallable: true,
                installPrompt: e
            }));
        };

        // Listen for app installed
        const handleAppInstalled = () => {
            setPwaState(prev => ({
                ...prev,
                isInstalled: true,
                isInstallable: false,
                installPrompt: null
            }));
        };

        // Initial state
        setPwaState(prev => ({
            ...prev,
            isInstalled: checkInstalled(),
            isOffline: !navigator.onLine
        }));

        // Event listeners
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    const installApp = async () => {
        if (pwaState.installPrompt) {
            pwaState.installPrompt.prompt();
            const { outcome } = await pwaState.installPrompt.userChoice;

            setPwaState(prev => ({
                ...prev,
                installPrompt: null,
                isInstallable: false
            }));

            return outcome === 'accepted';
        }
        return false;
    };

    return {
        ...pwaState,
        installApp
    };
}

// Hook for managing offline functionality
export function useOfflineManager() {
    const [isOffline, setIsOffline] = useState(false);
    const [offlineActions, setOfflineActions] = useState<any[]>([]);

    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOffline(!navigator.onLine);
        };

        setIsOffline(!navigator.onLine);

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    const addOfflineAction = (action: any) => {
        setOfflineActions(prev => [...prev, { ...action, timestamp: Date.now() }]);

        // Store in localStorage for persistence
        const stored = localStorage.getItem('offline-actions') || '[]';
        const actions = JSON.parse(stored);
        actions.push({ ...action, timestamp: Date.now() });
        localStorage.setItem('offline-actions', JSON.stringify(actions));
    };

    const clearOfflineActions = () => {
        setOfflineActions([]);
        localStorage.removeItem('offline-actions');
    };

    const syncOfflineActions = async () => {
        if (isOffline || offlineActions.length === 0) return;

        // Process offline actions when back online
        for (const action of offlineActions) {
            try {
                // Implement your sync logic here based on action type
                console.log('Syncing offline action:', action);
            } catch (error) {
                console.error('Failed to sync action:', error);
            }
        }

        clearOfflineActions();
    };

    useEffect(() => {
        if (!isOffline) {
            syncOfflineActions();
        }
    }, [isOffline]);

    return {
        isOffline,
        offlineActions,
        addOfflineAction,
        clearOfflineActions,
        syncOfflineActions
    };
}