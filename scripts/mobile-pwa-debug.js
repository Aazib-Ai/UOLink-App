#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Mobile PWA Debug Helper');
console.log('==========================\n');

// Check if we're in development or production
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);

// Check manifest.json
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('✅ Manifest.json is valid');
    console.log(`   - Icons: ${manifest.icons.length} defined`);
    console.log(`   - Start URL: ${manifest.start_url}`);
    console.log(`   - Display: ${manifest.display}`);
    
    // Check if all icon files exist
    let missingIcons = 0;
    manifest.icons.forEach(icon => {
      const iconPath = path.join(__dirname, '..', 'public', icon.src);
      if (!fs.existsSync(iconPath)) {
        console.log(`❌ Missing icon: ${icon.src}`);
        missingIcons++;
      }
    });
    
    if (missingIcons === 0) {
      console.log('✅ All manifest icons exist');
    }
  } catch (error) {
    console.log('❌ Manifest.json is invalid:', error.message);
  }
} else {
  console.log('❌ Manifest.json not found');
}

// Check service worker
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
if (fs.existsSync(swPath)) {
  console.log('✅ Service Worker exists');
  
  // Check if offline page exists
  const offlinePagePath = path.join(__dirname, '..', 'src', 'app', 'offline', 'page.tsx');
  if (fs.existsSync(offlinePagePath)) {
    console.log('✅ Offline page exists');
  } else {
    console.log('❌ Offline page missing');
  }
} else {
  console.log('❌ Service Worker not found');
}

// Mobile debugging tips
console.log('\n📱 Mobile Debugging Tips:');
console.log('========================');
console.log('1. Test on actual mobile device, not just browser dev tools');
console.log('2. Use HTTPS (required for PWA features)');
console.log('3. Check browser console for errors');
console.log('4. Visit /pwa-test for detailed diagnostics');
console.log('5. Clear browser cache and data if issues persist');

console.log('\n🔍 Common Mobile PWA Issues:');
console.log('============================');
console.log('• Service Worker not registering (check HTTPS)');
console.log('• Icons not loading (check file paths)');
console.log('• Viewport issues (check meta tags)');
console.log('• Cache not working (check network tab)');
console.log('• App not installing (check manifest)');

console.log('\n🚀 Testing Steps:');
console.log('=================');
console.log('1. Build the app: npm run build');
console.log('2. Start production server: npm start');
console.log('3. Open on mobile device with HTTPS');
console.log('4. Check /pwa-test page for diagnostics');
console.log('5. Try installing the PWA');

console.log('\n🆘 Emergency Fix (if app gets stuck on splash):');
console.log('===============================================');
console.log('1. Open browser console on mobile device');
console.log('2. Run: fetch("/emergency-fix.js").then(r=>r.text()).then(eval)');
console.log('3. Or manually run: window.emergencyPWAFix.fullFix()');
console.log('4. This will force remove splash screen and show content');

console.log('\n📊 Performance Tips:');
console.log('====================');
console.log('• Minimize initial bundle size');
console.log('• Use lazy loading for components');
console.log('• Optimize images and icons');
console.log('• Cache static assets aggressively');
console.log('• Use service worker for offline functionality');

if (!isProduction) {
  console.log('\n⚠️  Note: PWA features may not work fully in development mode.');
  console.log('   Build and test in production mode for accurate results.');
}

console.log('\n✨ Happy debugging!');