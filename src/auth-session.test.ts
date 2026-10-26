import { describe, expect, it } from 'vitest'
import { getAuthenticatedUser } from './lib/auth'

describe('authentication session', () => {
  it('returns the authenticated user when a session exists', () => {
    const user = getAuthenticatedUser({
      user: {
        id: 'user-123',
        email: 'kate@example.com',
      },
    })

    expect(user).toEqual({
      id: 'user-123',
      email: 'kate@example.com',
    })
  })

  it('returns null when there is no session', () => {
    expect(getAuthenticatedUser(null)).toBeNull()
  })
})
