'use client'

import React, { useState, useCallback } from 'react'
import { 
    Trash2, 
    CheckCircle, 
    AlertCircle, 
    Code, 
    FileText,
    Search,
    Shield
} from 'lucide-react'
import { 
    LegacyProfileCleanupService,
    LegacyCleanupReport,
    checkLegacyFieldUsage,
    generateMigrationChecklist,
    checkCleanupReadiness,
    runLegacyCleanup
} from '@/lib/migrations/legacy-cleanup'

export default function LegacyCleanupRunner() {
    const [cleanupReport, setCleanupReport] = useState<LegacyCleanupReport | null>(null)
    const [readinessCheck, setReadinessCheck] = useState<any>(null)
    const [fieldUsage, setFieldUsage] = useState<any>(null)
    const [checklist, setChecklist] = useState<any>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [logs, setLogs] = useState<string[]>([])

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    }, [])

    const checkReadiness = async () => {
        try {
            addLog('Checking system readiness for legacy cleanup...')
            const result = await checkCleanupReadiness()
            setReadinessCheck(result)
            
            if (result.isReady) {
                addLog('✅ System is ready for legacy cleanup')
            } else {
                addLog(`⚠️ System not ready: ${result.issues.length} issues found`)
                result.issues.forEach(issue => addLog(`  • ${issue}`))
            }
            
            addLog('Recommendations:')
            result.recommendations.forEach(rec => addLog(`  • ${rec}`))
        } catch (error) {
            addLog(`Error checking readiness: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const scanFieldUsage = () => {
        try {
            addLog('Scanning codebase for legacy field usage...')
            const usage = checkLegacyFieldUsage()
            setFieldUsage(usage)
            
            addLog('Legacy field usage scan complete:')
            addLog(`profileSlug usage: ${usage.profileSlugUsage.length} locations`)
            addLog(`fullNameLower usage: ${usage.fullNameLowerUsage.length} locations`)
            addLog(`slugify usage: ${usage.slugifyUsage.length} locations`)
        } catch (error) {
            addLog(`Error scanning field usage: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const generateChecklist = () => {
        try {
            addLog('Generating migration completion checklist...')
            const list = generateMigrationChecklist()
            setChecklist(list)
            
            addLog(`Checklist generated:`)
            addLog(`✅ Completed: ${list.completed.length} items`)
            addLog(`⏳ Pending: ${list.pending.length} items`)
            addLog(`🔧 Optional: ${list.optional.length} items`)
        } catch (error) {
            addLog(`Error generating checklist: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const runCleanup = async (removeDeprecatedCode: boolean = false) => {
        try {
            setIsRunning(true)
            addLog(`Starting legacy cleanup (${removeDeprecatedCode ? 'remove deprecated code' : 'mark as deprecated only'})...`)
            
            const report = runLegacyCleanup({ removeDeprecatedCode })
            setCleanupReport(report)
            
            addLog('Legacy cleanup completed:')
            addLog(`Functions processed: ${report.functionsRemoved.length}`)
            addLog(`References updated: ${report.referencesUpdated.length}`)
            addLog(`Files modified: ${report.filesModified.length}`)
            
            if (report.errors.length > 0) {
                addLog(`❌ Errors: ${report.errors.length}`)
                report.errors.forEach(error => addLog(`  • ${error}`))
            }
            
            if (report.warnings.length > 0) {
                addLog(`⚠️ Warnings: ${report.warnings.length}`)
                report.warnings.forEach(warning => addLog(`  • ${warning}`))
            }
            
        } catch (error) {
            addLog(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Legacy Profile System Cleanup</h2>
                <p className="text-gray-600">
                    Clean up legacy profile system code after username migration is complete. 
                    This removes deprecated functions, unused imports, and legacy field references.
                </p>
            </div>

            {/* Readiness Check */}
            {readinessCheck && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        System Readiness Check
                    </h3>
                    
                    <div className={`p-3 rounded-md mb-4 ${
                        readinessCheck.isReady 
                            ? 'bg-green-100 border border-green-300' 
                            : 'bg-yellow-100 border border-yellow-300'
                    }`}>
                        <div className="flex items-center">
                            {readinessCheck.isReady ? (
                                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                            )}
                            <span className={`font-medium ${
                                readinessCheck.isReady ? 'text-green-800' : 'text-yellow-800'
                            }`}>
                                {readinessCheck.isReady 
                                    ? 'System is ready for legacy cleanup' 
                                    : `${readinessCheck.issues.length} issues need attention`
                                }
                            </span>
                        </div>
                    </div>

                    {readinessCheck.issues.length > 0 && (
                        <div className="mb-4">
                            <h4 className="font-medium text-red-800 mb-2">Issues:</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                                {readinessCheck.issues.map((issue: string, index: number) => (
                                    <li key={index}>• {issue}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <h4 className="font-medium text-blue-800 mb-2">Recommendations:</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                            {readinessCheck.recommendations.map((rec: string, index: number) => (
                                <li key={index}>• {rec}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Field Usage Scan */}
            {fieldUsage && (
                <div className="mb-6 p-4 bg-purple-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Legacy Field Usage Scan
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <h4 className="font-medium text-purple-800 mb-2">profileSlug Usage</h4>
                            <ul className="text-sm text-purple-700 space-y-1">
                                {fieldUsage.profileSlugUsage.map((usage: string, index: number) => (
                                    <li key={index} className="text-xs">• {usage}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-purple-800 mb-2">fullNameLower Usage</h4>
                            <ul className="text-sm text-purple-700 space-y-1">
                                {fieldUsage.fullNameLowerUsage.map((usage: string, index: number) => (
                                    <li key={index} className="text-xs">• {usage}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-purple-800 mb-2">slugify Usage</h4>
                            <ul className="text-sm text-purple-700 space-y-1">
                                {fieldUsage.slugifyUsage.map((usage: string, index: number) => (
                                    <li key={index} className="text-xs">• {usage}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Migration Checklist */}
            {checklist && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Migration Completion Checklist
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <h4 className="font-medium text-green-800 mb-2">✅ Completed</h4>
                            <ul className="text-sm text-green-700 space-y-1">
                                {checklist.completed.map((item: string, index: number) => (
                                    <li key={index} className="text-xs">{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-yellow-800 mb-2">⏳ Pending</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {checklist.pending.map((item: string, index: number) => (
                                    <li key={index} className="text-xs">{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-blue-800 mb-2">🔧 Optional</h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                                {checklist.optional.map((item: string, index: number) => (
                                    <li key={index} className="text-xs">{item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Cleanup Report */}
            {cleanupReport && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Cleanup Report
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <h4 className="font-medium text-gray-800 mb-2">Functions Processed</h4>
                            <ul className="text-sm text-gray-700 space-y-1">
                                {cleanupReport.functionsRemoved.map((func, index) => (
                                    <li key={index} className="text-xs">• {func}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-800 mb-2">References Updated</h4>
                            <ul className="text-sm text-gray-700 space-y-1">
                                {cleanupReport.referencesUpdated.map((ref, index) => (
                                    <li key={index} className="text-xs">• {ref}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="mb-4">
                        <h4 className="font-medium text-gray-800 mb-2">Files Modified</h4>
                        <div className="flex flex-wrap gap-2">
                            {cleanupReport.filesModified.map((file, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    {file}
                                </span>
                            ))}
                        </div>
                    </div>

                    {cleanupReport.warnings.length > 0 && (
                        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                            <h4 className="font-medium text-yellow-800 mb-2">⚠️ Warnings</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {cleanupReport.warnings.map((warning, index) => (
                                    <li key={index}>• {warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {cleanupReport.errors.length > 0 && (
                        <div className="p-3 bg-red-100 border border-red-300 rounded-md">
                            <h4 className="font-medium text-red-800 mb-2">❌ Errors</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                                {cleanupReport.errors.map((error, index) => (
                                    <li key={index}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="mb-6 flex flex-wrap gap-3">
                <button
                    onClick={checkReadiness}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <Shield className="h-4 w-4" />
                    Check Readiness
                </button>

                <button
                    onClick={scanFieldUsage}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <Search className="h-4 w-4" />
                    Scan Field Usage
                </button>

                <button
                    onClick={generateChecklist}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <FileText className="h-4 w-4" />
                    Generate Checklist
                </button>

                <button
                    onClick={() => runCleanup(false)}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <Code className="h-4 w-4" />
                    Mark as Deprecated
                </button>

                <button
                    onClick={() => runCleanup(true)}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                    <Trash2 className="h-4 w-4" />
                    Remove Legacy Code
                </button>
            </div>

            {/* Logs */}
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <h3 className="text-white font-semibold mb-2">Cleanup Logs</h3>
                <div className="h-64 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="text-gray-500">No logs yet. Run cleanup operations to see progress...</div>
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
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                        <strong>Important:</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                            <li>Only run legacy cleanup after username migration is complete and validated</li>
                            <li>Test all profile-related functionality before removing deprecated code</li>
                            <li>Keep backups of your codebase before making irreversible changes</li>
                            <li>Consider keeping deprecated functions for a transition period</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}