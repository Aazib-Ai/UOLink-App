import { getIdToken } from '@/lib/api/client'
import type { ApiResponse } from '@/types/api'
import type { UsernameRequest } from '@/types/api'

// Username checking and changing removed; usernames are fixed to roll numbers

export async function ensureUsername(): Promise<ApiResponse<{ username: string }>> {
  const token = await getIdToken()
  const res = await fetch(`/api/username/ensure`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const json = await res.json()
  return json
}
