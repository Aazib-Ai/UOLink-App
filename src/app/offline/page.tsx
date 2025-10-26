'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-yellow-50 to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <WifiOff className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You're Offline
          </h1>
          <p className="text-gray-600">
            It looks like you've lost your internet connection. Don't worry, you can still browse cached content.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[#90c639] hover:bg-[#7fb32f] text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full bg-amber-200 hover:bg-amber-300 text-gray-900 px-6 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Go Home</span>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-[#90c639] mb-2">
            What you can do offline:
          </h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Browse previously viewed notes</li>
            <li>• View your profile</li>
            <li>• Access cached content</li>
            <li>• Prepare uploads (they'll sync when online)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}