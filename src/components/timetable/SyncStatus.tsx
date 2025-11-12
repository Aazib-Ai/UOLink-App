'use client'

import React from 'react'

type Props = {
  online: boolean
  updatedAt: number | null
  expiresAt: number | null
  version: string | null
}

function formatTime(ts: number | null): string {
  if (!ts) return 'Unknown'
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function SyncStatus({ online, updatedAt, expiresAt, version }: Props) {
  const isStale = typeof expiresAt === 'number' ? Date.now() >= expiresAt : false

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium border shadow-sm ${online ? 'bg-white border-lime-200 text-[#335122]' : 'bg-amber-50 border-amber-300 text-amber-800'}`}
        title={online ? 'Online' : 'Offline'}>
        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {online ? 'Online' : 'Offline'}
      </span>
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium border shadow-sm ${isStale ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-lime-200 text-[#335122]'}`}
        title={`Version ${version ?? 'n/a'}`}>
        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${isStale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        {isStale ? 'Stale' : 'Fresh'} • Updated {formatTime(updatedAt)}
      </span>
    </div>
  )
}

