import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), profile: vi.fn(), signOut: vi.fn(), agencies: vi.fn() }))
vi.mock('./lib/auth-supabase', () => ({ getCurrentSession: mocks.session, signOut: mocks.signOut }))
vi.mock('./lib/profiles-repository', () => ({ getProfile: mocks.profile }))
vi.mock('./lib/agency-repository', () => ({ getMyAgencies: mocks.agencies, createAgency: vi.fn() }))
vi.mock('./components/LoginForm', () => ({ LoginForm: () => <p>Sign in form</p> }))
vi.mock('./pages/HomePage', () => ({ HomePage: () => <p>Guest overview</p> }))
vi.mock('./pages/CleaningPage', () => ({ CleaningPage: () => <p>Cleaning work</p> }))
vi.mock('./pages/PeoplePage', () => ({ PeoplePage: () => <p>User administration</p> }))
vi.mock('./pages/PropertiesPage', () => ({ PropertiesPage: () => <p>Property data</p> }))
vi.mock('./pages/CalendarPage', () => ({ CalendarPage: () => <p>Guest calendar</p> }))
vi.mock('./pages/NewBookingPage', () => ({ NewBookingPage: () => <p>Create reservation</p> }))
import App from './App'
beforeEach(() => {
  mocks.session.mockResolvedValue({ user: { id: 'u1' } })
  mocks.profile.mockResolvedValue({ id: 'u1', role: 'viewer', is_active: true })
  mocks.agencies.mockResolvedValue([{id:'a1',name:'Agency',slug:'agency',logo_url:null,country:'',language:'en',currency:'EUR',timezone:'Europe/Sarajevo',role:'viewer',is_active:true}])
})
describe('role access in the application', () => {
  it('blocks direct links to People for a viewer', async () => {
    render(<MemoryRouter initialEntries={['/people']}><App /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied')
    expect(screen.queryByText('User administration')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New Booking' })).not.toBeInTheDocument()
  })
  it('loads cleaning work instead of guest data', async () => {
    mocks.profile.mockResolvedValue({ id: 'u1', role: 'cleaning', is_active: true })
    mocks.agencies.mockResolvedValue([{id:'a1',name:'Agency',slug:'agency',logo_url:null,country:'',language:'en',currency:'EUR',timezone:'Europe/Sarajevo',role:'cleaning',is_active:true}])
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(await screen.findByText('Cleaning work')).toBeInTheDocument()
    expect(screen.queryByText('Guest overview')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Properties' })).not.toBeInTheDocument()
  })
  it('blocks a cleaning user opening the calendar directly', async () => {
    mocks.profile.mockResolvedValue({ id: 'u1', role: 'cleaning', is_active: true })
    mocks.agencies.mockResolvedValue([{id:'a1',name:'Agency',slug:'agency',logo_url:null,country:'',language:'en',currency:'EUR',timezone:'Europe/Sarajevo',role:'cleaning',is_active:true}])
    render(<MemoryRouter initialEntries={['/calendar']}><App /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied')
    expect(screen.queryByText('Guest calendar')).not.toBeInTheDocument()
  })
  it('fails closed when a profile cannot be loaded', async () => {
    mocks.profile.mockRejectedValue(new Error('unavailable'))
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Account access unavailable')
    expect(screen.queryByText('Guest overview')).not.toBeInTheDocument()
  })
  it('removes access when the profile is deactivated while the app is open', async () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(await screen.findByText('Guest overview')).toBeInTheDocument()
    mocks.agencies.mockResolvedValue([{id:'a1',name:'Agency',slug:'agency',logo_url:null,country:'',language:'en',currency:'EUR',timezone:'Europe/Sarajevo',role:'viewer',is_active:false}])
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Account access unavailable')
    expect(screen.queryByText('Guest overview')).not.toBeInTheDocument()
  })
})
