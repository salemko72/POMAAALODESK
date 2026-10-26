import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/auth-supabase', () => ({
  getCurrentSession: vi.fn().mockResolvedValue(null),
  signInWithPassword: vi.fn(),
}))

describe('authenticated application shell', () => {
  it('shows the login screen when there is no authenticated session', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(
      (await screen.findAllByRole('button', { name: /sign in/i })).length,
    ).toBeGreaterThan(0)
  })
})
