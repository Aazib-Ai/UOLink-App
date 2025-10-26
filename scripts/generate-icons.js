const fs = require('fs');
const path = require('path');

// This script helps generate the required PWA icons
// You'll need to create these icons from your main logo

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const shortcutSizes = [96];

console.log('PWA Icon Generation Guide');
console.log('========================');
console.log('');
console.log('You need to create the following icons from your main logo:');
console.log('');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('✓ Created /public/icons directory');
}

console.log('Main App Icons:');
iconSizes.forEach(size => {
  console.log(`- icon-${size}x${size}.png (${size}x${size} pixels)`);
});

console.log('');
console.log('Shortcut Icons:');
console.log('- upload-shortcut.png (96x96 pixels)');
console.log('- leaderboard-shortcut.png (96x96 pixels)');

console.log('');
console.log('Additional Icons:');
console.log('- badge-72x72.png (72x72 pixels) - for notifications');
console.log('- checkmark.png (24x24 pixels) - for notification actions');
console.log('- xmark.png (24x24 pixels) - for notification actions');

console.log('');
console.log('Screenshots (optional but recommended):');
console.log('- mobile-dashboard.png (390x844 pixels) - mobile screenshot');
console.log('- desktop-dashboard.png (1280x720 pixels) - desktop screenshot');

console.log('');
console.log('Tips:');
console.log('- Use your existing uolink-logo.png as the base');
console.log('- Icons should have rounded corners and padding for better appearance');
console.log('- Use tools like https://realfavicongenerator.net/ for automatic generation');
console.log('- Ensure icons work well on both light and dark backgrounds');

// Create a simple placeholder icon if none exists
const placeholderIcon = path.join(iconsDir, 'icon-192x192.png');
if (!fs.existsSync(placeholderIcon)) {
  // Copy the existing logo as a placeholder
  const logoPath = path.join(__dirname, '..', 'public', 'uolink-logo.png');
  if (fs.existsSync(logoPath)) {
    fs.copyFileSync(logoPath, placeholderIcon);
    console.log('✓ Created placeholder icon-192x192.png from existing logo');
  }
}