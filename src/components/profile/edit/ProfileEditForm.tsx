'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle, Save, User, Sparkles } from 'lucide-react'
import { useProfileEditForm } from '@/hooks/useProfileEditForm'
import CustomSelect from '../../CustomSelect'
import ContributionHub from '../../ContributionHub'
import ProfileImageField from './ProfileImageField'
import ProgressMeter from './ProgressMeter'
import SuccessBanner from './SuccessBanner'
import SkillsManager from './SkillsManager'
import SocialLinksEditor from './SocialLinksEditor'
import AuraDashboard from './AuraDashboard'
import UploadModalLazy from '../../UploadModalLazy'
import { slugify } from '@/lib/utils'
import { MAJOR_NAMES } from '@/constants/universityData'
import { useState, useRef, useEffect } from 'react'

const SEMESTER_OPTIONS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8'
]

export default function ProfileEditForm() {
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const {
    profileData,
    previewImage,
    isSubmitting,
    error,
    success,
    isLoading,
    isUploadingImage,
    isDeletingImage,
    completionScore,
    isProfileComplete,
    hasChanges,
    fileInputRef,
    handleImageUpload,
    handleRemoveImage,
    handleSubmit,
    updateProfileData,
    addSkill,
    removeSkill,
  } = useProfileEditForm()

  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSaveShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'
      if (isSaveShortcut) {
        e.preventDefault()
        if (!isSubmitting && hasChanges) {
          formRef.current?.requestSubmit()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, hasChanges])

  const handleUploadClick = () => {
    setIsUploadModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9ee]">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-lime-200/70 bg-white/80 px-6 py-8 text-sm font-semibold text-[#426014] shadow-lg backdrop-blur">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#90c639] border-t-transparent" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-lime-200/70 bg-white/90 shadow-xl backdrop-blur">
        <div className="absolute -left-24 top-[-96px] h-56 w-56 rounded-full bg-[#e3f2c7] blur-3xl" />
        <div className="absolute -bottom-28 right-[-72px] h-72 w-72 rounded-full bg-[#d1f0a8] blur-3xl" />
        <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12">
          <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center">
              <ProfileImageField
                previewImage={previewImage}
                isUploadingImage={isUploadingImage}
                isDeletingImage={isDeletingImage}
                fileInputRef={fileInputRef}
                onImageUpload={handleImageUpload}
                onImageRemove={handleRemoveImage}
              />
              <div className="text-center sm:text-left">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-[#5f7f2a]/80">
                  Profile workspace
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-gray-900 sm:text-[2.6rem]">
                  Craft a clean, confident first impression
                </h1>
                <p className="mt-4 max-w-xl text-sm text-gray-600 sm:text-base">
                  Curate how classmates discover you with a minimalist edit experience that feels calm and deliberate.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
              {!isProfileComplete && (
                <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs font-semibold text-[#426014] shadow-sm">
                  <CheckCircle className="h-4 w-4 text-[#90c639]" />
                  {completionScore >= 70 ? 'Almost complete' : 'Keep building'}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  // Use username if available, otherwise fallback to slug for backward compatibility
                  const identifier = profileData.username || slugify(profileData.fullName.trim() || '')
                  if (identifier) router.push(`/profile/${encodeURIComponent(identifier)}`)
                }}
                disabled={!profileData.fullName.trim()}
                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold text-[#426014] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="View public profile"
              >
                <User className="h-4 w-4" />
                View public profile
              </button>
            </div>
          </header>
          <ProgressMeter completionScore={completionScore} isProfileComplete={isProfileComplete} />
          <SuccessBanner success={success} error={error} />
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="relative z-10 border-t border-lime-200/60 bg-white/95 px-6 py-8 sm:px-10 sm:py-12">
          <div className="space-y-8">
            <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">About you</p>
                  <h2 className="text-lg font-semibold text-gray-900">Basic info</h2>
                </div>
                <span className="text-xs text-gray-500">Fields with * are required</span>
              </div>
              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Full name *</label>
                  <input
                    type="text"
                    value={profileData.fullName}
                    onChange={(e) => updateProfileData({ fullName: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Bio</label>
                  <div className="relative mt-2">
                    <textarea
                      value={profileData.bio}
                      onChange={(e) => updateProfileData({ bio: e.target.value })}
                      className="w-full resize-none rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                      placeholder="Share a short snapshot of how you learn or collaborate"
                      rows={2}
                      maxLength={150}
                    />
                    <span className="absolute bottom-3 right-4 text-xs text-gray-500">
                      {profileData.bio.length}/150
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">About</label>
                  <div className="relative mt-2">
                    <textarea
                      value={profileData.about}
                      onChange={(e) => updateProfileData({ about: e.target.value })}
                      className="w-full resize-none rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                      placeholder="Tell your story - your journey, passions, goals, and what drives you in academics and beyond"
                      rows={6}
                      maxLength={2000}
                    />
                    <span className="absolute bottom-3 right-4 text-xs text-gray-500">
                      {profileData.about.length}/2000
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Share more about yourself, your background, interests, and aspirations. This helps others understand your journey better.
                  </p>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">Campus track</p>
                <h2 className="text-lg font-semibold text-gray-900">Academic info</h2>
              </div>
              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Major *</label>
                  <div className="mt-2 rounded-xl border border-lime-200 bg-white/70 px-3 py-2">
                    <CustomSelect
                      options={['Select Major', ...MAJOR_NAMES]}
                      placeholder="Select Major"
                      value={profileData.major}
                      onChange={(selectedOption) => {
                        if (selectedOption === 'Select Major') {
                          updateProfileData({ major: '' })
                        } else {
                          updateProfileData({ major: selectedOption })
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Current semester *</label>
                    <div className="mt-2 rounded-xl border border-lime-200 bg-white/70 px-3 py-2">
                      <CustomSelect
                        options={['Select Semester', ...SEMESTER_OPTIONS]}
                        placeholder="Select Semester"
                        value={profileData.semester}
                        onChange={(selectedOption) => {
                          if (selectedOption === 'Select Semester') {
                            updateProfileData({ semester: '' })
                          } else {
                            updateProfileData({ semester: selectedOption })
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Section *</label>
                    <div className="mt-2 rounded-xl border border-lime-200 bg-white/70 px-3 py-2">
                      <CustomSelect
                        options={['Select Section', 'A', 'B', 'C']}
                        placeholder="Select Section"
                        value={profileData.section}
                        onChange={(selectedOption) => {
                          if (selectedOption === 'Select Section') {
                            updateProfileData({ section: '' })
                          } else {
                            updateProfileData({ section: selectedOption })
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {/* Note: Username and Profile URL settings have been moved to the Settings page */}
            <SkillsManager
              skills={profileData.skills}
              onAddSkill={addSkill}
              onRemoveSkill={removeSkill}
            />
            <AuraDashboard onUploadClick={handleUploadClick} showFullFeatures={false} />
            <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
              <ContributionHub />
            </section>
            <SocialLinksEditor
              socialLinks={{
                githubUrl: profileData.githubUrl,
                linkedinUrl: profileData.linkedinUrl,
                instagramUrl: profileData.instagramUrl,
                facebookUrl: profileData.facebookUrl,
              }}
              onSocialLinkChange={(platform, value) => updateProfileData({ [platform]: value })}
            />
            <div className="flex flex-col gap-3 border-t border-lime-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => router.push('/userpage')}
                className="inline-flex items-center justify-center rounded-full border border-lime-200 px-5 py-3 text-sm font-semibold text-[#426014] transition hover:border-[#90c639] hover:text-[#2d460b]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !hasChanges}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#90c639] to-[#7ab332] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(37,72,8,0.7)] transition hover:shadow-[0_18px_36px_-16px_rgba(37,72,8,0.8)] disabled:cursor-not-allowed disabled:from-[#b5d783] disabled:to-[#b5d783]"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </section>

      {hasChanges && (
        <div className="fixed bottom-4 left-0 right-0 z-50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between rounded-full border border-lime-200/70 bg-white/90 p-2 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#426014]">
                <Sparkles className="h-4 w-4 text-[#90c639]" />
                <span>Unsaved changes</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/userpage')}
                  className="inline-flex items-center justify-center rounded-full border border-lime-200 px-4 py-2 text-xs font-semibold text-[#426014] transition hover:border-[#90c639] hover:text-[#2d460b]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => formRef.current?.requestSubmit()}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#90c639] to-[#7ab332] px-5 py-2 text-xs font-semibold text-white shadow-[0_14px_30px_-18px_rgba(37,72,8,0.7)] transition hover:shadow-[0_18px_36px_-16px_rgba(37,72,8,0.8)] disabled:cursor-not-allowed disabled:from-[#b5d783] disabled:to-[#b5d783]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      Saving
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}
