'use client'

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
    </div>
  )
}