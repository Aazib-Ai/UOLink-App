'use client'

import { useState } from 'react'
import { 
    migrateVibeScoreToCredibilityScore, 
    rollbackCredibilityScoreToVibeScore,
    checkMigrationStatus 
} from '@/lib/migrations/vibeScore-to-credibilityScore'

interface MigrationProgress {
    processed: number;
    updated: number;
    errors: number;
    total?: number;
}

interface MigrationStatus {
    totalNotes: number;
    notesWithVibeScore: number;
    notesWithCredibilityScore: number;
    needsMigration: number;
}

export const MigrationRunner = () => {
    const [isRunning, setIsRunning] = useState(false)
    const [progress, setProgress] = useState<MigrationProgress | null>(null)
    const [status, setStatus] = useState<MigrationStatus | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleCheckStatus = async () => {
        try {
            setError(null)
            const migrationStatus = await checkMigrationStatus()
            setStatus(migrationStatus)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check status')
        }
    }

    const handleMigrate = async () => {
        try {
            setIsRunning(true)
            setError(null)
            setProgress(null)

            const result = await migrateVibeScoreToCredibilityScore(50, (prog) => {
                setProgress(prog)
            })

            console.log('Migration completed:', result)
            await handleCheckStatus() // Refresh status
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Migration failed')
        } finally {
            setIsRunning(false)
        }
    }

    const handleRollback = async () => {
        try {
            setIsRunning(true)
            setError(null)
            setProgress(null)

            const result = await rollbackCredibilityScoreToVibeScore(50)
            console.log('Rollback completed:', result)
            await handleCheckStatus() // Refresh status
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Rollback failed')
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
                VibeScore → CredibilityScore Migration
            </h2>

            {/* Status Section */}
            <div className="mb-6">
                <button
                    onClick={handleCheckStatus}
                    disabled={isRunning}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    Check Migration Status
                </button>

                {status && (
                    <div className="mt-4 p-4 bg-gray-50 rounded">
                        <h3 className="font-semibold mb-2">Current Status:</h3>
                        <ul className="space-y-1 text-sm">
                            <li>Total Notes: {status.totalNotes}</li>
                            <li>Notes with vibeScore: {status.notesWithVibeScore}</li>
                            <li>Notes with credibilityScore: {status.notesWithCredibilityScore}</li>
                            <li className="font-medium text-orange-600">
                                Needs Migration: {status.needsMigration}
                            </li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Migration Actions */}
            <div className="space-y-4">
                <button
                    onClick={handleMigrate}
                    disabled={isRunning}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 font-medium"
                >
                    {isRunning ? 'Running Migration...' : 'Start Migration'}
                </button>

                <button
                    onClick={handleRollback}
                    disabled={isRunning}
                    className="w-full px-4 py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 font-medium"
                >
                    {isRunning ? 'Running Rollback...' : 'Rollback Migration (Testing Only)'}
                </button>
            </div>

            {/* Progress Display */}
            {progress && (
                <div className="mt-6 p-4 bg-blue-50 rounded">
                    <h3 className="font-semibold mb-2">Migration Progress:</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span>Processed:</span>
                            <span>{progress.processed}{progress.total ? ` / ${progress.total}` : ''}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Updated:</span>
                            <span className="text-green-600">{progress.updated}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Errors:</span>
                            <span className="text-red-600">{progress.errors}</span>
                        </div>
                        {progress.total && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
                    <h3 className="font-semibold text-red-800 mb-2">Error:</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Instructions */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <h3 className="font-semibold text-yellow-800 mb-2">Instructions:</h3>
                <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                    <li>First, check the migration status to see how many notes need updating</li>
                    <li>Run the migration to convert all vibeScore fields to credibilityScore</li>
                    <li>The migration is safe and can be run multiple times</li>
                    <li>Use rollback only for testing purposes</li>
                </ol>
            </div>
        </div>
    )
}