'use client'

import Link from 'next/link'
import { BookOpen, Handshake, LogOut, UserIcon, User, HandHeart, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import UploadModal from '@/components/UploadModal'
import { ScannerModal } from '@/components/scanner/ScannerModal'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

function Navbar() {
  const { user, signOut } = useAuth()
  const [profilePicture, setProfilePicture] = useState<string | null>(null)

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

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
    <nav className="shadow-md fixed border border-amber-200 mt-2 flex items-center z-50 bg-yellow-50 rounded-full w-full max-w-7xl px-3 md:px-5">
      <div className="container mx-auto flex justify-between py-2 md:py-3 px-1 items-center">
        <Link href="/" className="flex items-center h-8 md:h-10">
          <img src="/uolink-logo.png" alt="UOLINK" className="h-20 w-auto md:h-32 md:w-auto mr-1 md:mr-2 mt-1 md:mt-2" />
        </Link>
        <div>
          {user ? (
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
                          <Link href="/hall-of-fame" onClick={toggleMenu} className='flex px-3 md:px-4 justify-start items-center'>
                            <Trophy size={20} className='mr-2 w-4 h-4 md:w-5 md:h-5 text-purple-600' />
                            <h1 className='text-sm md:text-base py-2'>Hall of Fame</h1>
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
            <div className='flex justify-end items-center gap-1.5 md:gap-3'>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="text-black bg-[#90c639] hover:text-white delay-200 transition-all contributeButton font-semibold text-xs text-center md:text-sm py-1.5 px-2 md:py-2 md:px-4 rounded-full border-[1px] border-black whitespace-nowrap"
              >
                Upload notes
              </button>

              <Link href="/auth?mode=register" className="text-white bg-[#90c639] hover:bg-[#7ab332] transition-all font-semibold text-xs text-center md:text-sm py-1.5 px-2 md:py-2 md:px-4 rounded-full border-[1px] border-[#7ab332] whitespace-nowrap">
                Register
              </Link>

              <Link
                href="/hall-of-fame"
                className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold text-purple-600 hover:bg-purple-100 transition-colors whitespace-nowrap"
              >
                <Trophy className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Hall of Fame
              </Link>

              <Link href="/about">
                <div className='h-8 w-12 md:h-[40px] md:w-fit hover:brightness-90 transition-all rounded-full bg-gradient-to-r from-[#90c639] to-blue-500 flex items-center justify-center text-white font-bold text-xs touch-manipulation'>
                  About
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onScanRequest={handleScanRequest}
        scannedFile={scannedFile}
      />

      {/* Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={handleScannerClose}
        onComplete={handleScannerComplete}
      />
    </nav>
  )
}

export default Navbar
