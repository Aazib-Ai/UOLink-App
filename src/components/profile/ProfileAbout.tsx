'use client'

import React from 'react'
import { User, GraduationCap, Sparkles } from 'lucide-react'
import { ProfileData } from './types'
import { formatAura } from '@/lib/aura'

interface ProfileAboutProps {
    profile: ProfileData
    firstName: string
    major: string | null
    semester: string | null
    section: string | null
    stats: {
        totalNotes: number
        uniqueSubjects: number
        uniqueTeachers: number
    }
    aura: number
}

export default function ProfileAbout({
    profile,
    firstName,
    major,
    semester,
    section,
    stats,
    aura
}: ProfileAboutProps) {
    const trimmedAbout = profile.about?.trim()
    const displayAbout =
        trimmedAbout && trimmedAbout.length > 0
            ? trimmedAbout
            : `${firstName || profile.fullName} hasn't added an about section yet.`

    return (
        <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                    <User className="h-5 w-5 text-[#90c639]" />
                    About {firstName || profile.fullName}
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#334125]">
                    {displayAbout}
                </p>
            </div>

            <div className="space-y-6">
                <div className="rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                        <GraduationCap className="h-5 w-5 text-[#90c639]" />
                        Academic Snapshot
                    </div>
                    <dl className="mt-4 space-y-3 text-sm text-[#4c5c3c]">
                        <div className="flex items-center justify-between rounded-2xl bg-[#f7fbe9] px-4 py-3">
                            <dt>Major</dt>
                            <dd className="font-medium text-[#1f2f10]">{major ?? 'Not set'}</dd>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[#f7fbe9] px-4 py-3">
                            <dt>Semester</dt>
                            <dd className="font-medium text-[#1f2f10]">{semester ?? 'Not set'}</dd>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[#f7fbe9] px-4 py-3">
                            <dt>Section</dt>
                            <dd className="font-medium text-[#1f2f10]">{section ?? 'Not set'}</dd>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-lime-100">
                            <dt>Contributions</dt>
                            <dd className="text-right text-sm text-[#334125]">
                                {stats.totalNotes} note{stats.totalNotes === 1 ? '' : 's'} / {stats.uniqueSubjects} subject{stats.uniqueSubjects === 1 ? '' : 's'}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-lime-100">
                            <dt>Aura score</dt>
                            <dd className="font-medium text-[#1f2f10]">{formatAura(aura)}</dd>
                        </div>
                    </dl>
                </div>

                {profile.skills?.length > 0 && (
                    <div className="rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
                        <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                            <Sparkles className="h-5 w-5 text-[#90c639]" />
                            Skills & Tools
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {profile.skills.map((skill) =>
                                skill ? (
                                    <span
                                        key={skill}
                                        className="inline-flex items-center rounded-full border border-lime-100 bg-[#f7fbe9] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#5f7050]"
                                    >
                                        {skill}
                                    </span>
                                ) : null
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
