'use client'

import { useRef, useEffect } from 'react'
import { X, Github, Linkedin, Instagram, Facebook } from 'lucide-react'

interface SocialLinks {
  githubUrl: string
  linkedinUrl: string
  instagramUrl: string
  facebookUrl: string
}

interface SocialLinksEditorProps {
  socialLinks: SocialLinks
  onSocialLinkChange: (platform: keyof SocialLinks, value: string) => void
}

export default function SocialLinksEditor({ socialLinks, onSocialLinkChange }: SocialLinksEditorProps) {
  const githubInputRef = useRef<HTMLInputElement>(null)
  const linkedinInputRef = useRef<HTMLInputElement>(null)
  const instagramInputRef = useRef<HTMLInputElement>(null)
  const facebookInputRef = useRef<HTMLInputElement>(null)

  // Focus newly added social input fields
  useEffect(() => {
    if (socialLinks.githubUrl === '') {
      githubInputRef.current?.focus()
    } else if (socialLinks.linkedinUrl === '') {
      linkedinInputRef.current?.focus()
    } else if (socialLinks.instagramUrl === '') {
      instagramInputRef.current?.focus()
    } else if (socialLinks.facebookUrl === '') {
      facebookInputRef.current?.focus()
    }
  }, [socialLinks.githubUrl, socialLinks.linkedinUrl, socialLinks.instagramUrl, socialLinks.facebookUrl])

  const addSocialLink = (platform: keyof SocialLinks, baseUrl: string, inputRef: React.RefObject<HTMLInputElement>) => {
    onSocialLinkChange(platform, baseUrl)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">Social footprint</p>
          <h2 className="text-lg font-semibold text-gray-900">Links</h2>
        </div>
        <span className="text-xs text-gray-500">Add your social profiles</span>
      </div>

      <div className="mt-6 space-y-3">
        {/* Active social links */}
        {socialLinks.githubUrl && (
          <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#90c639] text-white">
              <Github className="h-5 w-5" />
            </div>
            <input
              ref={githubInputRef}
              type="url"
              value={socialLinks.githubUrl}
              onChange={(e) => onSocialLinkChange('githubUrl', e.target.value)}
              className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
              placeholder="username"
            />
            <button
              type="button"
              onClick={() => onSocialLinkChange('githubUrl', '')}
              className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
              aria-label="Remove GitHub"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {socialLinks.linkedinUrl && (
          <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Linkedin className="h-5 w-5" />
            </div>
            <input
              ref={linkedinInputRef}
              type="url"
              value={socialLinks.linkedinUrl}
              onChange={(e) => onSocialLinkChange('linkedinUrl', e.target.value)}
              className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
              placeholder="username or custom URL"
            />
            <button
              type="button"
              onClick={() => onSocialLinkChange('linkedinUrl', '')}
              className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
              aria-label="Remove LinkedIn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {socialLinks.instagramUrl && (
          <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white">
              <Instagram className="h-5 w-5" />
            </div>
            <input
              ref={instagramInputRef}
              type="url"
              value={socialLinks.instagramUrl}
              onChange={(e) => onSocialLinkChange('instagramUrl', e.target.value)}
              className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
              placeholder="@username or custom URL"
            />
            <button
              type="button"
              onClick={() => onSocialLinkChange('instagramUrl', '')}
              className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
              aria-label="Remove Instagram"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {socialLinks.facebookUrl && (
          <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Facebook className="h-5 w-5" />
            </div>
            <input
              ref={facebookInputRef}
              type="url"
              value={socialLinks.facebookUrl}
              onChange={(e) => onSocialLinkChange('facebookUrl', e.target.value)}
              className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
              placeholder="username or custom URL"
            />
            <button
              type="button"
              onClick={() => onSocialLinkChange('facebookUrl', '')}
              className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
              aria-label="Remove Facebook"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Available social platforms to add */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Add more links</p>
          <div className="flex flex-wrap gap-2">
            {!socialLinks.githubUrl && (
              <button
                type="button"
                onClick={() => addSocialLink('githubUrl', 'https://github.com/', githubInputRef)}
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
              >
                <Github className="h-4 w-4" />
                Add GitHub
              </button>
            )}
            {!socialLinks.linkedinUrl && (
              <button
                type="button"
                onClick={() => addSocialLink('linkedinUrl', 'https://linkedin.com/in/', linkedinInputRef)}
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
              >
                <Linkedin className="h-4 w-4" />
                Add LinkedIn
              </button>
            )}
            {!socialLinks.instagramUrl && (
              <button
                type="button"
                onClick={() => addSocialLink('instagramUrl', 'https://instagram.com/', instagramInputRef)}
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
              >
                <Instagram className="h-4 w-4" />
                Add Instagram
              </button>
            )}
            {!socialLinks.facebookUrl && (
              <button
                type="button"
                onClick={() => addSocialLink('facebookUrl', 'https://facebook.com/', facebookInputRef)}
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
              >
                <Facebook className="h-4 w-4" />
                Add Facebook
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}