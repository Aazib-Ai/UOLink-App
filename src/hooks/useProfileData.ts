import { useEffect, useRef, useState } from 'react'
import { getUserProfile } from '@/lib/firebase'
import { getAuraTier } from '@/lib/aura'

export interface ProfileData {
  profilePictures: Record<string, string | undefined>
  profileUsernames: Record<string, string | undefined>
  profileAura: Record<
    string,
    {
      aura: number
      tierName: string
      badgeClass: string
      borderClass: string
    }
  >
}

const pickNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return undefined
}

export const useProfileData = (notes: any[]) => {
  const [profileData, setProfileData] = useState<ProfileData>({
    profilePictures: {},
    profileUsernames: {},
    profileAura: {},
  })
  const fetchingProfilesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!Array.isArray(notes) || notes.length === 0) {
      return
    }

    const fallbackUsernames: Record<string, string | undefined> = {}
    const uniqueContributorIds = new Set<string>()

    notes.forEach(note => {
      const userId = pickNonEmptyString(note?.uploadedBy) ?? ''
      if (!userId) {
        return
      }
      uniqueContributorIds.add(userId)

      const fallbackUsername = pickNonEmptyString(note?.uploaderUsername, note?.contributorUsername)
      if (fallbackUsername && !fallbackUsernames[userId]) {
        fallbackUsernames[userId] = fallbackUsername
      }
    })

    if (Object.keys(fallbackUsernames).length > 0) {
      setProfileData(prev => ({
        profilePictures: { ...prev.profilePictures },
        profileUsernames: { ...fallbackUsernames, ...prev.profileUsernames },
        profileAura: { ...prev.profileAura },
      }))
    }

    uniqueContributorIds.forEach(userId => {
      if (fetchingProfilesRef.current.has(userId)) {
        return
      }

      fetchingProfilesRef.current.add(userId)
      ;(async () => {
        try {
          const profile = await getUserProfile(userId)
          if (!profile) {
            return
          }

          const auraInfo = getAuraTier(
            typeof profile.aura === 'number' ? profile.aura : Number(profile.aura ?? 0)
          )

          setProfileData(prev => ({
            profilePictures: {
              ...prev.profilePictures,
              [userId]: profile.profilePicture ?? prev.profilePictures[userId],
            },
            profileUsernames: {
              ...prev.profileUsernames,
              [userId]:
                pickNonEmptyString(profile.username, prev.profileUsernames[userId]) ??
                prev.profileUsernames[userId],
            },
            profileAura: {
              ...prev.profileAura,
              [userId]: {
                aura: auraInfo.aura,
                tierName: auraInfo.tier.name,
                badgeClass: auraInfo.tier.badgeClass,
                borderClass: auraInfo.tier.borderClass,
              },
            },
          }))
        } catch (error) {
          console.error(`Error fetching profile data for user ${userId}:`, error)
        }
      })()
    })
  }, [notes])

  return profileData
}
