'use client'

import React from 'react'
import { HeroStat } from './types'

interface ProfileStatsProps {
    heroStats: HeroStat[]
}

export default function ProfileStats({ heroStats }: ProfileStatsProps) {
    if (heroStats.length === 0) {
        return null
    }

    return (
        <section className="rounded-3xl border border-lime-100 bg-white px-4 py-5 shadow-sm sm:px-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {heroStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-[#f7fbe9] px-4 py-4 text-left sm:px-5">
                        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-[#5f7050]">
                            <span>{stat.label}</span>
                            <stat.icon className="h-4 w-4 text-[#90c639]" />
                        </div>
                        <p className="mt-3 text-xl font-semibold text-[#1f2f10] sm:text-2xl">{stat.value}</p>
                        {stat.hint && <p className="mt-1 text-xs text-[#4c5c3c]">{stat.hint}</p>}
                    </div>
                ))}
            </div>
        </section>
    )
}