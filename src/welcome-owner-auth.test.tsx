import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WelcomeScreen } from './components/WelcomeScreen'
import * as authSupabase from './lib/auth-supabase'

vi.mock('./components/WelcomeIllustration', () => ({ WelcomeIllustration: () => null }))
vi.mock('./lib/settings', () => ({
  getSettings: () => ({ language: 'en' }),
  saveSettings: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

async function completeOwnerForm() {
  fireEvent.click(screen.getByRole('button', { name: /create a new agency/i }))
  fireEvent.change(screen.getByLabelText(/agency name/i), { target: { value: 'Soko_sivi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue to owner account/i }))
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Salem Kapic - Kantardzic' } })
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'salemko@gmail.com' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'existing-password' } })
  fireEvent.click(screen.getByRole('button', { name: /create agency/i }))
}

describe('owner account creation', () => {
  it('signs in an existing confirmed account and continues with the pending agency', async () => {
    vi.spyOn(authSupabase, 'signUpOwner').mockResolvedValue({
      data: { user: { identities: [] } as unknown as User, session: null },
      error: null,
    })
    const signIn = vi.spyOn(authSupabase, 'signInWithPassword').mockResolvedValue({
      data: { user: {} as User, session: {} as Session },
      error: null,
    })
    const onAuthenticated = vi.fn()

    render(<WelcomeScreen onAuthenticated={onAuthenticated} />)
    await completeOwnerForm()

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('salemko@gmail.com', 'existing-password'))
    expect(onAuthenticated).toHaveBeenCalledOnce()
    expect(JSON.parse(localStorage.getItem('bookweb-pending-agency') ?? 'null')).toMatchObject({ name: 'Soko_sivi' })
  })

  it('opens sign in with the email prefilled when the entered password is not the existing password', async () => {
    vi.spyOn(authSupabase, 'signUpOwner').mockResolvedValue({
      data: { user: { identities: [] } as unknown as User, session: null },
      error: null,
    })
    vi.spyOn(authSupabase, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as never,
    })

    render(<WelcomeScreen onAuthenticated={vi.fn()} />)
    await completeOwnerForm()

    expect(await screen.findByText(/already has a PomaaaloDesk account/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('salemko@gmail.com')
  })
})
