'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-yellow-50 to-amber-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You're Offline
          </h1>

          <p className="text-gray-600 mb-6">
            It looks like you're not connected to the internet. Please check your connection and try again.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-lime-500 hover:bg-lime-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>

            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Some features may still be available offline thanks to cached content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}