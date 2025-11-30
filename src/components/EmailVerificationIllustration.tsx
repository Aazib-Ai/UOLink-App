'use client'

import { motion } from 'framer-motion'

export default function EmailVerificationIllustration() {
    return (
        <div className="flex justify-center items-center py-8">
            <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-48 h-48 md:w-64 md:h-64"
            >
                {/* Background Circle */}
                <circle cx="100" cy="100" r="90" fill="#F0FDF4" />

                {/* Envelope */}
                <motion.g
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <rect x="40" y="60" width="120" height="80" rx="8" fill="#FFFFFF" stroke="#166534" strokeWidth="4" />
                    <path d="M40 60L100 100L160 60" stroke="#166534" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </motion.g>

                {/* Paper/Letter sliding out */}
                <motion.g
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: -20, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                >
                    <rect x="50" y="50" width="100" height="60" rx="4" fill="#DCFCE7" />
                    <line x1="60" y1="65" x2="140" y2="65" stroke="#166534" strokeWidth="2" strokeLinecap="round" />
                    <line x1="60" y1="80" x2="120" y2="80" stroke="#166534" strokeWidth="2" strokeLinecap="round" />
                </motion.g>

                {/* Checkmark */}
                <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1, type: "spring", stiffness: 200 }}
                >
                    <circle cx="140" cy="140" r="24" fill="#166534" />
                    <path d="M128 140L136 148L152 132" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </motion.g>

                {/* Floating Elements (Spam folder hint) */}
                <motion.g
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                    <rect x="150" y="40" width="30" height="30" rx="4" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
                    <text x="165" y="60" textAnchor="middle" fill="#D97706" fontSize="16" fontWeight="bold">!</text>
                </motion.g>
            </svg>
        </div>
    )
}
