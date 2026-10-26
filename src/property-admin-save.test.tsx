import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const createPropertyMock = vi.hoisted(() => vi.fn())
const getAllPropertiesMock = vi.hoisted(() => vi.fn())
const createExternalCalendarMock = vi.hoisted(() => vi.fn())
vi.mock('./lib/ical-repository', () => ({
  getExternalCalendars: vi.fn().mockResolvedValue([]),
  createExternalCalendar: createExternalCalendarMock,
  updateExternalCalendar: vi.fn(),
  deleteExternalCalendar: vi.fn(),
}))
vi.mock('./components/AddressAutocomplete', () => ({ AddressAutocomplete: () => <input aria-label="Address" /> }))
vi.mock('./components/PropertyTimeline', () => ({ PropertyTimeline: () => <div /> }))
vi.mock('./lib/properties-repository', async () => ({
  createProperty: createPropertyMock,
  getAllProperties: getAllPropertiesMock,
  updateProperty: vi.fn(),
  deactivateProperty: vi.fn(),
}))
vi.mock('./lib/reservations-repository', () => ({ getReservations: vi.fn().mockResolvedValue([]) }))
vi.mock('./lib/property-images-repository', () => ({
  getPropertyImageRecord: vi.fn().mockResolvedValue(null),
  savePropertyImageRecord: vi.fn().mockResolvedValue(null),
  deletePropertyImageRecord: vi.fn().mockResolvedValue(undefined),
}))
import { PropertiesPage } from './pages/PropertiesPage'

describe('property save flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAllPropertiesMock.mockResolvedValue([])
    createPropertyMock.mockResolvedValue({ id: 'p1', name: 'Priko', address: 'Kralja Tomislava 27', city: 'Stari Grad', capacity: 6, rooms: 3, area_m2: 61, check_in_time: '14:00:00', check_out_time: '10:00:00', cleaning_duration_minutes: 120, wifi: true, air_conditioning: true, is_active: true })
    createExternalCalendarMock.mockResolvedValue({ id: 'cal1', property_id: 'p1', source: 'airbnb_ical', feed_url: 'https://example.com/a.ics', is_active: true, last_synced_at: null, sync_status: 'idle' })
  })

  it('returns to the property list after saving a new property', async () => {
    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /new property/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Priko' } })
    fireEvent.click(screen.getByRole('button', { name: /create property/i }))
    await waitFor(() => expect(createPropertyMock).toHaveBeenCalled())
    expect(await screen.findByText(/no properties yet/i)).toBeInTheDocument()
  })

  it('allows adding a calendar link before saving a new property', async () => {
    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /new property/i }))
    expect(screen.getByText('Calendar links')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Priko' } })
    fireEvent.change(screen.getByLabelText('New calendar link'), { target: { value: 'https://example.com/a.ics' } })
    fireEvent.click(screen.getByRole('button', { name: /add calendar link/i }))
    expect(screen.getByDisplayValue('https://example.com/a.ics')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /create property/i }))
    await waitFor(() => expect(createExternalCalendarMock).toHaveBeenCalledWith(expect.objectContaining({ property_id: 'p1', feed_url: 'https://example.com/a.ics' })))
  })
})
