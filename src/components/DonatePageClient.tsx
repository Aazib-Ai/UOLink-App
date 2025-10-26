'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Database, Heart, Shield, Sparkles, Upload, Wallet, Wifi } from 'lucide-react'
import UploadModalLazy from '@/components/UploadModalLazy'
import { useAuth } from '@/contexts/AuthContext'

interface DonatePageClientProps {
  qrImage: string
}

const impactHighlights = [
  {
    title: 'Lightning-fast downloads',
    description: 'PKR 300 keeps note downloads quick for finals week.',
    Icon: Wifi,
  },
  {
    title: 'Secure storage & backups',
    description: 'PKR 200 covers the storage bill for hundreds of new uploads.',
    Icon: Database,
  },
  {
    title: 'Aura & search refresh',
    description: 'PKR 150 powers the daily calculations that keep UOLink smart.',
    Icon: Sparkles,
  },
]

const supportCards = [
  {
    title: 'Send a quick transfer',
    description: 'JazzCash, Easypaisa, or any banking app in Pakistan works with the QR below.',
    Icon: Wallet,
  },
  {
    title: 'Upload notes that helped you',
    description: 'Got clean notes? Drop them here and help the next batch score higher.',
    Icon: Upload,
    actionLabel: 'Upload right now',
  },
]

export default function DonatePageClient({ qrImage }: DonatePageClientProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const handleUploadClick = () => {
    if (user) {
      setIsUploadModalOpen(true)
    } else {
      router.push('/auth?mode=login')
    }
  }

  return (
    <>
      <main className="min-h-screen w-full bg-[#f6f9ee]">
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6">
          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-amber-200 bg-white/90 p-6 text-center shadow-lg shadow-amber-100 backdrop-blur sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#90c639]">Support UOLink</p>
              <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-4xl">Help Keep UOLink Free for Every UOL Student</h1>
              <p className="mt-4 text-sm text-gray-600 sm:text-base">
                Built by a UOL student, powered by the community. Your support keeps notes, search, and Aura free for every classmate in
                Pakistan.
              </p>
              <p className="mt-2 text-sm font-semibold text-[#5a7c27] sm:text-base">No paywalls. No ads. Just students helping students.</p>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-white/85 p-6 shadow-md shadow-amber-100 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Where Your Rupee Goes</h2>
                <span className="inline-flex items-center justify-center rounded-full bg-[#90c639]/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#5a7c27]">
                  Transparent AF
                </span>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {impactHighlights.map(({ title, description, Icon }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-amber-100 bg-white/95 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#90c639]/15 text-[#5a7c27]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
                    <p className="mt-2 text-sm text-gray-600">{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-white/85 p-6 shadow-md shadow-amber-100 sm:p-8">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">How You Can Support</h2>
              <p className="mt-4 text-sm text-gray-600 sm:text-base">
                If UOLink saved you before an exam or helped you share your best work, chip in so the next batch can do the same.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {supportCards.map(({ title, description, Icon, actionLabel }) => (
                  <div
                    key={title}
                    className="flex h-full flex-col justify-between rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-white/80 p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#90c639]/15 text-[#5a7c27]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{description}</p>
                      </div>
                    </div>
                    {actionLabel ? (
                      <button
                        onClick={handleUploadClick}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#5a7c27] hover:text-[#3e5518]"
                      >
                        <Upload className="h-4 w-4" />
                        {actionLabel}
                      </button>
                    ) : (
                      <Link
                        href="#scan-to-support"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#5a7c27] hover:text-[#3e5518]"
                      >
                        View QR
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-sm text-gray-600">
                Prefer a manual transfer? Email{' '}
                <a href="mailto:support@uollink.com" className="font-semibold text-[#5a7c27] hover:underline">
                  support@uollink.com
                </a>{' '}
                and we will send bank details instantly.
              </p>
            </section>

            <section className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-md sm:p-8">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-900 sm:text-xl">100% Transparent. No cap.</h3>
                    <p className="mt-1 text-sm text-emerald-800 sm:text-base">Student-run. Open-source. Every rupee goes straight back into hosting.</p>
                  </div>
                </div>
                <Link
                  href="https://github.com/Aazib-Ai/UOLink-App"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-emerald-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100/60"
                >
                  Build With Us
                </Link>
              </div>
            </section>

            <section
              id="scan-to-support"
              className="rounded-3xl border border-amber-200 bg-white/90 p-6 text-center shadow-md shadow-amber-100 sm:p-8"
            >
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Scan & Support in Seconds</h2>
              <p className="mt-3 text-sm text-gray-600 sm:text-base">Works with JazzCash, Easypaisa, Meezan, HBL, UBL, and all major Pakistani banking apps.</p>
              <div className="mx-auto mt-6 w-fit overflow-hidden rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <img src={qrImage} alt="Support UOLink QR code" loading="lazy" className="h-52 w-52 object-contain sm:h-56 sm:w-56" />
              </div>
              <p className="mt-4 text-xs text-gray-500">Need a receipt or want to sponsor a feature? Email support@uollink.com.</p>
            </section>

            <section className="rounded-3xl border border-[#1e2f19] bg-gradient-to-br from-[#1e2f19] via-[#16341f] to-[#0f1f12] p-6 text-center text-white shadow-2xl shadow-emerald-900/30 sm:p-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Heart className="h-6 w-6 text-[#90c639]" />
              </div>
              <h3 className="text-xl font-semibold sm:text-2xl">Shukria for backing the community.</h3>
              <p className="mt-3 text-sm text-emerald-100 sm:text-base">Because of you, every UOL student gets the same access to quality notes.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1f2f10] transition hover:bg-emerald-50"
                >
                  Back to Dashboard
                </Link>
                <button
                  onClick={handleUploadClick}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#90c639] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#7ab332]"
                >
                  <Upload className="h-4 w-4" />
                  Share Notes Instead
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      <UploadModalLazy isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
    </>
  )
}
