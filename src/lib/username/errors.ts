export type UsernameErrorCode =
  | 'USERNAME_TAKEN'
  | 'RESERVED'
  | 'INVALID_FORMAT'
  | 'COOLDOWN'
  | 'SERVER_ERROR'

export class UsernameError extends Error {
  code: UsernameErrorCode
  constructor(code: UsernameErrorCode, message?: string) {
    super(message || code)
    this.code = code
    this.name = 'UsernameError'
  }
}

export function isUsernameError(err: any): err is UsernameError {
  return !!err && typeof err === 'object' && (err as any).name === 'UsernameError'
}

