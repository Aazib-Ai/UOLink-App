'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { CameraOff, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ScannerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ScannerErrorBoundary] Error caught:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <AlertTriangle className="h-8 w-8" />
            <h2 className="text-xl font-semibold">Scanner Error</h2>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mb-6">
            <p className="text-sm text-red-700 mb-2">
              Something went wrong with the scanner. This could be due to:
            </p>
            <ul className="text-sm text-red-600 text-left list-disc list-inside space-y-1">
              <li>Camera permission denied</li>
              <li>Unsupported device or browser</li>
              <li>Camera already in use by another application</li>
              <li>Internal processing error</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            >
              Reload Page
            </button>

            <details className="text-left text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">Technical Details</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                {this.state.error?.message}
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Simplified error boundary for development
export function ScannerErrorFallback({ error, resetError }: {
  error: Error;
  resetError: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <CameraOff className="h-12 w-12 text-gray-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-700 mb-2">Scanner Error</h2>
      <p className="text-sm text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={resetError}
        className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7ab332]"
      >
        Try Again
      </button>
    </div>
  )
}