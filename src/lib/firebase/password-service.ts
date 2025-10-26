import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth'
import { auth } from './app'

/**
 * Reauthenticates the user with their current password
 */
export async function reauthenticateUser(currentPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user || !user.email) {
    throw new Error('No authenticated user found')
  }

  // Create credential with current password
  const credential = EmailAuthProvider.credential(user.email, currentPassword)

  // Reauthenticate the user
  await reauthenticateWithCredential(user, credential)
}

/**
 * Updates the user's password after reauthentication
 */
export async function changeUserPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('No authenticated user found')
  }

  // Update the password
  await updatePassword(user, newPassword)
}

/**
 * Complete password change flow: reauthenticate and update password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    // First reauthenticate with current password
    await reauthenticateUser(currentPassword)

    // Then update to new password
    await changeUserPassword(newPassword)
  } catch (error) {
    console.error('Password change error:', error)

    // Handle specific Firebase errors
    if (error instanceof Error) {
      if (error.message.includes('auth/wrong-password')) {
        throw new Error('Current password is incorrect')
      } else if (error.message.includes('auth/weak-password')) {
        throw new Error('New password is too weak. Please choose a stronger password')
      } else if (error.message.includes('auth/too-many-requests')) {
        throw new Error('Too many failed attempts. Please try again later')
      } else if (error.message.includes('auth/requires-recent-login')) {
        throw new Error('This operation is sensitive and requires recent authentication. Please log in again')
      }
    }

    throw new Error('Failed to change password. Please try again')
  }
}

/**
 * Validates password strength
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message: string } {
  if (!password) {
    return { isValid: false, message: 'Password is required' }
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' }
  }

  if (password.length > 128) {
    return { isValid: false, message: 'Password must be less than 128 characters long' }
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' }
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' }
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' }
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' }
  }

  return { isValid: true, message: 'Password meets all requirements' }
}

/**
 * Checks if user is using email/password authentication (not Google)
 */
export function isEmailPasswordUser(): boolean {
  const user = auth.currentUser
  if (!user || !user.providerData.length) {
    return false
  }

  // Check if user has email/password provider
  return user.providerData.some(provider => provider.providerId === 'password')
}