import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const getCurrentSession = vi.hoisted(() => vi.fn().mockResolvedValue(null))

vi.mock('./lib/auth-supabase', () => ({
  getCurrentSession,
  signInWithPassword: vi.fn(),
}))

vi.mock('./components/LoginForm', () => ({
  LoginForm: ({ onAuthenticated }: { onAuthenticated: () => void }) => (
    <button type="button" onClick={onAuthenticated}>Mock sign in</button>
  ),
}))
vi.mock('./components/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('./lib/agency-context', () => ({ AgencyProvider: ({children}:{children:ReactNode}) => <>{children}</> }))
vi.mock('./lib/agency-repository', () => ({ getMyAgencies: vi.fn().mockResolvedValue([{id:'a1',name:'Agency',slug:'agency',logo_url:null,country:'',language:'en',currency:'EUR',timezone:'Europe/Sarajevo',role:'admin',is_active:true}]), createAgency: vi.fn() }))
vi.mock('./pages/HomePage', () => ({ HomePage: () => <div>Home dashboard</div> }))
vi.mock('./pages/CalendarPage', () => ({ CalendarPage: () => <div>Calendar page</div> }))
vi.mock('./pages/PropertiesPage', () => ({ PropertiesPage: () => <div>Properties page</div> }))
vi.mock('./pages/NewBookingPage', () => ({ NewBookingPage: () => <div>New booking page</div> }))
vi.mock('./pages/SettingsPage', () => ({ SettingsPage: () => <div>Settings page</div> }))
vi.mock('./pages/PeoplePage', () => ({ PeoplePage: () => <div>People page</div> }))
vi.mock('./pages/AdministrationPages', () => ({ AdministrationPages: () => <div>Administration page</div> }))
vi.mock('./pages/AgencyPage', () => ({ AgencyPage: () => <div>Agency page</div> }))

vi.mock('./lib/profiles-repository', () => ({ getProfile: vi.fn().mockResolvedValue({id:'u1',role:'admin',is_active:true}) }))
import App from './App'

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}</span>
}

describe('login redirect', () => {
  it('lands on Home after successful login', async () => {
    render(<MemoryRouter initialEntries={['/calendar']}><App/><LocationProbe/></MemoryRouter>)
    getCurrentSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    fireEvent.click(await screen.findByRole('button', { name: /^sign in/i }))
    fireEvent.click(await screen.findByRole('button', { name: /mock sign in/i }))
    expect(await screen.findByText('Home dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })
})
