export interface ApiSuccess<T> {
  data: T
}

export interface ApiErrorResponse {
  error: string
  code?: string
  details?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse

// Common request types matching design
export interface ProfileUpdateRequest {
  fullName?: string
  major?: string
  semester?: string
  section?: string
  bio?: string
  about?: string
  skills?: string[]
  githubUrl?: string
  linkedinUrl?: string
  instagramUrl?: string
  facebookUrl?: string
  profilePicture?: string | null
  profilePictureStorageKey?: string | null
}

export interface VoteRequest { type: 'up' | 'down' }
export interface VoteResponse {
  upvotes: number
  downvotes: number
  userVote: 'up' | 'down' | null
  credibilityScore: number
}

export interface SaveResponse { saved: boolean; saveCount: number; credibilityScore: number }

export interface ReportRequest { reason: string; description?: string }
export interface ReportStatus { hasReported: boolean; reportCount: number }

export interface UsernameRequest { username: string }
export interface UsernameAvailability { available: boolean }
