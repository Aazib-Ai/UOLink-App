'use client'

import Link from 'next/link'
import { Bell, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSplash } from '@/contexts/SplashContext'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function MobileHeader() {
    const { user, loading: authLoading } = useAuth()
    const { isSplashComplete } = useSplash()
    const [profilePicture, setProfilePicture] = useState<string | null>(null)

    // Fetch user profile picture
    useEffect(() => {
        const fetchProfilePicture = async () => {
            if (user?.uid) {
                try {
                    const profileRef = doc(db, 'profiles', user.uid)
                    const profileSnap = await getDoc(profileRef)
                    if (profileSnap.exists()) {
                        const profileData = profileSnap.data()
                        if (profileData.profilePicture) {
                            setProfilePicture(profileData.profilePicture)
                        }
                    }
                } catch (error) {
                    console.error('Error fetching profile picture:', error)
                }
            }
        }
        fetchProfilePicture()
    }, [user?.uid])

    if (!isSplashComplete) return null

    return (
        <header className="mobile-header md:hidden">
            <div className="flex items-center justify-between h-full px-4">
                {/* Logo */}
                <Link href="/" className="flex items-center">
                    <img
                        src="/uolink-logo.png"
                        alt="UoLink"
                        className="h-16 w-auto"
                    />
                </Link>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    {authLoading ? (
                        <>
                            <div className="w-9 h-9 bg-amber-100 animate-pulse rounded-full" />
                            <div className="w-9 h-9 bg-amber-100 animate-pulse rounded-full" />
                        </>
                    ) : user ? (
                        <>
                            {/* Notification Bell */}
                            <button
                                className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center hover:bg-amber-100 transition-colors shadow-sm"
                                aria-label="Notifications"
                            >
                                <Bell size={18} strokeWidth={1.75} className="text-gray-700" />
                            </button>

                            {/* Profile Avatar */}
                            <Link href="/profile-edit" className="block">
                                {profilePicture ? (
                                    <img
                                        src={profilePicture}
                                        alt="Profile"
                                        className="w-9 h-9 rounded-full object-cover border-2 border-[#90c639] shadow-sm"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shadow-sm">
                                        <User size={18} strokeWidth={1.75} className="text-gray-600" />
                                    </div>
                                )}
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/auth"
                                className="text-gray-700 font-medium text-sm py-1.5 px-3 rounded-full border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
                            >
                                Login
                            </Link>
                            <Link
                                href="/auth?mode=register"
                                className="text-white bg-[#90c639] hover:bg-[#7ab332] transition-all font-semibold text-sm py-1.5 px-4 rounded-full shadow-sm"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
