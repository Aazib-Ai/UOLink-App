import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { buildSecurityHeaders, generateNonce } from '@/lib/security/headers'

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production'

  // Generate per-request nonce and forward to the application via request headers
  const nonce = generateNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-csp-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Derive optional R2 host from environment variables
  const r2PublicBaseUrl =
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || null
  let r2Host: string | null = null
  if (r2PublicBaseUrl) {
    try {
      r2Host = new URL(r2PublicBaseUrl).hostname
    } catch {
      r2Host = null
    }
  }

  const imageHosts = ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com']

  // Apply security headers including CSP with nonce
  const headers = buildSecurityHeaders({ isDev, imageHosts, r2PublicHost: r2Host, nonce })
  headers.forEach(({ key, value }) => response.headers.set(key, value))

  // Also expose nonce on the response for debugging/verification
  response.headers.set('x-csp-nonce', nonce)

  return response
}

export const config = {
  matcher: '/:path*',
}

