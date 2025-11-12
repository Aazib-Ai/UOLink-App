import { getIdToken } from '@/lib/api/client'
import type { ApiResponse } from '@/types/api'
import type { UsernameAvailability, UsernameRequest } from '@/types/api'

export async function checkUsername(username: string): Promise<ApiResponse<UsernameAvailability>> {
  const res = await fetch(`/api/username/check?username=${encodeURIComponent(username)}`)
  const json = await res.json()
  return json
}

export async function changeUsername(username: string): Promise<ApiResponse<{ username: string }>> {
  const token = await getIdToken()
  const payload: UsernameRequest = { username }
  const res = await fetch(`/api/username/change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  return json
}

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
