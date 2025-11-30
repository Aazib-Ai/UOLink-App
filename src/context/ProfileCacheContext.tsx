'use client'
import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react'
import { getUserProfile } from '@/lib/firebase/profiles'
import { getUserByUsernameOnly } from '@/lib/firebase/profile-resolver'
import type { UserProfile } from '@/lib/data/types'

interface ProfileCacheContextValue {
  getProfileById: (id: string) => Promise<UserProfile | null>
  getProfileByUsername: (username: string) => Promise<UserProfile | null>
}

const ProfileCacheContext = createContext<ProfileCacheContextValue | null>(null)

export function ProfileCacheProvider({ children }: { children: React.ReactNode }) {
  const byId = useRef<Map<string, UserProfile | null>>(new Map())
  const byUsername = useRef<Map<string, UserProfile | null>>(new Map())
  const inflight = useRef<Map<string, Promise<UserProfile | null>>>(new Map())

  const getProfileById = useCallback(async (id: string): Promise<UserProfile | null> => {
    if (!id) return null
    if (byId.current.has(id)) return byId.current.get(id) ?? null
    const key = `id:${id}`
    if (inflight.current.has(key)) return await inflight.current.get(key)!
    const p = (async () => {
      const prof = await getUserProfile(id)
      byId.current.set(id, prof)
      return prof
    })()
    inflight.current.set(key, p)
    try {
      return await p
    } finally {
      setTimeout(() => inflight.current.delete(key), 5000)
    }
  }, [])

  const getProfileByUsername = useCallback(async (username: string): Promise<UserProfile | null> => {
    const uname = (username ?? '').trim()
    if (!uname) return null
    if (byUsername.current.has(uname)) return byUsername.current.get(uname) ?? null
    const key = `username:${uname}`
    if (inflight.current.has(key)) return await inflight.current.get(key)!
    const p = (async () => {
      const prof = await getUserByUsernameOnly(uname)
      if (prof?.id) byId.current.set(prof.id, prof)
      byUsername.current.set(uname, prof)
      return prof
    })()
    inflight.current.set(key, p)
    try {
      return await p
    } finally {
      setTimeout(() => inflight.current.delete(key), 5000)
    }
  }, [])

  const value = useMemo(() => ({ getProfileById, getProfileByUsername }), [getProfileById, getProfileByUsername])
  return <ProfileCacheContext.Provider value={value}>{children}</ProfileCacheContext.Provider>
}

export function useProfileByUsername(username: string) {
  const ctx = useContext(ProfileCacheContext)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!ctx) return
    const uname = (username ?? '').trim()
    if (!uname) return
    try {
      setLoading(true)
      setError(null)
      const prof = await ctx.getProfileByUsername(uname)
      setProfile(prof)
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [ctx, username])

  return { profile, loading, error, reload: load }
}

