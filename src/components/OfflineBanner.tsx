'use client';

import { useOfflineManager } from '@/hooks/usePWA';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const { isOffline, offlineActions } = useOfflineManager();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline && !wasOffline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (!isOffline && wasOffline) {
      // Show "back online" message briefly
      setShowBanner(true);
      setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOffline, wasOffline]);

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isOffline 
        ? 'bg-amber-600 text-white' 
        : 'bg-[#90c639] text-white'
    }`}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center space-x-2 text-sm">
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>You're offline. Some features may be limited.</span>
              {offlineActions.length > 0 && (
                <span className="bg-amber-700 px-2 py-1 rounded text-xs">
                  {offlineActions.length} pending actions
                </span>
              )}
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4" />
              <span>You're back online!</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}