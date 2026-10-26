import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './pages/HomePage'
import { MemoryRouter } from 'react-router-dom'

const { getDailyOperationalDataMock, getPropertiesMock, signOutMock, getCurrentSessionMock } = vi.hoisted(() => ({
  getDailyOperationalDataMock: vi.fn(), getPropertiesMock: vi.fn(), signOutMock: vi.fn().mockResolvedValue(undefined), getCurrentSessionMock: vi.fn().mockResolvedValue({ user: { id: 'u1' } }),
}))
vi.mock('./lib/operational-repository', () => ({ getDailyOperationalData: getDailyOperationalDataMock }))
vi.mock('./lib/properties-repository', () => ({ getProperties: getPropertiesMock }))
vi.mock('./lib/auth-supabase', () => ({ signOut: signOutMock, getCurrentSession: getCurrentSessionMock }))

describe('HomePage', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2026-09-06T10:00:00'))
    getDailyOperationalDataMock.mockResolvedValue({ reservations: [], cleanings: [] })
    getPropertiesMock.mockResolvedValue([])
  })

  it('shows daily overview with three square action cards and today/tomorrow columns', async () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /daily overview/i })).toBeInTheDocument()
    expect(screen.getByText(/good morning, there/i)).toBeInTheDocument()
    expect(screen.getByTestId('home-summary-grid')).toHaveClass('grid-cols-3')
    expect(screen.getAllByTestId('home-summary-card')).toHaveLength(3)
    expect(screen.getAllByTestId('home-summary-card').every((card) => card.className.includes('aspect-square'))).toBe(true)
    expect(screen.getByTestId('home-summary-count-check-ins')).toHaveClass('text-[3.375rem]')
    expect(screen.getByTestId('home-summary-icon-check-ins')).toBeInTheDocument()
    expect(screen.getByTestId('home-today-panel')).toBeInTheDocument()
    expect(screen.getByTestId('home-tomorrow-panel')).toBeInTheDocument()
    expect(screen.getByTestId('home-day-grid')).toHaveClass('lg:grid-cols-2')
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('renders tomorrow events with the property image', async () => {
    getDailyOperationalDataMock.mockResolvedValue({
      reservations: [{ id: 'r2', property_id: 'p1', source: 'airbnb', guest_name: 'Nelly Guest', check_in: '2026-09-07T14:00:00', check_out: '2026-09-10T10:00:00', guests: 2, status: 'confirmed' }],
      cleanings: [],
    })
    getPropertiesMock.mockResolvedValue([{ id: 'p1', name: 'Priko', image_url: 'https://example.com/priko.jpg', capacity: 6, rooms: 3, area_m2: 61, check_in_time: '14:00:00', check_out_time: '10:00:00', cleaning_duration_minutes: 120, wifi: true, air_conditioning: true, is_active: true }])
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(await screen.findByText('Nelly Guest')).toBeInTheDocument()
    expect(screen.getByTestId('home-event-image-r2')).toHaveAttribute('src', 'https://example.com/priko.jpg')
    expect(screen.getByRole('link', { name: /nelly guest.*edit reservation/i })).toHaveAttribute('href', '/edit-reservation/r2')
  })

  it('logs out from the Home header control', async () => {
    const onLogout = vi.fn()
    render(<MemoryRouter><HomePage onLogout={onLogout} /></MemoryRouter>)
    const button = await screen.findByRole('button', { name: /logout/i })
    fireEvent.click(button)
    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1))
  })

  it('loads daily data', async () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    await waitFor(() => {
      expect(getDailyOperationalDataMock).toHaveBeenCalled()
      expect(getPropertiesMock).toHaveBeenCalled()
    })
  })
})
