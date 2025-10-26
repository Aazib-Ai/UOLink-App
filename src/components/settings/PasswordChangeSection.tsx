'use client'

import React, { useState, useEffect } from 'react'
import {
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react'
import {
  changePassword,
  validatePasswordStrength,
  isEmailPasswordUser
} from '@/lib/firebase/password-service'
import { useAuth } from '@/contexts/AuthContext'

interface PasswordChangeSectionProps {
  // No additional props needed for now
}

export default function PasswordChangeSection({ }: PasswordChangeSectionProps) {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<{ isValid: boolean; message: string } | null>(null)
  const [isEmailPasswordUser_, setIsEmailPasswordUser_] = useState(false)

  // Check if user is using email/password authentication
  useEffect(() => {
    setIsEmailPasswordUser_(isEmailPasswordUser())
  }, [user])

  // Validate new password whenever it changes
  useEffect(() => {
    if (newPassword) {
      const validation = validatePasswordStrength(newPassword)
      setPasswordStrength(validation)
    } else {
      setPasswordStrength(null)
    }
  }, [newPassword])

  const handlePasswordChange = async () => {
    // Reset states
    setError(null)
    setSuccess(false)
    setIsChanging(true)

    try {
      // Basic validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('All fields are required')
        return
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match')
        return
      }

      // Validate password strength
      const strengthValidation = validatePasswordStrength(newPassword)
      if (!strengthValidation.isValid) {
        setError(strengthValidation.message)
        return
      }

      // Check if new password is the same as current password
      if (currentPassword === newPassword) {
        setError('New password must be different from current password')
        return
      }

      // Change password
      await changePassword(currentPassword, newPassword)

      // Success
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStrength(null)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setIsChanging(false)
    }
  }

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(false)
    setPasswordStrength(null)
  }

  // If user is not using email/password authentication, show message
  if (!isEmailPasswordUser_) {
    return (
      <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">
            Password Settings
          </p>
          <h3 className="text-lg font-semibold text-[#1f2f10]">Change Password</h3>
        </div>

        <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-blue-800">
                Google Account Detected
              </h4>
              <p className="text-xs sm:text-sm text-blue-700 mt-1 leading-relaxed">
                You signed in with Google. Password changes must be managed through your Google Account settings.
              </p>
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
              >
                Manage Google Account →
              </a>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-lime-100 bg-white/90 p-4 sm:p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">
          Security Settings
        </p>
        <h3 className="text-lg font-semibold text-[#1f2f10]">Change Password</h3>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-green-800">
                Password Changed Successfully
              </h4>
              <p className="text-xs sm:text-sm text-green-700 mt-1 leading-relaxed">
                Your password has been updated. You can now use your new password for future logins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-red-800">
                Error Changing Password
              </h4>
              <p className="text-xs sm:text-sm text-red-700 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Form */}
      <div className="space-y-4 sm:space-y-6">
        {/* Current Password */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full px-3 py-2 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isChanging}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={isChanging}
            >
              {showCurrentPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
              className="w-full px-3 py-2 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isChanging}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={isChanging}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {passwordStrength && newPassword && (
            <div className="mt-2">
              {passwordStrength.isValid ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{passwordStrength.message}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <X className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{passwordStrength.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full px-3 py-2 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isChanging}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={isChanging}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Password Match Indicator */}
          {confirmPassword && newPassword && (
            <div className="mt-2">
              {newPassword === confirmPassword ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">Passwords match</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <X className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">Passwords do not match</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={handlePasswordChange}
            disabled={isChanging || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || (passwordStrength !== null && !passwordStrength.isValid)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {isChanging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Changing Password...
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                Change Password
              </>
            )}
          </button>

          <button
            onClick={resetForm}
            disabled={isChanging}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-4 sm:py-2 bg-gray-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-gray-700 disabled:bg-gray-400 w-full sm:w-auto"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Password Guidelines */}
      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
        <h4 className="text-xs sm:text-sm font-medium text-gray-800 mb-2">Password Requirements</h4>
        <ul className="text-xs text-gray-600 space-y-1 sm:space-y-1.5 leading-relaxed">
          <li>• At least 8 characters long</li>
          <li>• Contains at least one uppercase letter (A-Z)</li>
          <li>• Contains at least one lowercase letter (a-z)</li>
          <li>• Contains at least one number (0-9)</li>
          <li>• Contains at least one special character (!@#$%^&*)</li>
          <li>• Must be different from current password</li>
        </ul>
      </div>
    </section>
  )
}