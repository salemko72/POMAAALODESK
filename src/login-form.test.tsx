import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LoginForm } from './components/LoginForm'
import * as authSupabase from './lib/auth-supabase'
import type { User, Session } from '@supabase/supabase-js'

describe('login form', () => {
  it('shows required field errors when submitted empty', () => {
    render(<LoginForm onAuthenticated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })

  it('authenticates when valid credentials are provided', async () => {
    vi.spyOn(authSupabase, 'signInWithPassword').mockResolvedValue({
      data: {
        user: {} as User,
        session: {} as Session,
      },
      error: null,
    })

    const onAuthenticated = vi.fn()

    render(<LoginForm onAuthenticated={onAuthenticated} />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'kate@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalled()
    })
  })
})
