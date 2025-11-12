'use client'

import React from 'react'
import { Calendar } from 'lucide-react'
import { ProfileData, Badge, SocialLink } from './types'
import { getAuraTier } from '@/lib/aura'

interface ProfileHeaderProps {
    profile: ProfileData
    badges: Badge[]
    socialLinks: SocialLink[]
    joinedDate: string
    showJoinDate: boolean
    firstName: string
    heroTagline: string
}

export default function ProfileHeader({
    profile,
    badges,
    socialLinks,
    joinedDate,
    showJoinDate,
    firstName,
    heroTagline
}: ProfileHeaderProps) {
    const auraInfo = getAuraTier(profile.aura ?? 0)
    const trimmedBio = profile.bio?.trim()
    const displayName = profile.displayName || profile.fullName || profile.username || ''
    const displayBio =
        trimmedBio && trimmedBio.length > 0
            ? trimmedBio
            : `Say hi to ${firstName || displayName}. They are busy sharing knowledge with Uolink.`

    return (
        <section className="overflow-hidden rounded-3xl border border-lime-100 bg-white shadow-sm">
            <div className="bg-gradient-to-b from-[#f7fbe9] via-white to-white px-6 py-8 sm:px-8 lg:px-10">
                <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:gap-8 md:text-left">
                    <div className="relative">
                        <div className="relative h-24 w-24 overflow-hidden rounded-[28px] border border-lime-100 bg-[#e8f3d2] text-[#1f2f10] shadow-inner md:h-28 md:w-28">
                            {profile.profilePicture ? (
                                <img src={profile.profilePicture} alt={`${displayName}'s profile`} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold md:text-3xl">
                                    {(firstName || displayName)[0]}
                                </div>
                            )}
                        </div>
                        {auraInfo?.tier?.name && (
                            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1f2f10] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                                {auraInfo.tier.name}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-1 flex-col items-center md:items-start">
                        {showJoinDate && (
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#5f7050] ring-1 ring-lime-100">
                                <Calendar className="h-3 w-3 text-[#90c639]" />
                                Joined {joinedDate}
                            </div>
                        )}
                        <h1 className="mt-4 text-2xl font-semibold text-[#1f2f10] sm:text-3xl">{displayName}</h1>
                        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-[#5f7050]">{heroTagline}</p>
                        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#334125]">
                            {displayBio}
                        </p>
                        {badges.length > 0 && (
                            <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2 md:justify-start">
                                {badges.map((badge) => (
                                    <span
                                        key={badge.label}
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badge.classes}`}
                                    >
                                        {badge.label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {socialLinks.length > 0 && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                        {socialLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] transition hover:border-[#90c639] hover:text-[#1f2f10]"
                            >
                                <link.icon className="h-4 w-4 text-[#90c639]" />
                                {link.label}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
