'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setShowUpdate(true);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Tell the service worker to skip waiting and activate
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      
      // Reload the page to get the new version
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to update app:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-[#90c639] text-white rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5" />
            <h3 className="font-semibold">Update Available</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-green-200 hover:text-white"
            disabled={isUpdating}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <p className="text-sm text-green-100 mb-4">
          A new version of UoLink is available with improvements and bug fixes.
        </p>

        <div className="flex space-x-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 bg-white text-[#90c639] hover:bg-amber-50 px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Update Now</span>
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isUpdating}
            className="px-4 py-2 text-green-200 hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}