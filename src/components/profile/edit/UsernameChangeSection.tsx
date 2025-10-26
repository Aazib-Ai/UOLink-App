'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
    User, 
    Check, 
    X, 
    AlertCircle, 
    Clock, 
    ExternalLink,
    Loader2
} from 'lucide-react'
import { 
    checkAvailability, 
    changeUsername, 
    generateSuggestions 
} from '@/lib/firebase/username-service'
import { validateUsername } from '@/lib/username/validation'
import { generateProfileUrl } from '@/lib/firebase/profile-resolver'
import UsernameHistorySection from './UsernameHistorySection'

interface UsernameChangeSectionProps {
    currentUsername?: string
    userId: string
    usernameLastChanged?: Date
    onUsernameChanged?: (newUsername: string) => void
}

export default function UsernameChangeSection({ 
    currentUsername, 
    userId, 
    usernameLastChanged,
    onUsernameChanged 
}: UsernameChangeSectionProps) {
    const [newUsername, setNewUsername] = useState('')
    const [isChecking, setIsChecking] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [availability, setAvailability] = useState<{
        isAvailable: boolean | null
        message: string
        suggestions?: string[]
    }>({ isAvailable: null, message: '' })
    const [showChangeForm, setShowChangeForm] = useState(false)
    const [cooldownInfo, setCooldownInfo] = useState<{
        isInCooldown: boolean
        remainingDays: number
        nextChangeDate: Date | null
    }>({ isInCooldown: false, remainingDays: 0, nextChangeDate: null })

    // Check cooldown status
    useEffect(() => {
        if (usernameLastChanged) {
            const lastChangeTime = usernameLastChanged instanceof Date 
                ? usernameLastChanged.getTime() 
                : new Date(usernameLastChanged).getTime()
            
            const cooldownPeriod = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
            const timeSinceLastChange = Date.now() - lastChangeTime
            const remainingCooldown = cooldownPeriod - timeSinceLastChange
            
            if (remainingCooldown > 0) {
                const remainingDays = Math.ceil(remainingCooldown / (24 * 60 * 60 * 1000))
                const nextChangeDate = new Date(lastChangeTime + cooldownPeriod)
                
                setCooldownInfo({
                    isInCooldown: true,
                    remainingDays,
                    nextChangeDate
                })
            } else {
                setCooldownInfo({
                    isInCooldown: false,
                    remainingDays: 0,
                    nextChangeDate: null
                })
            }
        }
    }, [usernameLastChanged])

    // Debounced username availability check
    useEffect(() => {
        if (!newUsername.trim() || newUsername === currentUsername) {
            setAvailability({ isAvailable: null, message: '' })
            return
        }

        const checkUsernameAvailability = async () => {
            setIsChecking(true)
            
            try {
                // Validate format first
                const validation = validateUsername(newUsername)
                if (!validation.isValid) {
                    setAvailability({
                        isAvailable: false,
                        message: validation.errors[0] || 'Invalid username format'
                    })
                    return
                }

                // Check availability
                const isAvailable = await checkAvailability(newUsername)
                
                if (isAvailable) {
                    setAvailability({
                        isAvailable: true,
                        message: 'Username is available!'
                    })
                } else {
                    // Generate suggestions
                    const suggestions = await generateSuggestions(newUsername)
                    setAvailability({
                        isAvailable: false,
                        message: 'Username is already taken',
                        suggestions: suggestions.slice(0, 3)
                    })
                }
            } catch (error) {
                setAvailability({
                    isAvailable: false,
                    message: 'Error checking availability. Please try again.'
                })
            } finally {
                setIsChecking(false)
            }
        }

        // Debounce the check
        const timeoutId = setTimeout(checkUsernameAvailability, 500)
        return () => clearTimeout(timeoutId)
    }, [newUsername, currentUsername])

    const handleUsernameChange = async () => {
        if (!newUsername.trim() || !availability.isAvailable || cooldownInfo.isInCooldown) {
            return
        }

        setIsChanging(true)
        
        try {
            await changeUsername(userId, newUsername)
            
            // Update parent component
            if (onUsernameChanged) {
                onUsernameChanged(newUsername)
            }
            
            // Reset form
            setShowChangeForm(false)
            setNewUsername('')
            setAvailability({ isAvailable: null, message: '' })
            
            // Update cooldown info
            setCooldownInfo({
                isInCooldown: true,
                remainingDays: 30,
                nextChangeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            })
            
        } catch (error) {
            setAvailability({
                isAvailable: false,
                message: error instanceof Error ? error.message : 'Failed to change username'
            })
        } finally {
            setIsChanging(false)
        }
    }

    const handleSuggestionClick = (suggestion: string) => {
        setNewUsername(suggestion)
    }

    const currentProfileUrl = currentUsername ? generateProfileUrl(currentUsername) : null

    return (
        <section className="rounded-2xl border border-lime-100 bg-white/90 p-4 sm:p-5 shadow-sm">
            <div className="mb-4">
                <p className="text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">
                    Profile URL
                </p>
                <h3 className="text-base sm:text-lg font-semibold text-[#1f2f10]">Username & Profile Link</h3>
            </div>

            {/* Current Username Display */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Current Username
                </label>

                <div className="space-y-3">
                    {currentUsername ? (
                        <div>
                            <p className="font-mono text-sm bg-white px-3 py-2 rounded border">
                                {currentUsername}
                            </p>
                            {currentProfileUrl && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <span className="text-xs text-gray-600">Profile URL:</span>
                                    <a
                                        href={currentProfileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                    >
                                        uolink.com{currentProfileUrl}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No username set</p>
                    )}

                    {!showChangeForm && (
                        <div className="pt-2 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => setShowChangeForm(true)}
                                disabled={cooldownInfo.isInCooldown}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
                            >
                                <User className="h-4 w-4" />
                                Change Username
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Cooldown Warning */}
            {cooldownInfo.isInCooldown && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-medium text-yellow-800">
                                Username Change Cooldown
                            </h4>
                            <p className="text-sm text-yellow-700 mt-1">
                                You can change your username again in {cooldownInfo.remainingDays} days
                                {cooldownInfo.nextChangeDate && (
                                    <span className="block text-xs mt-1">
                                        Next change available: {cooldownInfo.nextChangeDate.toLocaleDateString()}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Username Change Form */}
            {showChangeForm && !cooldownInfo.isInCooldown && (
                <div className="space-y-4 sm:space-y-6">
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            New Username
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                                placeholder="Enter new username"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                disabled={isChanging}
                            />
                            {isChecking && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                </div>
                            )}
                        </div>
                        
                        {/* Availability Status */}
                        {newUsername.trim() && newUsername !== currentUsername && !isChecking && (
                            <div className="mt-2">
                                {availability.isAvailable === true && (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <Check className="h-4 w-4" />
                                        <span className="text-sm">{availability.message}</span>
                                    </div>
                                )}
                                
                                {availability.isAvailable === false && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-red-600">
                                            <X className="h-4 w-4" />
                                            <span className="text-sm">{availability.message}</span>
                                        </div>
                                        
                                        {availability.suggestions && availability.suggestions.length > 0 && (
                                            <div>
                                                <p className="text-xs text-gray-600 mb-2">Try these suggestions:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {availability.suggestions.map((suggestion, index) => (
                                                        <button
                                                            key={index}
                                                            type="button"
                                                            onClick={() => handleSuggestionClick(suggestion)}
                                                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                        >
                                                            {suggestion}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Preview New URL */}
                    {newUsername.trim() && availability.isAvailable && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-800 mb-1">New profile URL:</p>
                            <p className="font-mono text-xs sm:text-sm text-blue-900 break-all">
                                uolink.com{generateProfileUrl(newUsername)}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={handleUsernameChange}
                            disabled={!availability.isAvailable || isChanging}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
                        >
                            {isChanging ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Changing...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4" />
                                    Change Username
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setShowChangeForm(false)
                                setNewUsername('')
                                setAvailability({ isAvailable: null, message: '' })
                            }}
                            disabled={isChanging}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:bg-gray-400 w-full sm:w-auto"
                        >
                            <X className="h-4 w-4" />
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Username History */}
            <UsernameHistorySection 
                userId={userId} 
                currentUsername={currentUsername} 
            />

            {/* Username Guidelines */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <h4 className="text-xs sm:text-sm font-medium text-gray-800 mb-2">Username Guidelines</h4>
                <ul className="text-xs text-gray-600 space-y-1 sm:space-y-1.5 leading-relaxed">
                    <li>• 3-30 characters long</li>
                    <li>• Only letters, numbers, hyphens, and underscores</li>
                    <li>• Must start and end with a letter or number</li>
                    <li>• Cannot use reserved words (admin, api, etc.)</li>
                    <li>• Can only be changed once every 30 days</li>
                </ul>
            </div>
        </section>
    )
}