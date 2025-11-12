import { getIdToken } from '@/lib/api/client'
import type { ApiResponse } from '@/types/api'
import type { UserProfile } from '@/lib/data/types'
import type { ProfileUpdateRequest } from '@/types/api'

export async function getProfile(uid: string): Promise<ApiResponse<UserProfile>> {
  const token = await getIdToken()
  const res = await fetch(`/api/profiles/${encodeURIComponent(uid)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const json = await res.json()
  return json
}

export async function updateProfile(uid: string, data: ProfileUpdateRequest): Promise<ApiResponse<UserProfile>> {
  const token = await getIdToken()
  const res = await fetch(`/api/profiles/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  return json
}
