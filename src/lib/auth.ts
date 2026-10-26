export type AuthenticatedUser = {
  id: string
  email: string | undefined
}

export function getLoginValidationError(
  email: string,
  password: string
): string | null {
  if (!email.trim()) {
    return 'Email is required.'
  }

  if (!password) {
    return 'Password is required.'
  }

  return null
}

export function getAuthenticatedUser(
  session: {
    user: {
      id: string
      email?: string
    }
  } | null
): AuthenticatedUser | null {
  if (!session) {
    return null
  }

  return {
    id: session.user.id,
    email: session.user.email,
  }
}
