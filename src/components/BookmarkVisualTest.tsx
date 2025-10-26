'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'

export const BookmarkVisualTest = () => {
  const [isSaved, setIsSaved] = useState(false)

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Bookmark Visual Test</h3>
      
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsSaved(!isSaved)}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          {isSaved ? (
            // Saved state: Filled green bookmark
            <Bookmark
              size={20}
              className="fill-[#90c639] text-[#90c639] transition-all duration-300 drop-shadow-sm"
            />
          ) : (
            // Unsaved state: Black outline bookmark
            <Bookmark
              size={20}
              className="text-black transition-all duration-300 hover:fill-[#90c639] hover:text-[#90c639]"
              style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }}
            />
          )}
          <span className="text-sm font-medium">
            {isSaved ? 'Saved' : 'Not Saved'}
          </span>
        </button>
        
        <div className="text-sm text-gray-600">
          Current state: <span className="font-mono">{isSaved ? 'true' : 'false'}</span>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p><strong>Expected behavior:</strong></p>
        <p>• Unsaved: Black outline bookmark</p>
        <p>• Saved: Green filled bookmark</p>
        <p>• Click to toggle between states</p>
      </div>
    </div>
  )
}