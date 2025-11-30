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
    if (json && typeof json === 'object' && 'data' in json) {
        return json as ApiResponse<{ fileUrl: string; storageKey: string }>
    }
    if (json && typeof json === 'object' && 'error' in json) {
        return json as ApiResponse<{ fileUrl: string; storageKey: string }>
    }
    return { data: json as { fileUrl: string; storageKey: string } }
}

export async function deleteProfilePicture(storageKey: string): Promise<ApiResponse<{ success: boolean }>> {
    const token = await getIdToken()
    const res = await fetch(`/api/profile-picture?key=${encodeURIComponent(storageKey)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json && typeof json === 'object' && 'data' in json) {
        return json as ApiResponse<{ success: boolean }>
    }
    if (json && typeof json === 'object' && 'error' in json) {
        return json as ApiResponse<{ success: boolean }>
    }
    return { data: json as { success: boolean } }
}

