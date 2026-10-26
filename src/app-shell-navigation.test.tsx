import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './components/AppShell'

describe('AppShell', () => {
  it('shows the primary mobile navigation items without logout', () => {
    render(<MemoryRouter><AppShell role="admin"><div>Page content</div></AppShell></MemoryRouter>)
    expect(screen.getByRole('link', { name: /calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /properties/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /reservation/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
  })
})
