'use client'

import { useState } from 'react'

const materialTypes = [
  { value: 'assignment', label: 'Assignment', icon: '📝', color: 'bg-blue-500' },
  { value: 'quiz', label: 'Quiz', icon: '📋', color: 'bg-green-500' },
  { value: 'lecture', label: 'Lecture', icon: '🎓', color: 'bg-purple-500' },
  { value: 'slides', label: 'Slides', icon: '📊', color: 'bg-orange-500' },
  { value: 'midterm-notes', label: 'Midterm Notes', icon: '📕', color: 'bg-red-500' },
  { value: 'final-term-notes', label: 'Final Notes', icon: '📗', color: 'bg-emerald-500' },
  { value: 'books', label: 'Books', icon: '📚', color: 'bg-indigo-500' },
]

interface MaterialTypeSelectorProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

const MaterialTypeSelector: React.FC<MaterialTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        Type *
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {materialTypes.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(option.value)}
            className={`group relative p-4 rounded-xl border-2 bg-white transition-all duration-200 ${
              disabled
                ? 'opacity-50 cursor-not-allowed border-gray-200'
                : 'border-gray-200 hover:border-[#90c639] hover:shadow-lg hover:scale-105 cursor-pointer'
            } ${value === option.value ? 'border-[#90c639] bg-gradient-to-br from-amber-50 to-green-50 shadow-md' : ''}`}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${option.color} shadow-sm`}
              >
                {option.icon}
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-[#1a3a1a] text-center">
                {option.label}
              </span>
            </div>

            {/* Selected indicator */}
            {value === option.value && (
              <div className="absolute top-2 right-2">
                <div className="w-6 h-6 bg-[#90c639] rounded-full flex items-center justify-center shadow-md">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MaterialTypeSelector