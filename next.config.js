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
  },
  serverExternalPackages: ['firebase-admin'],
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
