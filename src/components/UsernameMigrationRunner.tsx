'use client'

import React, { useState, useCallback } from 'react'
import { Play, Pause, CheckCircle, AlertCircle, Users, Database } from 'lucide-react'
import { 
    UsernameMigrationService, 
    MigrationProgress, 
    MigrationBatch,
    MigrationOptions,
    validateUsernameMigration 
} from '@/lib/migrations/username-migration'

interface MigrationRunnerProps {
    onComplete?: (progress: MigrationProgress) => void
}

export default function UsernameMigrationRunner({ onComplete }: MigrationRunnerProps) {
    const [migrationService] = useState(() => new UsernameMigrationService())
    const [progress, setProgress] = useState<MigrationProgress | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [isDryRun, setIsDryRun] = useState(true)
    const [batchSize, setBatchSize] = useState(50)
    const [validationResult, setValidationResult] = useState<any>(null)
    const [logs, setLogs] = useState<string[]>([])

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    }, [])

    const handleProgress = useCallback((newProgress: MigrationProgress) => {
        setProgress(newProgress)
        
        const percentage = newProgress.totalUsers > 0 
            ? Math.round((newProgress.processedUsers / newProgress.totalUsers) * 100)
            : 0
            
        addLog(`Progress: ${percentage}% (${newProgress.processedUsers}/${newProgress.totalUsers}) - Success: ${newProgress.successfulMigrations}, Failed: ${newProgress.failedMigrations}`)
    }, [addLog])

    const handleBatchComplete = useCallback((batch: MigrationBatch, progress: MigrationProgress) => {
        addLog(`Batch ${batch.batchNumber}/${batch.totalBatches} completed (${batch.users.length} users)`)
    }, [addLog])

    const runMigration = async () => {
        try {
            setIsRunning(true)
            setLogs([])
            addLog(`Starting ${isDryRun ? 'DRY RUN' : 'LIVE'} migration with batch size ${batchSize}`)

            const options: MigrationOptions = {
                batchSize,
                dryRun: isDryRun,
                skipExisting: true,
                onProgress: handleProgress,
                onBatchComplete: handleBatchComplete
            }

            const finalProgress = await migrationService.executeMigration(options)
            
            addLog(`Migration completed! Success: ${finalProgress.successfulMigrations}, Failed: ${finalProgress.failedMigrations}`)
            
            if (onComplete) {
                onComplete(finalProgress)
            }
        } catch (error) {
            addLog(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            console.error('Migration error:', error)
        } finally {
            setIsRunning(false)
        }
    }

    const validateMigration = async () => {
        try {
            addLog('Starting migration validation...')
            const result = await validateUsernameMigration()
            setValidationResult(result)
            
            addLog(`Validation complete: ${result.profilesWithUsernames}/${result.totalProfiles} profiles have usernames`)
            
            if (result.inconsistencies.length > 0) {
                result.inconsistencies.forEach(issue => addLog(`⚠️ ${issue}`))
            } else {
                addLog('✅ No inconsistencies found')
            }
        } catch (error) {
            addLog(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const getProgressPercentage = () => {
        if (!progress || progress.totalUsers === 0) return 0
        return Math.round((progress.processedUsers / progress.totalUsers) * 100)
    }

    const getStatusColor = () => {
        if (!progress) return 'text-gray-500'
        if (progress.isComplete) {
            return progress.failedMigrations > 0 ? 'text-yellow-600' : 'text-green-600'
        }
        return isRunning ? 'text-blue-600' : 'text-gray-500'
    }

    const getStatusIcon = () => {
        if (!progress) return <Database className="h-5 w-5" />
        if (progress.isComplete) {
            return progress.failedMigrations > 0 
                ? <AlertCircle className="h-5 w-5" />
                : <CheckCircle className="h-5 w-5" />
        }
        return isRunning ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Username Migration Tool</h2>
                <p className="text-gray-600">
                    Migrate existing user profiles to the new username system. This will generate unique usernames 
                    for all users based on their display names.
                </p>
            </div>

            {/* Configuration */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Batch Size
                        </label>
                        <input
                            type="number"
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                            min="10"
                            max="100"
                            disabled={isRunning}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="dryRun"
                            checked={isDryRun}
                            onChange={(e) => setIsDryRun(e.target.checked)}
                            disabled={isRunning}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="dryRun" className="ml-2 block text-sm text-gray-700">
                            Dry Run (preview only, no changes)
                        </label>
                    </div>
                </div>
            </div>

            {/* Progress */}
            {progress && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className={getStatusColor()}>
                                {getStatusIcon()}
                            </div>
                            <h3 className="text-lg font-semibold">Migration Progress</h3>
                        </div>
                        <span className="text-sm text-gray-600">
                            {getProgressPercentage()}%
                        </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgressPercentage()}%` }}
                        />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-gray-600">Total Users</div>
                            <div className="font-semibold">{progress.totalUsers}</div>
                        </div>
                        <div>
                            <div className="text-gray-600">Processed</div>
                            <div className="font-semibold">{progress.processedUsers}</div>
                        </div>
                        <div>
                            <div className="text-green-600">Successful</div>
                            <div className="font-semibold">{progress.successfulMigrations}</div>
                        </div>
                        <div>
                            <div className="text-red-600">Failed</div>
                            <div className="font-semibold">{progress.failedMigrations}</div>
                        </div>
                    </div>

                    {progress.isComplete && (
                        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
                            <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                <span className="text-green-800 font-medium">
                                    Migration completed in {
                                        progress.endTime && progress.startTime
                                            ? Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000)
                                            : 0
                                    } seconds
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Validation Results */}
            {validationResult && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Validation Results</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-gray-600">Total Profiles</div>
                            <div className="font-semibold">{validationResult.totalProfiles}</div>
                        </div>
                        <div>
                            <div className="text-gray-600">With Usernames</div>
                            <div className="font-semibold">{validationResult.profilesWithUsernames}</div>
                        </div>
                        <div>
                            <div className="text-gray-600">Username Records</div>
                            <div className="font-semibold">{validationResult.totalUsernameRecords}</div>
                        </div>
                    </div>
                    
                    {validationResult.inconsistencies.length > 0 && (
                        <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                            <h4 className="font-medium text-yellow-800 mb-2">Inconsistencies Found:</h4>
                            <ul className="text-sm text-yellow-700">
                                {validationResult.inconsistencies.map((issue: string, index: number) => (
                                    <li key={index}>• {issue}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="mb-6 flex flex-wrap gap-3">
                <button
                    onClick={runMigration}
                    disabled={isRunning}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium ${
                        isRunning
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : isDryRun
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                    <Users className="h-4 w-4" />
                    {isRunning ? 'Running...' : isDryRun ? 'Run Dry Migration' : 'Run Live Migration'}
                </button>

                <button
                    onClick={validateMigration}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <CheckCircle className="h-4 w-4" />
                    Validate Migration
                </button>
            </div>

            {/* Logs */}
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <h3 className="text-white font-semibold mb-2">Migration Logs</h3>
                <div className="h-64 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="text-gray-500">No logs yet. Run migration to see progress...</div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className="mb-1">
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Warning */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                        <strong>Important:</strong> Always run a dry run first to preview changes. 
                        The live migration will permanently modify user profiles and create username records. 
                        Make sure to backup your database before running the live migration.
                    </div>
                </div>
            </div>
        </div>
    )
}