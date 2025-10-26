'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Zap } from 'lucide-react'

interface PerformanceToastProps {
  message: string
  type?: 'success' | 'info'
  duration?: number
}

export const PerformanceToast: React.FC<PerformanceToastProps> = ({
  message,
  type = 'success',
  duration = 2000
}) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${
        type === 'success' 
          ? 'border-green-200 bg-green-50 text-green-800' 
          : 'border-blue-200 bg-blue-50 text-blue-800'
      }`}>
        {type === 'success' ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}

// Hook for showing performance toasts
export const usePerformanceToast = () => {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'info' }>>([])

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 2000)
  }

  return {
    toasts,
    showToast
  }
}