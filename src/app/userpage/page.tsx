'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { User, Edit3, Upload, BookOpen, Settings, Zap } from 'lucide-react'
import UploadModalLazy from '@/components/UploadModalLazy'

export default function UserPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-yellow-50 pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-amber-100">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#90c639] to-[#7ab332] rounded-full mb-4 shadow-lg">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-3">Your Profile</h1>
                <p className="text-gray-600">Manage your UOLink profile and track your academic journey</p>
              </div>

              {/* Quick Actions */}
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <Link href="/profile-edit" className="group">
                  <div className="bg-gradient-to-br from-[#90c639] to-[#7ab332] p-6 rounded-xl text-white hover:shadow-lg transition-all duration-200 group-hover:scale-105">
                    <div className="flex items-center justify-between mb-3">
                      <Edit3 className="w-8 h-8" />
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Action</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Edit Profile</h3>
                    <p className="text-sm opacity-90">Update your information, skills, and social links</p>
                  </div>
                </Link>

                <Link href="/aura" className="group">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-white hover:shadow-lg transition-all duration-200 group-hover:scale-105">
                    <div className="flex items-center justify-between mb-3">
                      <Zap className="w-8 h-8" />
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Stats</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Aura Dashboard</h3>
                    <p className="text-sm opacity-90">Track your reputation and community impact</p>
                  </div>
                </Link>

                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="group w-full"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-white hover:shadow-lg transition-all duration-200 group-hover:scale-105">
                    <div className="flex items-center justify-between mb-3">
                      <Upload className="w-8 h-8" />
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Upload</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Upload Materials</h3>
                    <p className="text-sm opacity-90">Share your notes and help other students</p>
                  </div>
                </button>
              </div>

              <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 mb-8">
                <h3 className="text-xl font-semibold mb-3 text-amber-800 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Profile Features
                </h3>
                <p className="text-amber-700 mb-4">
                  Your UOLink profile helps you connect with other students and track your academic contributions.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-semibold text-amber-800 mb-2">✅ Available Now</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• Profile picture & basic info</li>
                      <li>• Professional bio/tagline</li>
                      <li>• Skills & interests</li>
                      <li>• GitHub & LinkedIn links</li>
                    </ul>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-semibold text-amber-800 mb-2">🚧 Coming Soon</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• Contribution tracking</li>
                      <li>• Saved materials library</li>
                      <li>• Activity history</li>
                      <li>• Achievement badges</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Future Features Preview */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">Your Contributions</h3>
                  <ul className="text-gray-600 space-y-2 text-sm">
                    <li>• Track uploaded materials</li>
                    <li>• View download statistics</li>
                    <li>• Manage your content library</li>
                    <li>• Update material information</li>
                  </ul>
                </div>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                  <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">Saved Materials</h3>
                  <ul className="text-gray-600 space-y-2 text-sm">
                    <li>• Bookmark favorite materials</li>
                    <li>• Create study collections</li>
                    <li>• Quick access to important notes</li>
                    <li>• Personalized recommendations</li>
                  </ul>
                </div>

                <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                  <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center mb-4">
                    <Settings className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">Activity Tracking</h3>
                  <ul className="text-gray-600 space-y-2 text-sm">
                    <li>• Download history</li>
                    <li>• Contribution milestones</li>
                    <li>• Learning progress</li>
                    <li>• Community achievements</li>
                  </ul>
                </div>
              </div>

              {/* Call to Action */}
              <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-xl border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Ready to Get Started?</h3>
                <p className="text-gray-600 mb-6">
                  Complete your profile and start contributing to the UOLink community.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/profile-edit" className="bg-[#90c639] text-white px-8 py-3 rounded-lg hover:bg-[#7ba032] transition-all duration-200 font-semibold shadow-lg hover:shadow-xl">
                    Complete My Profile
                  </Link>
                  <Link href="/" className="bg-gray-800 text-white px-8 py-3 rounded-lg hover:bg-gray-900 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl">
                    Browse Materials
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </>
  )
}