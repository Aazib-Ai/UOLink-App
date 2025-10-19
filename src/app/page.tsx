'use client'

import { useAuth } from '@/contexts/AuthContext'
import Dashboard from '@/components/Dashboard'
import Navbar from '@/components/Navbar'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-yellow-50 to-amber-50 flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <Dashboard />
    </>
  )
}
