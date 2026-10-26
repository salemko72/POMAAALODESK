import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

const getPropertiesMock = vi.hoisted(() => vi.fn())
const getReservationsMock = vi.hoisted(() => vi.fn())

vi.mock('./lib/properties-repository', () => ({
  getProperties: getPropertiesMock,
}))

vi.mock('./lib/reservations-repository', () => ({
  getReservations: getReservationsMock,
  updateReservationDates: vi.fn(),
}))

import { CalendarPage } from './pages/CalendarPage'

function LocationProbe() { const location = useLocation(); return <span data-testid="location">{location.pathname}</span> }

const property = {
  id: 'p1',
  name: 'Priko',
  capacity: 6,
  rooms: 3,
  area_m2: 61,
  check_in_time: '14:00:00',
  check_out_time: '10:00:00',
  cleaning_duration_minutes: 120,
  wifi: true,
  air_conditioning: true,
  is_active: true,
}

const reservation = {
  id: 'r1',
  property_id: 'p1',
  source: 'direct',
  guest_name: 'Demo Guest',
  check_in: '2026-09-10T14:00:00',
  check_out: '2026-09-15T10:00:00',
  guests: 2,
  status: 'confirmed',
}

const importedReservation = { ...reservation, id:'r3', source:'airbnb', guest_name:'Nelly Guest', check_in:'2026-09-20T14:00:00', check_out:'2026-09-24T10:00:00' }

const overlappingReservation = {
  ...reservation,
  id: 'r2',
  guest_name: 'Other Guest',
  check_in: '2026-09-12T14:00:00',
  check_out: '2026-09-18T10:00:00',
}

getPropertiesMock.mockResolvedValue([property])
getReservationsMock.mockResolvedValue([reservation, overlappingReservation, importedReservation])

describe('CalendarPage', () => {
  it('shows a dense 45-day default timeline', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    const days = await screen.findAllByTestId(/^calendar-day-/)
    expect(days).toHaveLength(45)
  })

  it('renders the interactive timeline structure', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    expect(await screen.findByText('Calendar')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-timeline')).toBeInTheDocument()
    expect((await screen.findAllByTestId('calendar-property-row')).length).toBeGreaterThan(0)
  })

  it('renders the guest name and a compact source badge on the booking bar', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    expect(await screen.findByText('Demo Guest')).toBeInTheDocument()
    expect(await screen.findByTestId('reservation-source-badge-r1')).toHaveTextContent('S')
    expect(await screen.findByText('10.09. - 15.09.2026')).toBeInTheDocument()
    expect(await screen.findAllByLabelText('5 nights')).not.toHaveLength(0)
  })

  it('defaults the timeline to 100% while keeping the dense legacy day width', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    expect(await screen.findByText('100%')).toBeInTheDocument()
    const timeline = screen.getByTestId('calendar-timeline').firstElementChild as HTMLElement
    expect(timeline.style.width).toBe('2367px')
  })

  it('toggles FIT on and off', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    expect(await screen.findByText('Calendar')).toBeInTheDocument()
    const fit = screen.getByRole('button', { name: /fit/i })
    expect(fit).toHaveAttribute('aria-pressed', 'false')
    expect(fit).toHaveClass('h-6')
    fireEvent.click(fit)
    await waitFor(() => expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(90))
    expect(fit).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(fit)
    await waitFor(() => expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(45))
    expect(fit).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders resize handles for editable bookings', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    expect((await screen.findAllByTestId('reservation-resize-start')).length).toBeGreaterThan(0)
    expect((await screen.findAllByTestId('reservation-resize-end')).length).toBeGreaterThan(0)
  })

  it('opens Edit Reservation on double-click', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /><LocationProbe /></MemoryRouter>)
    fireEvent.doubleClick(await screen.findByTestId('reservation-body-r1'))
    expect((await screen.findByTestId('location')).textContent).toBe('/edit-reservation/r1')
  })

  it('renders bookings in separate vertical lanes when they overlap', async () => {
    render(<MemoryRouter><CalendarPage role="admin" /></MemoryRouter>)
    expect((await screen.findAllByTestId(/reservation-lane-/)).length).toBeGreaterThanOrEqual(2)
  })
})


describe('Calendar imported booking affordance',()=>{
  it('shows resize affordances on imported bookings but keeps them read-only', async()=>{
    render(<MemoryRouter><CalendarPage role="admin"/></MemoryRouter>)
    const starts = await screen.findAllByTestId('reservation-resize-start')
    expect(starts.length).toBeGreaterThanOrEqual(3)
    expect(starts.find((button) => button.getAttribute('title')?.includes('Imported reservation'))).toBeDisabled()
  })
})
