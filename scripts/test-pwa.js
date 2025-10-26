const fs = require('fs');
const path = require('path');

console.log('🔍 PWA Setup Verification');
console.log('========================\n');

// Check manifest.json
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  console.log('✅ manifest.json exists');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`   - Name: ${manifest.name}`);
    console.log(`   - Short Name: ${manifest.short_name}`);
    console.log(`   - Icons: ${manifest.icons.length} defined`);
    console.log(`   - Start URL: ${manifest.start_url}`);
    console.log(`   - Display: ${manifest.display}`);
  } catch (error) {
    console.log('❌ manifest.json is invalid JSON');
  }
} else {
  console.log('❌ manifest.json missing');
}

// Check service worker
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
if (fs.existsSync(swPath)) {
  console.log('✅ sw.js exists');
} else {
  console.log('❌ sw.js missing');
}

// Check icons directory
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (fs.existsSync(iconsDir)) {
  console.log('✅ icons directory exists');
  const iconFiles = fs.readdirSync(iconsDir);
  console.log(`   - ${iconFiles.length} icon files found`);
  
  const requiredIcons = [
    'icon-72x72.png',
    'icon-96x96.png',
    'icon-128x128.png',
    'icon-144x144.png',
    'icon-152x152.png',
    'icon-192x192.png',
    'icon-384x384.png',
    'icon-512x512.png'
  ];
  
  const missingIcons = requiredIcons.filter(icon => !iconFiles.includes(icon));
  if (missingIcons.length === 0) {
    console.log('✅ All required icons present');
  } else {
    console.log(`⚠️  Missing icons: ${missingIcons.join(', ')}`);
  }
} else {
  console.log('❌ icons directory missing');
}

// Check PWA components
const componentsDir = path.join(__dirname, '..', 'src', 'components');
const pwaComponents = [
  'PWAInstallPrompt.tsx',
  'PWAUpdateNotification.tsx',
  'OfflineBanner.tsx',
  'SplashScreen.tsx',
  'PWAProvider.tsx'
];

console.log('\n📱 PWA Components:');
pwaComponents.forEach(component => {
  const componentPath = path.join(componentsDir, component);
  if (fs.existsSync(componentPath)) {
    console.log(`✅ ${component}`);
  } else {
    console.log(`❌ ${component} missing`);
  }
});

// Check hooks
const hooksDir = path.join(__dirname, '..', 'src', 'hooks');
const pwaHooks = [
  'usePWA.ts',
  'usePullToRefresh.ts'
];

console.log('\n🎣 PWA Hooks:');
pwaHooks.forEach(hook => {
  const hookPath = path.join(hooksDir, hook);
  if (fs.existsSync(hookPath)) {
    console.log(`✅ ${hook}`);
  } else {
    console.log(`❌ ${hook} missing`);
  }
});

// Check PWA utilities
const libDir = path.join(__dirname, '..', 'src', 'lib');
const pwaUtilPath = path.join(libDir, 'pwa.ts');
if (fs.existsSync(pwaUtilPath)) {
  console.log('\n✅ PWA utilities (pwa.ts) exist');
} else {
  console.log('\n❌ PWA utilities missing');
}

// Check CSS
const stylesDir = path.join(__dirname, '..', 'src', 'styles');
const pwaCssPath = path.join(stylesDir, 'pwa.css');
if (fs.existsSync(pwaCssPath)) {
  console.log('✅ PWA styles (pwa.css) exist');
} else {
  console.log('❌ PWA styles missing');
}

console.log('\n🚀 Next Steps:');
console.log('1. Create proper app icons (currently using placeholder)');
console.log('2. Test on mobile device');
console.log('3. Run Lighthouse PWA audit');
console.log('4. Deploy with HTTPS enabled');
console.log('\n📖 See PWA_SETUP_GUIDE.md for detailed instructions');