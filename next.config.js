/** @type {import('next').NextConfig} */
const imageDomains = ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com']

const r2PublicBaseUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL

if (r2PublicBaseUrl) {
  try {
    const hostname = new URL(r2PublicBaseUrl).hostname
    if (!imageDomains.includes(hostname)) {
      imageDomains.push(hostname)
    }
  } catch {
    // Ignore invalid URLs - fallback domains already cover the basics
  }
}

const nextConfig = {
  images: {
    domains: imageDomains,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  serverExternalPackages: ['firebase-admin'],
  // PWA Configuration
  experimental: {
    webVitalsAttribution: ['CLS', 'LCP']
  },
  headers: async () => {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      canvas: false,
    }

    return config
  },
}

module.exports = nextConfig
