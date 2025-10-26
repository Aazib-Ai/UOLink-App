'use client';

import { useEffect, useState } from 'react';

interface PWATestInfo {
    userAgent: string;
    isStandalone: boolean;
    isIOSStandalone: boolean;
    hasServiceWorker: boolean;
    serviceWorkerState: string;
    isOnline: boolean;
    viewportWidth: number;
    viewportHeight: number;
    displayMode: string;
}

export default function PWATestPage() {
    const [testInfo, setTestInfo] = useState<PWATestInfo | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
        console.log(`PWA Test - ${message}`);
    };

    useEffect(() => {
        const gatherInfo = async () => {
            addLog('Starting PWA diagnostics...');

            const info: PWATestInfo = {
                userAgent: navigator.userAgent,
                isStandalone: window.matchMedia('(display-mode: standalone)').matches,
                isIOSStandalone: (window.navigator as any).standalone === true,
                hasServiceWorker: 'serviceWorker' in navigator,
                serviceWorkerState: 'unknown',
                isOnline: navigator.onLine,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
            };

            // Check service worker state
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                        if (registration.active) {
                            info.serviceWorkerState = 'active';
                            addLog('Service Worker is active');
                        } else if (registration.installing) {
                            info.serviceWorkerState = 'installing';
                            addLog('Service Worker is installing');
                        } else if (registration.waiting) {
                            info.serviceWorkerState = 'waiting';
                            addLog('Service Worker is waiting');
                        } else {
                            info.serviceWorkerState = 'registered but inactive';
                            addLog('Service Worker is registered but inactive');
                        }
                    } else {
                        info.serviceWorkerState = 'not registered';
                        addLog('Service Worker is not registered');
                    }
                } catch (error) {
                    info.serviceWorkerState = 'error checking';
                    addLog(`Error checking Service Worker: ${error}`);
                }
            } else {
                addLog('Service Worker not supported');
            }

            setTestInfo(info);
            addLog('PWA diagnostics complete');
        };

        gatherInfo();

        // Monitor network changes
        const handleOnline = () => addLog('Network: Online');
        const handleOffline = () => addLog('Network: Offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Monitor viewport changes
        const handleResize = () => {
            addLog(`Viewport changed: ${window.innerWidth}x${window.innerHeight}`);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const testServiceWorker = async () => {
        addLog('Testing Service Worker registration...');

        if (!('serviceWorker' in navigator)) {
            addLog('Service Worker not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            addLog(`Service Worker registered: ${registration.scope}`);
        } catch (error) {
            addLog(`Service Worker registration failed: ${error}`);
        }
    };

    const testCaching = async () => {
        addLog('Testing cache functionality...');

        if (!('caches' in window)) {
            addLog('Cache API not supported');
            return;
        }

        try {
            const cache = await caches.open('test-cache');
            await cache.add('/manifest.json');
            const cachedResponse = await cache.match('/manifest.json');

            if (cachedResponse) {
                addLog('Cache test successful');
            } else {
                addLog('Cache test failed - no cached response');
            }

            await caches.delete('test-cache');
        } catch (error) {
            addLog(`Cache test failed: ${error}`);
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    if (!testInfo) {
        return (
            <div className="min-h-screen bg-gradient-to-r from-yellow-50 to-amber-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto mb-4"></div>
                    <p>Gathering PWA information...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-r from-yellow-50 to-amber-50 p-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">PWA Test & Diagnostics</h1>

                {/* PWA Status */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">PWA Status</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-3 rounded ${testInfo.isStandalone || testInfo.isIOSStandalone ? 'bg-green-100' : 'bg-yellow-100'}`}>
                            <strong>Mode:</strong> {testInfo.displayMode}
                        </div>
                        <div className={`p-3 rounded ${testInfo.hasServiceWorker ? 'bg-green-100' : 'bg-red-100'}`}>
                            <strong>Service Worker:</strong> {testInfo.hasServiceWorker ? 'Supported' : 'Not Supported'}
                        </div>
                        <div className={`p-3 rounded ${testInfo.serviceWorkerState === 'active' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                            <strong>SW State:</strong> {testInfo.serviceWorkerState}
                        </div>
                        <div className={`p-3 rounded ${testInfo.isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
                            <strong>Network:</strong> {testInfo.isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>

                {/* Device Info */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Device Information</h2>
                    <div className="space-y-2 text-sm">
                        <div><strong>User Agent:</strong> {testInfo.userAgent}</div>
                        <div><strong>Viewport:</strong> {testInfo.viewportWidth} x {testInfo.viewportHeight}</div>
                        <div><strong>iOS Standalone:</strong> {testInfo.isIOSStandalone ? 'Yes' : 'No'}</div>
                        <div><strong>Standalone Mode:</strong> {testInfo.isStandalone ? 'Yes' : 'No'}</div>
                    </div>
                </div>

                {/* Test Actions */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={testServiceWorker}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                        >
                            Test Service Worker
                        </button>
                        <button
                            onClick={testCaching}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                        >
                            Test Caching
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
                        >
                            Reload App
                        </button>
                        <button
                            onClick={clearLogs}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                        >
                            Clear Logs
                        </button>
                    </div>
                </div>

                {/* Logs */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Diagnostic Logs</h2>
                    <div className="bg-gray-100 rounded p-4 max-h-64 overflow-y-auto">
                        {logs.length === 0 ? (
                            <p className="text-gray-500">No logs yet...</p>
                        ) : (
                            logs.map((log, index) => (
                                <div key={index} className="text-sm font-mono mb-1">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <a
                        href="/"
                        className="bg-lime-500 hover:bg-lime-600 text-white px-6 py-3 rounded-lg inline-block"
                    >
                        Back to Home
                    </a>
                </div>
            </div>
        </div>
    );
}