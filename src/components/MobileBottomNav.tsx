'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Calendar, PlusSquare, FolderHeart, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import UploadModalLazy from '@/components/UploadModalLazy'
import { ScannerModalLazy } from '@/components/scanner/ScannerModalLazy'

interface NavItem {
    icon: typeof Home
    activeIcon?: typeof Home
    label: string
    href: string
    isUpload?: boolean
}

const navItems: NavItem[] = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Calendar, label: 'Timetable', href: '/timetable' },
    { icon: PlusSquare, label: 'Upload', href: '', isUpload: true },
    { icon: FolderHeart, label: 'My Notes', href: '/contributions' },
    { icon: User, label: 'Profile', href: '/profile-edit' },
]

export default function MobileBottomNav() {
    const pathname = usePathname()
    const router = useRouter()
    const { user } = useAuth()
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedFile, setScannedFile] = useState<File | null>(null)

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    const handleNavClick = (item: NavItem) => {
        if (item.isUpload) {
            if (user) {
                setIsUploadModalOpen(true)
            } else {
                router.push('/auth')
            }
        } else {
            router.push(item.href)
        }
    }

    const handleScanRequest = () => {
        setIsScannerOpen(true)
    }

    const handleScannerComplete = (file: File) => {
        setScannedFile(file)
        setIsScannerOpen(false)
        setIsUploadModalOpen(true)
    }

    const handleScannerClose = () => {
        setIsScannerOpen(false)
        setScannedFile(null)
    }

    return (
        <>
            {/* Bottom Navigation - Only visible on mobile */}
            <nav className="mobile-bottom-nav md:hidden">
                <div className="flex items-center justify-around h-full max-w-lg mx-auto">
                    {navItems.map((item) => {
                        const active = !item.isUpload && isActive(item.href)
                        const Icon = item.icon

                        return (
                            <motion.button
                                key={item.label}
                                onClick={() => handleNavClick(item)}
                                className={`nav-item flex flex-col items-center justify-center gap-0.5 ${item.isUpload ? 'nav-item-upload' : ''
                                    } ${active ? 'nav-item-active' : ''}`}
                                whileTap={{ scale: 0.9 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon
                                    size={item.isUpload ? 28 : 24}
                                    strokeWidth={active ? 2.5 : 1.5}
                                    className={`transition-all duration-200 ${item.isUpload
                                            ? 'text-white'
                                            : active
                                                ? 'text-[#90c639]'
                                                : 'text-gray-500'
                                        }`}
                                    fill={active && !item.isUpload ? 'currentColor' : 'none'}
                                />
                                {!item.isUpload && (
                                    <span
                                        className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-[#90c639]' : 'text-gray-500'
                                            }`}
                                    >
                                        {item.label}
                                    </span>
                                )}
                            </motion.button>
                        )
                    })}
                </div>
            </nav>

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
