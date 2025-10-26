// Emergency fix script for stuck PWA splash screen
// Add this to browser console if app gets stuck on splash screen

console.log('Emergency PWA Fix - Starting...');

// Force remove all splash screens
const removeSplashScreens = () => {
  const splashElements = document.querySelectorAll('.splash-screen, .pwa-splash-overlay');
  console.log('Emergency PWA Fix - Found', splashElements.length, 'splash elements');
  
  splashElements.forEach((el, index) => {
    console.log('Emergency PWA Fix - Removing splash element', index);
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
};

// Force show content
const forceShowContent = () => {
  console.log('Emergency PWA Fix - Forcing content visibility');
  
  // Add classes to body
  document.body.classList.add('splash-complete', 'pwa-loaded', 'pwa-ready');
  
  // Force all content to be visible
  const allDivs = document.querySelectorAll('body > div:not(.pwa-splash-overlay)');
  allDivs.forEach(div => {
    if (div instanceof HTMLElement) {
      div.style.opacity = '1';
      div.style.visibility = 'visible';
    }
  });
  
  // Add emergency CSS
  const emergencyStyle = document.createElement('style');
  emergencyStyle.textContent = `
    body > div:not(.pwa-splash-overlay) {
      opacity: 1 !important;
      visibility: visible !important;
    }
    .splash-screen, .pwa-splash-overlay {
      display: none !important;
    }
  `;
  document.head.appendChild(emergencyStyle);
};

// Run fixes
removeSplashScreens();
forceShowContent();

// Set up periodic check to prevent getting stuck again
const preventStuck = () => {
  setInterval(() => {
    const visibleSplash = document.querySelector('.splash-screen[style*="opacity: 1"], .pwa-splash-overlay[style*="opacity: 1"]');
    if (visibleSplash) {
      console.log('Emergency PWA Fix - Detected stuck splash, removing...');
      removeSplashScreens();
      forceShowContent();
    }
  }, 2000);
};

preventStuck();

console.log('Emergency PWA Fix - Complete! App should now be visible.');

// Also provide manual functions
window.emergencyPWAFix = {
  removeSplash: removeSplashScreens,
  showContent: forceShowContent,
  fullFix: () => {
    removeSplashScreens();
    forceShowContent();
  },
  fixHydration: () => {
    console.log('Emergency PWA Fix - Fixing hydration issues');
    // Force re-render by toggling a class
    document.body.classList.toggle('hydration-fix');
    setTimeout(() => {
      document.body.classList.toggle('hydration-fix');
    }, 100);
  }
};