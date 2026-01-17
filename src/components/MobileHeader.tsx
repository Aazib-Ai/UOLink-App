'use client'

import Link from 'next/link'
import { Bell, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSplash } from '@/contexts/SplashContext'
import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function MobileHeader() {
    const { user, loading: authLoading } = useAuth()
    const { isSplashComplete } = useSplash()
    const [profilePicture, setProfilePicture] = useState<string | null>(null)
    const [isHidden, setIsHidden] = useState(false)
    const [lastScrollY, setLastScrollY] = useState(0)

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

    // Scroll detection for hide/show
    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY

        // Only hide/show after scrolling past 50px
        if (currentScrollY < 50) {
            setIsHidden(false)
            setLastScrollY(currentScrollY)
            return
        }

        // Hide when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsHidden(true)
        } else if (currentScrollY < lastScrollY) {
            setIsHidden(false)
        }

        setLastScrollY(currentScrollY)
    }, [lastScrollY])

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    if (!isSplashComplete) return null

    return (
        <header
            className={`mobile-header md:hidden transition-transform duration-300 ease-out ${isHidden ? '-translate-y-full' : 'translate-y-0'
                }`}
        >
            <div className="flex items-center justify-between h-full px-4 max-w-lg mx-auto">
                {/* Logo - Larger and prominent */}
                <Link href="/" className="flex items-center">
                    <img
                        src="/uolink-logo.png"
                        alt="UoLink"
                        className="h-20 w-auto"
                    />
                </Link>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    {authLoading ? (
                        <>
                            <div className="w-10 h-10 bg-yellow-100/70 animate-pulse rounded-full" />
                            <div className="w-10 h-10 bg-yellow-100/70 animate-pulse rounded-full" />
                        </>
                    ) : user ? (
                        <>
                            {/* Notification Bell */}
                            <button
                                className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm border border-yellow-300/80 flex items-center justify-center hover:bg-white/80 active:scale-95 transition-all shadow-sm"
                                aria-label="Notifications"
                            >
                                <Bell size={20} strokeWidth={1.5} className="text-yellow-700" />
                            </button>

                            {/* Profile Avatar */}
                            <Link href="/profile-edit" className="block">
                                {profilePicture ? (
                                    <img
                                        src={profilePicture}
                                        alt="Profile"
                                        className="w-10 h-10 rounded-full object-cover ring-2 ring-[#90c639] ring-offset-1"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm border border-yellow-300/80 flex items-center justify-center shadow-sm">
                                        <User size={20} strokeWidth={1.5} className="text-yellow-700" />
                                    </div>
                                )}
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/auth"
                                className="text-yellow-800 font-semibold text-sm py-2 px-4 rounded-full border border-yellow-300/80 bg-white/60 backdrop-blur-sm hover:bg-white/80 active:scale-95 transition-all"
                            >
                                Login
                            </Link>
                            <Link
                                href="/auth?mode=register"
                                className="text-white bg-[#90c639] hover:bg-[#7ab332] active:scale-95 transition-all font-bold text-sm py-2 px-4 rounded-full shadow-md"
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
