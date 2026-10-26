import { describe, expect, it, vi, beforeEach } from 'vitest'
import { supabase } from './lib/supabase'
import {
  getCurrentSession,
  signOut,
  requestPasswordReset,
} from './lib/auth-supabase'

describe('Supabase authentication services', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the current Supabase session', async () => {
    const session = {
      user: {
        id: 'user-123',
        email: 'kate@example.com',
      },
    } as never

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session },
      error: null,
    })

    await expect(getCurrentSession()).resolves.toBe(session)
  })

  it('signs the current user out', async () => {
    const signOutSpy = vi
      .spyOn(supabase.auth, 'signOut')
      .mockResolvedValue({ error: null })

    await expect(signOut()).resolves.toEqual({ error: null })
    expect(signOutSpy).toHaveBeenCalledTimes(1)
  })

  it('requests a password reset email', async () => {
    const resetSpy = vi
      .spyOn(supabase.auth, 'resetPasswordForEmail')
      .mockResolvedValue({ data: {}, error: null })

    await expect(
      requestPasswordReset('kate@example.com')
    ).resolves.toEqual({
      data: {},
      error: null,
    })

    expect(resetSpy).toHaveBeenCalledWith(
      'kate@example.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('/reset-password'),
      })
    )
  })
})
