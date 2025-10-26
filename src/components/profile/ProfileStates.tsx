'use client'

import React from 'react'
import { ArrowLeft, User, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ProfileSkeleton } from '@/components/skeletons'

interface ProfileLoadingProps {
    Navbar: React.ComponentType
}

export function ProfileLoading({ Navbar }: ProfileLoadingProps) {
    return <ProfileSkeleton Navbar={Navbar} />
}

interface ProfileErrorProps {
    Navbar: React.ComponentType
    error: string | null
}

export function ProfileError({ Navbar, error }: ProfileErrorProps) {
    const router = useRouter()

    return (
        <React.Fragment>
            <Navbar />
            <main className="min-h-screen bg-[#f6f9ee]">
                <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
                    <div className="w-full rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-10">
                        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3d2]">
                            <User className="h-6 w-6 text-[#90c639]" />
                        </div>
                        <h1 className="text-xl font-semibold text-[#1f2f10]">We couldn't load that profile</h1>
                        <p className="mt-3 text-sm text-[#4c5c3c]">
                            {error || 'This profile might be private or still getting set up. Try again later or head back to your notes.'}
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] transition hover:border-[#90c639] hover:text-[#1f2f10]"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Go back
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7ab332]"
                            >
                                <Sparkles className="h-4 w-4" />
                                Explore Uolink
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </React.Fragment>
    )
}