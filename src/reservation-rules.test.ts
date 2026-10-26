import { describe, expect, it } from 'vitest'
import { hasReservationConflict } from './lib/reservation-rules'

describe('reservation conflict rules', () => {
  it('detects overlapping reservations on the same property', async () => {
    const existing = [
      {
        property_id: 'p1',
        check_in: '2026-09-10T14:00:00Z',
        check_out: '2026-09-14T10:00:00Z',
        status: 'confirmed',
      },
    ]

    expect(
      hasReservationConflict(
        existing,
        'p1',
        '2026-09-13T14:00:00Z',
        '2026-09-16T10:00:00Z',
      ),
    ).toBe(true)
  })

  it('allows a reservation starting exactly at the previous checkout', async () => {
    const existing = [
      {
        property_id: 'p1',
        check_in: '2026-09-10T14:00:00Z',
        check_out: '2026-09-14T10:00:00Z',
        status: 'confirmed',
      },
    ]

    expect(
      hasReservationConflict(
        existing,
        'p1',
        '2026-09-14T10:00:00Z',
        '2026-09-18T10:00:00Z',
      ),
    ).toBe(false)
  })

  it('ignores cancelled reservations', async () => {
    const existing = [
      {
        property_id: 'p1',
        check_in: '2026-09-10T14:00:00Z',
        check_out: '2026-09-14T10:00:00Z',
        status: 'cancelled',
      },
    ]

    expect(
      hasReservationConflict(
        existing,
        'p1',
        '2026-09-12T14:00:00Z',
        '2026-09-16T10:00:00Z',
      ),
    ).toBe(false)
  })
})
