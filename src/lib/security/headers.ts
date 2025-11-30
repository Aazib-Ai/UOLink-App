import { NextResponse } from 'next/server'

export type HeaderKV = { key: string; value: string }

export function generateNonce(): string {
  // Simple nonce generator; for per-response use when injecting scripts/styles
  return Buffer.from(cryptoRandom(16)).toString('base64')
}

function cryptoRandom(length: number): Uint8Array {
  const array = new Uint8Array(length)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(array)
    return array
  }
  // Fallback for environments without Web Crypto
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return array
}

export interface CSPOptions {
  nonce?: string
  imageHosts?: string[]
  isDev?: boolean
  allowGoogleOAuth?: boolean
  r2PublicHost?: string | null
}

export function generateCSP(options: CSPOptions = {}): string {
  const {
    nonce,
    imageHosts = [],
    isDev = process.env.NODE_ENV !== 'production',
    allowGoogleOAuth = true,
    r2PublicHost = null,
  } = options

  const imgSrcHosts = new Set<string>([
    "'self'",
    'data:',
    'blob:',
    'https:',
    'firebasestorage.googleapis.com',
    'lh3.googleusercontent.com',
  ])
  imageHosts.forEach((h) => imgSrcHosts.add(h))
  if (r2PublicHost) imgSrcHosts.add(r2PublicHost)

  const scriptSrc: string[] = ["'self'"]
  if (nonce) scriptSrc.push(`'nonce-${nonce}'`)
  if (isDev) scriptSrc.push("'unsafe-eval'")
  if (allowGoogleOAuth) {
    scriptSrc.push('https://apis.google.com')
  }

  const connectSrc = ["'self'", 'https:', isDev ? 'ws:' : '']
    .filter(Boolean)
    .join(' ')

  const frameSrc = ["'self'"]
  if (allowGoogleOAuth) {
    frameSrc.push('https://accounts.google.com')
    // Firebase auth domain is required for OAuth redirect flow
    frameSrc.push('https://uolink-e3b24.firebaseapp.com')
  }
  // Allow embedding of trusted document viewers
  // - Cloudflare R2 public host for PDF assets
  // - Firebase Storage for legacy files
  // - Jina reader proxy used for mobile fallbacks
  if (r2PublicHost) {
    frameSrc.push(`https://${r2PublicHost}`)
  }
  frameSrc.push('https://firebasestorage.googleapis.com')
  frameSrc.push('https://r.jina.ai')

  const styleSrc: string[] = ["'self'"]
  if (nonce) styleSrc.push(`'nonce-${nonce}'`)

  const cspParts: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `img-src ${Array.from(imgSrcHosts).join(' ')}`,
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    `frame-src ${frameSrc.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ]

  return cspParts.join('; ')
}

export interface SecurityHeadersOptions {
  isDev?: boolean
  imageHosts?: string[]
  r2PublicHost?: string | null
  nonce?: string
}

export function buildSecurityHeaders(options: SecurityHeadersOptions = {}): HeaderKV[] {
  const { isDev = process.env.NODE_ENV !== 'production', imageHosts = [], r2PublicHost = null, nonce } = options
  const csp = generateCSP({ nonce, imageHosts, isDev, r2PublicHost })

  const headers: HeaderKV[] = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ]

  if (!isDev) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' })
  }

  return headers
}

export function applySecurityHeaders(resp: NextResponse, options: SecurityHeadersOptions = {}): NextResponse {
  const headers = buildSecurityHeaders(options)
  headers.forEach(({ key, value }) => resp.headers.set(key, value))
  return resp
}
