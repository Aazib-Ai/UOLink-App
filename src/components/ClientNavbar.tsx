'use client'

import { UserIcon, User, LogOut, HandHeart, Trophy, BookOpen, Settings } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSplash } from '@/contexts/SplashContext'
import UploadModalLazy from '@/components/UploadModalLazy'
import { ScannerModalLazy } from '@/components/scanner/ScannerModalLazy'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { StaticNavLinks } from './ServerNavbar'
import Link from 'next/link'

// Client component for interactive navbar parts only
export default function ClientNavbar() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { isSplashComplete } = useSplash()
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch user profile picture from Firestore
  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (user?.uid) {
        try {
          const profileRef = doc(db, 'profiles', user.uid)
          const profileSnap = await getDoc(profileRef)

          if (profileSnap.exists()) {
            const profileData = profileSnap.data()
            if (profileData.profilePicture) {
              setProfilePicture(profileData.profilePicture)
            }
          }
        } catch (error) {
          console.error('Error fetching profile picture:', error)
        }
      }
    }

    fetchProfilePicture()
  }, [user?.uid])

  const handleSignOut = async () => {
    const userConfirmed = window.confirm("Are you sure you want to sign out?")

    if (userConfirmed) {
      try {
        await signOut()
      } catch (error) {
        console.error("Error signing out:", error)
      }
    } else {
      console.log("Sign out canceled by the user.")
    }
  }

  // Toggle menu visibility
  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  // Close the menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleScanRequest = () => {
    setIsScannerOpen(true)
  }

  const handleScannerComplete = (file: File) => {
    setScannedFile(file)
    setIsScannerOpen(false)
    // Reopen the upload modal with the scanned file
    setIsUploadModalOpen(true)
  }

  const handleScannerClose = () => {
    setIsScannerOpen(false)
    // Clear the scanned file when scanner is closed without completing
    setScannedFile(null)
  }

  return (
    <>
      <div>
        {!isSplashComplete ? (
          // Don't show anything while splash screen is active
          null
        ) : authLoading ? (
          // Show loading state while authentication is being determined
          <div className="flex justify-end items-center gap-1.5 md:gap-3">
            <div className="w-16 h-8 md:w-20 md:h-10 bg-gray-200 animate-pulse rounded-full"></div>
            <div className="w-12 h-8 md:w-16 md:h-10 bg-gray-200 animate-pulse rounded-full"></div>
          </div>
        ) : user ? (
          <div className='flex justify-center items-center'>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="text-black text-xs md:text-base uploadButton md:py-2 md:px-5 py-1.5 px-3 mr-2 md:mr-4 border-black border-[1px] rounded-full font-semibold hover:rounded-xl transition-all duration-300 whitespace-nowrap"
            >
              Upload
            </button>
            <div className='relative' ref={menuRef}>
              <button
                onClick={toggleMenu}
                className='text-black rounded-full size-6 md:size-10 md:hover:opacity-90 transition-all font-semibold touch-manipulation'
              >
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-6 h-6 md:w-9 md:h-9 rounded-full object-cover" />
                ) : (
                  <User className="w-6 h-6 md:w-9 md:h-9 rounded-full p-0.5 md:p-1 bg-gray-300 text-gray-500" />
                )}
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    className="absolute right-0 mt-2 w-44 md:w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-10"
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ul className="pb-2 px-1 bg-amber-50 rounded-xl">
                      <li className="py-2 border-b border-gray-400 rounded-sm hover:bg-amber-100 transition-all font-semibold cursor-pointer">
                        <Link href="/profile-edit" onClick={toggleMenu} className='flex px-3 md:px-4 justify-start items-center' >
                          <UserIcon size={20} className='mr-2 w-4 h-4 md:w-5 md:h-5' />
                          <h1 className='text-sm md:text-base py-2'>Your Profile</h1>
                        </Link>
                      </li>

                      <li className='mt-2 py-0 rounded-2xl hover:bg-amber-100 transition-all font-semibold cursor-pointer'>
                        <Link href="/donate" onClick={toggleMenu} className='flex px-3 md:px-4 justify-start items-center'>
                          <HandHeart size={20} className='mr-2 w-4 h-4 md:w-5 md:h-5' />
                          <h1 className='text-sm md:text-base py-2'>Donate us</h1>
                        </Link>
                      </li>

                      <li className='mt-2 py-0 rounded-2xl hover:bg-amber-100 transition-all font-semibold cursor-pointer'>
                        <Link href="/leaderboard" onClick={toggleMenu} className='flex px-3 md:px-4 justify-start items-center'>
                          <Trophy size={20} className='mr-2 w-4 h-4 md:w-5 md:h-5 text-[#90c639]' />
                          <h1 className='text-sm md:text-base py-2'>Leaderboard</h1>
                        </Link>
                      </li>

                      <li className='mt-2 py-0 rounded-2xl hover:bg-amber-100 transition-all font-semibold cursor-pointer'>
                        <Link href="/settings" onClick={toggleMenu} className='flex px-3 md:px-4 justify-start items-center'>
                          <Settings size={20} className='mr-2 w-4 h-4 md:w-5 md:h-5' />
                          <h1 className='text-sm md:text-base py-2'>Settings</h1>
                        </Link>
                      </li>

                      <li className='mt-2 py-0 rounded-2xl hover:bg-amber-100 transition-all font-semibold cursor-pointer'>
                        <Link href="/about" onClick={toggleMenu} className='flex px-3 md:px-4 justify-start items-center'>
                          <BookOpen size={20} className='mr-2 w-4 h-4 md:w-5 md:h-5' />
                          <h1 className='text-sm md:text-base py-2'>About us</h1>
                        </Link>
                      </li>
                      
                      <li className="px-3 md:px-4 pt-3 py-2 text-red-500 flex justify-start items-center rounded-2xl hover:bg-amber-100 transition-all font-semibold cursor-pointer" onClick={handleSignOut}>
                        <LogOut size={16} className="mr-2 w-3.5 h-3.5 md:w-4 md:h-4" />
                        <p className="text-sm md:text-base">Log out</p>
                      </li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <StaticNavLinks />
        )}
      </div>

      {/* Upload Modal */}
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onScanRequest={handleScanRequest}
        scannedFile={scannedFile}
      />

      {/* Scanner Modal */}
      <ScannerModalLazy
        isOpen={isScannerOpen}
        onClose={handleScannerClose}
        onComplete={handleScannerComplete}
      />
    </>
  )
}