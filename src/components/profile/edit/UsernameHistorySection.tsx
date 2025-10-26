'use client'

import React, { useState, useEffect } from 'react'
import { History, Clock, ArrowRight, ExternalLink } from 'lucide-react'
import { getUsernameHistory } from '@/lib/firebase/usernames'
import type { UsernameHistoryRecord } from '@/lib/firebase/usernames'

interface UsernameHistorySectionProps {
    userId: string
    currentUsername?: string
}

export default function UsernameHistorySection({ userId, currentUsername }: UsernameHistorySectionProps) {
    const [history, setHistory] = useState<UsernameHistoryRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadHistory = async () => {
        if (!userId) return

        setIsLoading(true)
        setError(null)

        try {
            const historyRecords = await getUsernameHistory(userId, 10)
            setHistory(historyRecords)
        } catch (err) {
            console.error('Error loading username history:', err)
            setError('Failed to load username history')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (showHistory && userId) {
            loadHistory()
        }
    }, [showHistory, userId])

    const formatDate = (timestamp: any) => {
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch (error) {
            return 'Invalid date'
        }
    }

    const isAliasActive = (record: UsernameHistoryRecord) => {
        try {
            const expiryDate = record.aliasExpiresAt && typeof record.aliasExpiresAt.toDate === 'function' ? 
                record.aliasExpiresAt.toDate() : 
                new Date(record.aliasExpiresAt as any)
            return expiryDate > new Date()
        } catch (error) {
            return false
        }
    }

    const getAliasExpiryDate = (record: UsernameHistoryRecord) => {
        try {
            const expiryDate = record.aliasExpiresAt && typeof record.aliasExpiresAt.toDate === 'function' ? 
                record.aliasExpiresAt.toDate() : 
                new Date(record.aliasExpiresAt as any)
            return expiryDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        } catch (error) {
            return 'Unknown'
        }
    }

    if (!userId) {
        return null
    }

    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
                <History className="h-4 w-4" />
                {showHistory ? 'Hide' : 'Show'} Username History
                {history.length > 0 && !showHistory && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {history.length}
                    </span>
                )}
            </button>

            {showHistory && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-4">
                        <History className="h-5 w-5 text-gray-600" />
                        <h4 className="font-medium text-gray-800">Username Change History</h4>
                    </div>

                    {isLoading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600"></div>
                            <span className="ml-2 text-sm text-gray-600">Loading history...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {!isLoading && !error && history.length === 0 && (
                        <div className="text-center py-8">
                            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">No username changes yet</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Your username change history will appear here
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && history.length > 0 && (
                        <div className="space-y-3">
                            {/* Current Username */}
                            {currentUsername && (
                                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <div>
                                            <p className="font-medium text-green-800">{currentUsername}</p>
                                            <p className="text-xs text-green-600">Current username</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                        Active
                                    </span>
                                </div>
                            )}

                            {/* History Records */}
                            {history.map((record, index) => (
                                <div key={record.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="font-mono text-sm text-gray-700 truncate">
                                                {record.oldUsername}
                                            </span>
                                            <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                            <span className="font-mono text-sm text-gray-900 truncate">
                                                {record.newUsername}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right ml-4">
                                        <p className="text-xs text-gray-600">
                                            {formatDate(record.changedAt)}
                                        </p>
                                        {isAliasActive(record) && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                                    Alias active
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    until {getAliasExpiryDate(record)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Alias Information */}
                    {!isLoading && !error && history.some(record => isAliasActive(record)) && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-start gap-2">
                                <ExternalLink className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h5 className="text-sm font-medium text-blue-800">Active Aliases</h5>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Old usernames with active aliases will redirect to your current profile for 90 days. 
                                        This ensures existing links continue to work after username changes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History Guidelines */}
                    <div className="mt-4 p-3 bg-gray-100 rounded-md">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">About Username History</h5>
                        <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Username changes are tracked for security and audit purposes</li>
                            <li>• Old usernames redirect to your current profile for 90 days</li>
                            <li>• You can change your username once every 30 days</li>
                            <li>• History is kept for account security and support purposes</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}