import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CalendarPage } from './pages/CalendarPage'

const getProperties = vi.hoisted(() => vi.fn())
const getReservations = vi.hoisted(() => vi.fn())
const updateReservationDates = vi.hoisted(() => vi.fn())

vi.mock('./lib/properties-repository', () => ({
  getProperties,
}))

vi.mock('./lib/reservations-repository', () => ({
  getReservations,
  updateReservationDates,
}))

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
  guest_name: 'Test Guest',
  check_in: '2026-09-10T14:00:00',
  check_out: '2026-09-15T10:00:00',
  guests: 2,
  status: 'confirmed',
}

beforeEach(() => {
  vi.clearAllMocks()
  getProperties.mockResolvedValue([property])
  getReservations.mockResolvedValue([reservation])
  updateReservationDates.mockResolvedValue({
    ...reservation,
    check_in: '2026-09-10T14:00:00',
    check_out: '2026-09-17T08:00:00.000Z',
  })
})

describe('CalendarPage resize persistence', () => {
  it('does not allow a viewer to resize a reservation', async () => {
    render(<MemoryRouter><CalendarPage role="viewer" /></MemoryRouter>)
    const handle = await screen.findByTestId('reservation-resize-end')
    expect(handle).toBeDisabled()
    fireEvent.pointerDown(handle, { clientX: 0 })
    fireEvent.pointerMove(window, { clientX: 100 })
    fireEvent.pointerUp(window)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(updateReservationDates).not.toHaveBeenCalled()
  })
  it('saves a successful resize to Supabase', async () => {
    render(
      <MemoryRouter>
        <CalendarPage role="admin" />
      </MemoryRouter>,
    )

    const handle = await screen.findByTestId('reservation-resize-end')

    fireEvent.pointerDown(handle, { clientX: 0 })
    fireEvent.pointerMove(window, { clientX: 92 })
    fireEvent.pointerUp(window, { clientX: 92 })

    expect(updateReservationDates).not.toHaveBeenCalled()

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      '10.09.2026 → 17.09.2026',
    )

    fireEvent.click(
      screen.getByRole('button', { name: /confirm change/i }),
    )

    await waitFor(() => {
      expect(updateReservationDates).toHaveBeenCalledWith(
        'r1',
        '2026-09-10T14:00:00',
        '2026-09-17T08:00:00.000Z',
      )
    })
  })

  it('rejects a conflicting resize and rolls back without saving', async () => {
    getReservations.mockResolvedValue([
      reservation,
      {
        ...reservation,
        id: 'r2',
        guest_name: 'Other Guest',
        check_in: '2026-09-15T14:00:00',
        check_out: '2026-09-20T10:00:00',
      },
    ])

    render(
      <MemoryRouter>
        <CalendarPage role="admin" />
      </MemoryRouter>,
    )

    const handles = await screen.findAllByTestId('reservation-resize-end')

    fireEvent.pointerDown(handles[0], { clientX: 0 })
    fireEvent.pointerMove(window, { clientX: 92 })
    fireEvent.pointerUp(window, { clientX: 92 })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reservation overlaps another booking.',
    )
    expect(updateReservationDates).not.toHaveBeenCalled()
  })
})
