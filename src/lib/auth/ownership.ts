import { NextResponse } from 'next/server'

export function validateProfileOwnership(userUid: string, requestedUid: string): void {
  if (userUid !== requestedUid) {
    throw OwnershipError('Access denied: profile ownership mismatch', 'ACCESS_DENIED')
  }
}

export function validateNoteOwnership(noteData: any, userUid: string): void {
  const owner = noteData?.uploadedBy || noteData?.ownerId || noteData?.uid
  if (!owner || owner !== userUid) {
    throw OwnershipError('Access denied: note ownership mismatch', 'ACCESS_DENIED')
  }
}

export function validateCommentOwnership(commentData: any, userUid: string): void {
  const owner = commentData?.userId || commentData?.ownerId || commentData?.uid
  if (!owner || owner !== userUid) {
    throw OwnershipError('Access denied: comment ownership mismatch', 'ACCESS_DENIED')
  }
}

export function validateUsernameOwnership(userId: string, requestedUserId: string): void {
  if (userId !== requestedUserId) {
    throw OwnershipError('Access denied: username ownership mismatch', 'ACCESS_DENIED')
  }
}

export function OwnershipError(message: string, code: string) {
  const err = new Error(message) as Error & { code?: string }
  ;(err as any).code = code
  return err
}

export function ownershipErrorResponse(details?: string) {
  return NextResponse.json(
    { error: 'Access denied', code: 'ACCESS_DENIED', details },
    { status: 403 }
  )
}
