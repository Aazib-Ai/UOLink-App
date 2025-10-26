'use client'

import Link from 'next/link'
import type { UploadStatusBannerProps } from '../types'

export function UploadStatusBanner({ status }: UploadStatusBannerProps) {
  if (!status) return null

  return (
    <div
      className={`mb-6 rounded-2xl border px-5 py-4 text-sm shadow-sm ${
        status.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
      role={status.type === 'success' ? 'status' : 'alert'}
    >
      <p className="font-semibold">{status.message}</p>
      {status.details && <p className="mt-1 text-xs">{status.details}</p>}
      {status.action && (
        <Link
          href={status.action.href}
          className={`mt-3 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            status.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
          }`}
        >
          {status.action.label}
        </Link>
      )}
    </div>
  )
}