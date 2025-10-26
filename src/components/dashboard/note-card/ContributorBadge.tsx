import { User } from 'lucide-react'
import Link from 'next/link'
import { OptimizedProfileImage } from '../../optimized/OptimizedProfileImage'
import { Note, ProfileData, AuraDetails, Variant } from './types'

interface ContributorBadgeProps {
  note: Note
  profileData: ProfileData
  auraBorderClass: string
  auraDetails?: AuraDetails
  auraScoreLabel: string | null
  variant: Variant
}

export const ContributorBadge: React.FC<ContributorBadgeProps> = ({
  note,
  profileData,
  auraBorderClass,
  auraDetails,
  auraScoreLabel,
  variant
}) => {
  const contributorDisplayName = note.contributorDisplayName || note.contributorName || ''
  const contributorUserId = typeof note.uploadedBy === 'string' ? note.uploadedBy : ''
  const cachedUsername = contributorUserId ? profileData.profileUsernames[contributorUserId] : undefined
  const usernameFromNote =
    typeof note.uploaderUsername === 'string' && note.uploaderUsername.trim()
      ? note.uploaderUsername.trim()
      : undefined
  const profileUsername = cachedUsername || usernameFromNote || contributorDisplayName || 'unknown'

  // Get the username for profile linking, fallback to contributorDisplayName for legacy compatibility
  const getProfileUrl = () => {
    return profileUsername ? `/profile/${encodeURIComponent(profileUsername)}` : '#';
  };
  const renderProfilePicture = () => {
    const profilePicture = contributorUserId ? profileData.profilePictures[contributorUserId] : null;
    
    return (
      <OptimizedProfileImage
        src={profilePicture}
        alt={`${contributorDisplayName || 'Unknown'}'s profile`}
        size="sm"
        fallbackInitials={contributorDisplayName ? contributorDisplayName.slice(0, 2).toUpperCase() : 'UN'}
        priority={false}
      />
    )
  }

  const renderDate = () => {
    const dateText = note.uploadedAt?.toDate?.()?.toLocaleDateString("en-GB", {
      month: 'short',
      day: 'numeric'
    }) || new Date().toLocaleDateString("en-GB", {
      month: 'short',
      day: 'numeric'
    })

    return (
      <p className={`text-gray-400 text-xs ${variant === 'mobile' ? 'ml-2' : ''} flex-shrink-0`}>
        {dateText}
      </p>
    )
  }

  const renderAuraTier = () => {
    if (!auraDetails) return null

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${auraDetails.badgeClass} ${
          variant === 'desktop' ? 'text-[11px]' : 'mt-0.5'
        }`}
        title={auraScoreLabel ? `Aura ${auraScoreLabel}` : 'Aura tier'}
      >
        {auraDetails.tierName}
      </span>
    )
  }

  if (variant === 'mobile') {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`relative inline-flex items-center justify-center rounded-full p-[2px] ${auraBorderClass} flex-shrink-0`}>
            {renderProfilePicture()}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={getProfileUrl()}
              className="cursor-pointer font-semibold text-[#90c639] hover:text-[#7ab332] hover:underline text-sm truncate block"
            >
              {contributorDisplayName || "unknown"}
            </Link>
            {renderAuraTier()}
          </div>
        </div>
        {renderDate()}
      </div>
    )
  }

  if (variant === 'tablet') {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`relative inline-flex items-center justify-center rounded-full p-[2px] ${auraBorderClass} flex-shrink-0`}>
            {renderProfilePicture()}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={getProfileUrl()}
              className="cursor-pointer font-semibold text-[#90c639] hover:text-[#7ab332] hover:underline text-sm truncate block"
            >
              {contributorDisplayName || "unknown"}
            </Link>
            {renderAuraTier()}
          </div>
        </div>
        {renderDate()}
      </div>
    )
  }

  // Desktop variant
  return (
    <div className="mb-5 flex items-center gap-2">
      <span className="text-sm text-gray-600">By:</span>
      <div className="flex items-center gap-2">
        <div className={`relative inline-flex items-center justify-center rounded-full p-[2px] ${auraBorderClass}`}>
          {renderProfilePicture()}
        </div>

        <Link
          href={getProfileUrl()}
          className="cursor-pointer font-semibold text-[#90c639] transition-colors duration-300 hover:text-[#7ab332] hover:underline"
        >
          {contributorDisplayName || "unknown"}
        </Link>
        {renderAuraTier()}
      </div>
    </div>
  )
}
