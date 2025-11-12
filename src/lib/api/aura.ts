import { requireOk } from '@/lib/api/client'

export async function adjustAura(userId: string, auraDelta: number): Promise<{ success: boolean }> {
  // Server validates ownership; userId sent for clarity but optional
  return await requireOk<{ success: boolean }>(
    `/api/aura/adjust`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, auraDelta }),
    },
    { requireAuth: true }
  )
}

