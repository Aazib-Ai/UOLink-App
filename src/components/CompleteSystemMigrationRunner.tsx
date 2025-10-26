'use client'

import React, { useState, useCallback } from 'react'
import { 
    Play, 
    CheckCircle, 
    AlertCircle, 
    Database, 
    Trash2, 
    Shield,
    Users,
    Settings,
    Eye
} from 'lucide-react'
import { 
    CompleteSystemMigrationService,
    SystemMigrationProgress,
    SystemMigrationOptions,
    runCompleteSystemMigration,
    validateCompleteSystemMigration,
    rollbackSystemMigration
} from '@/lib/migrations/complete-system-migration'

interface CompleteSystemMigrationRunnerProps {
    onComplete?: (progress: SystemMigrationProgress) => void
}

export default function CompleteSystemMigrationRunner({ onComplete }: CompleteSystemMigrationRunnerProps) {
    const [progress, setProgress] = useState<SystemMigrationProgress | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [isDryRun, setIsDryRun] = useState(true)
    const [batchSize, setBatchSize] = useState(50)
    const [cleanupLegacyFields, setCleanupLegacyFields] = useState(true)
    const [validationResult, setValidationResult] = useState<any>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [showRollback, setShowRollback] = useState(false)

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    }, [])

    const handleProgress = useCallback((newProgress: SystemMigrationProgress) => {
        setProgress(newProgress)
        
        const phaseNames = {
            'username_generation': 'Generating Usernames',
            'legacy_cleanup': 'Cleaning Legacy Fields',
            'validation': 'Validating Results',
            'complete': 'Complete'
        }
        
        addLog(`Phase: ${phaseNames[newProgress.phase]}`)
        
        if (newProgress.usernameMigration) {
            const um = newProgress.usernameMigration
            const percentage = um.totalUsers > 0 ? Math.round((um.processedUsers / um.totalUsers) * 100) : 0
            addLog(`Username Migration: ${percentage}% (${um.processedUsers}/${um.totalUsers}) - Success: ${um.successfulMigrations}, Failed: ${um.failedMigrations}`)
        }
        
        if (newProgress.legacyCleanup) {
            const lc = newProgress.legacyCleanup
            const percentage = lc.totalProfiles > 0 ? Math.round((lc.processedProfiles / lc.totalProfiles) * 100) : 0
            addLog(`Legacy Cleanup: ${percentage}% (${lc.processedProfiles}/${lc.totalProfiles}) - Cleaned: ${lc.cleanedFields} fields`)
        }
    }, [addLog])

    const runMigration = async () => {
        try {
            setIsRunning(true)
            setLogs([])
            addLog(`Starting complete system migration (${isDryRun ? 'DRY RUN' : 'LIVE'})`)

            const options: SystemMigrationOptions = {
                batchSize,
                dryRun: isDryRun,
                cleanupLegacyFields,
                onProgress: handleProgress
            }

            const finalProgress = await runCompleteSystemMigration(options)
            
            addLog(`Complete system migration finished!`)
            addLog(`Phase: ${finalProgress.phase}`)
            
            if (finalProgress.usernameMigration) {
                addLog(`Username Migration - Success: ${finalProgress.usernameMigration.successfulMigrations}, Failed: ${finalProgress.usernameMigration.failedMigrations}`)
            }
            
            if (finalProgress.legacyCleanup) {
                addLog(`Legacy Cleanup - Processed: ${finalProgress.legacyCleanup.processedProfiles} profiles, Cleaned: ${finalProgress.legacyCleanup.cleanedFields} fields`)
            }
            
            if (finalProgress.errors.length > 0) {
                addLog(`⚠️ Migration completed with ${finalProgress.errors.length} errors`)
                finalProgress.errors.forEach(error => addLog(`❌ ${error}`))
            }
            
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
            addLog('Starting complete system validation...')
            const result = await validateCompleteSystemMigration()
            setValidationResult(result)
            
            addLog(`Validation complete:`)
            addLog(`- Total profiles: ${result.totalProfiles}`)
            addLog(`- Profiles with usernames: ${result.profilesWithUsernames}`)
            addLog(`- Profiles with legacy fields: ${result.profilesWithLegacyFields}`)
            
            if (result.inconsistencies.length > 0) {
                addLog(`⚠️ Found ${result.inconsistencies.length} inconsistencies:`)
                result.inconsistencies.forEach(issue => addLog(`  • ${issue}`))
            } else {
                addLog('✅ No inconsistencies found - migration is valid!')
            }
        } catch (error) {
            addLog(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const runRollback = async () => {
        if (!confirm('⚠️ WARNING: This will remove all username data and restore the legacy system. Are you sure?')) {
            return
        }

        try {
            addLog('🔄 Starting system rollback...')
            await rollbackSystemMigration({ batchSize, dryRun: isDryRun })
            addLog('✅ Rollback completed')
            
            if (!isDryRun) {
                addLog('⚠️ Remember to manually clean up the "usernames" and "username_history" collections')
            }
        } catch (error) {
            addLog(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const getPhaseProgress = () => {
        if (!progress) return 0
        
        const phases = ['username_generation', 'legacy_cleanup', 'validation', 'complete']
        const currentPhaseIndex = phases.indexOf(progress.phase)
        
        if (progress.phase === 'complete') return 100
        
        let baseProgress = (currentPhaseIndex / phases.length) * 100
        
        // Add sub-progress for current phase
        if (progress.usernameMigration && progress.phase === 'username_generation') {
            const subProgress = progress.usernameMigration.totalUsers > 0 
                ? (progress.usernameMigration.processedUsers / progress.usernameMigration.totalUsers) * (100 / phases.length)
                : 0
            baseProgress += subProgress
        }
        
        return Math.round(baseProgress)
    }

    const getStatusColor = () => {
        if (!progress) return 'text-gray-500'
        if (progress.isComplete) {
            return progress.errors.length > 0 ? 'text-yellow-600' : 'text-green-600'
        }
        return isRunning ? 'text-blue-600' : 'text-gray-500'
    }

    const getStatusIcon = () => {
        if (!progress) return <Database className="h-5 w-5" />
        if (progress.isComplete) {
            return progress.errors.length > 0 
                ? <AlertCircle className="h-5 w-5" />
                : <CheckCircle className="h-5 w-5" />
        }
        return isRunning ? <Play className="h-5 w-5" /> : <Database className="h-5 w-5" />
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete System Migration</h2>
                <p className="text-gray-600">
                    Comprehensive migration that generates usernames for all users, cleans up legacy fields, 
                    and validates the entire system. This is the recommended approach for production deployment.
                </p>
            </div>

            {/* Configuration */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            Dry Run (preview only)
                        </label>
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="cleanupLegacy"
                            checked={cleanupLegacyFields}
                            onChange={(e) => setCleanupLegacyFields(e.target.checked)}
                            disabled={isRunning}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="cleanupLegacy" className="ml-2 block text-sm text-gray-700">
                            Clean up legacy fields
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
                            {getPhaseProgress()}%
                        </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getPhaseProgress()}%` }}
                        />
                    </div>

                    <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                            Current Phase: {progress.phase.replace('_', ' ').toUpperCase()}
                        </div>
                        
                        {/* Username Migration Progress */}
                        {progress.usernameMigration && (
                            <div className="mb-3 p-3 bg-white rounded border">
                                <h4 className="font-medium text-sm mb-2">Username Generation</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div>
                                        <div className="text-gray-600">Total</div>
                                        <div className="font-semibold">{progress.usernameMigration.totalUsers}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600">Processed</div>
                                        <div className="font-semibold">{progress.usernameMigration.processedUsers}</div>
                                    </div>
                                    <div>
                                        <div className="text-green-600">Success</div>
                                        <div className="font-semibold">{progress.usernameMigration.successfulMigrations}</div>
                                    </div>
                                    <div>
                                        <div className="text-red-600">Failed</div>
                                        <div className="font-semibold">{progress.usernameMigration.failedMigrations}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Legacy Cleanup Progress */}
                        {progress.legacyCleanup && (
                            <div className="mb-3 p-3 bg-white rounded border">
                                <h4 className="font-medium text-sm mb-2">Legacy Field Cleanup</h4>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                        <div className="text-gray-600">Total Profiles</div>
                                        <div className="font-semibold">{progress.legacyCleanup.totalProfiles}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600">Processed</div>
                                        <div className="font-semibold">{progress.legacyCleanup.processedProfiles}</div>
                                    </div>
                                    <div>
                                        <div className="text-blue-600">Fields Cleaned</div>
                                        <div className="font-semibold">{progress.legacyCleanup.cleanedFields}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {progress.isComplete && (
                        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
                            <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                <span className="text-green-800 font-medium">
                                    Complete system migration finished in {
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
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        System Validation Results
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                        <div>
                            <div className="text-gray-600">Total Profiles</div>
                            <div className="font-semibold text-lg">{validationResult.totalProfiles}</div>
                        </div>
                        <div>
                            <div className="text-gray-600">With Usernames</div>
                            <div className="font-semibold text-lg text-green-600">{validationResult.profilesWithUsernames}</div>
                        </div>
                        <div>
                            <div className="text-gray-600">With Legacy Fields</div>
                            <div className="font-semibold text-lg text-orange-600">{validationResult.profilesWithLegacyFields}</div>
                        </div>
                    </div>
                    
                    {validationResult.inconsistencies.length > 0 ? (
                        <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                            <h4 className="font-medium text-yellow-800 mb-2">
                                ⚠️ {validationResult.inconsistencies.length} Issues Found:
                            </h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {validationResult.inconsistencies.map((issue: string, index: number) => (
                                    <li key={index}>• {issue}</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="p-3 bg-green-100 border border-green-300 rounded-md">
                            <div className="flex items-center text-green-800">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                <span className="font-medium">✅ System validation passed - no issues found!</span>
                            </div>
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
                    {isRunning ? 'Running Migration...' : isDryRun ? 'Preview Complete Migration' : 'Run Live Migration'}
                </button>

                <button
                    onClick={validateMigration}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <CheckCircle className="h-4 w-4" />
                    Validate System
                </button>

                <button
                    onClick={() => setShowRollback(!showRollback)}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <Shield className="h-4 w-4" />
                    Emergency Tools
                </button>
            </div>

            {/* Emergency Rollback */}
            {showRollback && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <Trash2 className="h-5 w-5" />
                        Emergency Rollback
                    </h3>
                    <p className="text-sm text-red-700 mb-4">
                        ⚠️ <strong>DANGER:</strong> This will remove all username data and restore the legacy system. 
                        Only use this if the migration failed and you need to restore the previous state.
                    </p>
                    <button
                        onClick={runRollback}
                        disabled={isRunning}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-md font-medium hover:bg-red-800 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                        <Trash2 className="h-4 w-4" />
                        {isDryRun ? 'Preview Rollback' : 'Execute Rollback'}
                    </button>
                </div>
            )}

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

            {/* Important Notes */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                        <strong>Important Notes:</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                            <li>Always run a dry run first to preview all changes</li>
                            <li>Backup your database before running the live migration</li>
                            <li>The migration processes users in batches to avoid timeouts</li>
                            <li>Legacy field cleanup removes profileSlug and fullNameLower fields</li>
                            <li>Validation checks for data consistency after migration</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}