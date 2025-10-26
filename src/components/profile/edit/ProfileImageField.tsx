'use client'

import { RefObject } from 'react'
import { X, User } from 'lucide-react'

interface ProfileImageFieldProps {
  previewImage: string | null
  isUploadingImage: boolean
  isDeletingImage: boolean
  fileInputRef: RefObject<HTMLInputElement>
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onImageRemove: () => void
}

export default function ProfileImageField({
  previewImage,
  isUploadingImage,
  isDeletingImage,
  fileInputRef,
  onImageUpload,
  onImageRemove,
}: ProfileImageFieldProps) {

  return (
    <div className="relative mx-auto flex flex-col items-center sm:mx-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageUpload}
        className="hidden"
      />
      <div
        className={`group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/40 p-1.5 shadow-[0_20px_40px_-24px_rgba(37,72,8,0.65)] transition ${
          isUploadingImage || isDeletingImage
            ? 'pointer-events-none opacity-70'
            : 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_24px_45px_-22px_rgba(37,72,8,0.65)]'
        }`}
        onClick={() => !isUploadingImage && !isDeletingImage && fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (!isUploadingImage && !isDeletingImage && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload profile picture"
      >
        {previewImage && (
          <img
            key={previewImage}
            src={previewImage}
            alt="Profile preview"
            className="absolute inset-0 h-full w-full rounded-full object-cover"
          />
        )}
        {!previewImage && !isUploadingImage && !isDeletingImage && (
          <div className="flex flex-col items-center gap-1 text-gray-700">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[#5f9428] shadow-inner">
              <User className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">Upload photo</span>
          </div>
        )}
        {isUploadingImage && (
          <div className="flex flex-col items-center gap-1 text-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            <span className="text-xs font-medium">Uploading</span>
          </div>
        )}
        {isDeletingImage && (
          <div className="flex flex-col items-center gap-1 text-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            <span className="text-xs font-medium">Removing</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[#90c639]/0 transition group-hover:bg-[#90c639]/15" />
      </div>
      {previewImage && !(isUploadingImage || isDeletingImage) && (
        <button
          type="button"
          onClick={onImageRemove}
          className="absolute -top-2 left-4 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white text-gray-500 shadow-sm transition hover:text-rose-500"
          aria-label="Remove profile picture"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="mt-4 text-xs font-medium text-gray-600">
        {isUploadingImage ? 'Uploading...' : isDeletingImage ? 'Removing...' : 'Square image, max 5MB'}
      </span>
    </div>
  )
}