'use client'

import { useState, useEffect } from 'react'
import { 
    usernameCache, 
    warmUsernameCache, 
    getCacheWarmingStats,
    schedulePeriodicCacheWarming 
} from '@/lib/firebase'

interface CacheStats {
    hits: number
    misses: number
    entries: number
    hitRate: number
}

interface MostAccessedEntry {
    username: string
    accessCount: number
    profile: any
}

export default function CacheManagementPanel() {
    const [stats, setStats] = useState<CacheStats | null>(null)
    const [mostAccessed, setMostAccessed] = useState<MostAccessedEntry[]>([])
    const [isWarming, setIsWarming] = useState(false)
    const [isScheduled, setIsScheduled] = useState(false)

    const refreshStats = () => {
        const cacheStats = getCacheWarmingStats()
        setStats(cacheStats.cacheStats)
        setMostAccessed(cacheStats.mostAccessed)
    }

    useEffect(() => {
        refreshStats()
        
        // Refresh stats every 10 seconds
        const interval = setInterval(refreshStats, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleWarmCache = async () => {
        setIsWarming(true)
        try {
            await warmUsernameCache()
            refreshStats()
        } catch (error) {
            console.error('Error warming cache:', error)
        } finally {
            setIsWarming(false)
        }
    }

    const handleClearCache = () => {
        usernameCache.clear()
        refreshStats()
    }

    const handleScheduleWarming = () => {
        if (!isScheduled) {
            schedulePeriodicCacheWarming(60) // Every hour
            setIsScheduled(true)
        }
    }

    if (!stats) {
        return (
            <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Username Cache Management
            </h3>

            {/* Cache Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-600">Cache Hits</div>
                    <div className="text-2xl font-bold text-blue-900">{stats.hits}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-red-600">Cache Misses</div>
                    <div className="text-2xl font-bold text-red-900">{stats.misses}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-green-600">Hit Rate</div>
                    <div className="text-2xl font-bold text-green-900">
                        {(stats.hitRate * 100).toFixed(1)}%
                    </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-purple-600">Cached Entries</div>
                    <div className="text-2xl font-bold text-purple-900">{stats.entries}</div>
                </div>
            </div>

            {/* Cache Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
                <button
                    onClick={handleWarmCache}
                    disabled={isWarming}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isWarming ? 'Warming Cache...' : 'Warm Cache'}
                </button>
                
                <button
                    onClick={handleClearCache}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    Clear Cache
                </button>
                
                <button
                    onClick={handleScheduleWarming}
                    disabled={isScheduled}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isScheduled ? 'Warming Scheduled' : 'Schedule Auto-Warming'}
                </button>
                
                <button
                    onClick={refreshStats}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                    Refresh Stats
                </button>
            </div>

            {/* Most Accessed Profiles */}
            {mostAccessed.length > 0 && (
                <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                        Most Accessed Profiles
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-2">
                            {mostAccessed.slice(0, 10).map((entry, index) => (
                                <div key={entry.username} className="flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-sm font-medium text-gray-500">
                                            #{index + 1}
                                        </span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {entry.username}
                                        </span>
                                        {entry.profile && (
                                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                                Cached
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm text-gray-600">
                                        {entry.accessCount} accesses
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Cache Performance Indicator */}
            <div className="mt-4 p-3 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                        Cache Performance
                    </span>
                    <div className="flex items-center space-x-2">
                        <div 
                            className={`w-3 h-3 rounded-full ${
                                stats.hitRate > 0.8 ? 'bg-green-500' :
                                stats.hitRate > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                        />
                        <span className="text-sm text-gray-600">
                            {stats.hitRate > 0.8 ? 'Excellent' :
                             stats.hitRate > 0.6 ? 'Good' : 'Needs Improvement'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}