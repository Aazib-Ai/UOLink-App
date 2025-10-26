'use client';

import { useSplash } from '@/contexts/SplashContext';

export default function SplashScreen() {
  // The initial splash is now handled by CSS and inline script
  // This component is kept for compatibility but not actively used for PWA
  const { isSplashVisible } = useSplash();

  // Only show for non-PWA if needed
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return null; // PWA splash is handled by CSS/script
  }

  return (
    <div 
      className="splash-screen" 
      style={{
        opacity: isSplashVisible ? 1 : 0,
        visibility: isSplashVisible ? 'visible' : 'hidden',
        pointerEvents: isSplashVisible ? 'auto' : 'none'
      }}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg">
          <img 
            src="/Icon.png" 
            alt="UoLink" 
            className="w-16 h-16"
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
