import { getIdToken } from '@/lib/api/client'
import type { ApiResponse } from '@/types/api'

export async function uploadProfilePicture(file: File): Promise<ApiResponse<{ fileUrl: string; storageKey: string }>> {
    const token = await getIdToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/profile-picture', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    })
    const json = await res.json()
    return json
}

export async function deleteProfilePicture(storageKey: string): Promise<ApiResponse<{ success: boolean }>> {
    const token = await getIdToken()
    const res = await fetch(`/api/profile-picture?key=${encodeURIComponent(storageKey)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    return json
}

