import { describe, expect, it } from 'vitest'
import { hasReservationConflict } from './reservation-rules'

describe('reservation resize conflict rules', () => {
  const existing = [
    {
      id: 'current',
      property_id: 'p1',
      check_in: '2026-09-10T14:00:00',
      check_out: '2026-09-15T10:00:00',
      status: 'confirmed',
    },
    {
      id: 'other',
      property_id: 'p1',
      check_in: '2026-09-16T14:00:00',
      check_out: '2026-09-20T10:00:00',
      status: 'confirmed',
    },
  ]

  it('ignores the reservation currently being resized', () => {
    expect(
      hasReservationConflict(
        existing,
        'p1',
        '2026-09-09T14:00:00',
        '2026-09-15T10:00:00',
        'current',
      ),
    ).toBe(false)
  })

  it('rejects a resize that overlaps another reservation', () => {
    expect(
      hasReservationConflict(
        existing,
        'p1',
        '2026-09-10T14:00:00',
        '2026-09-17T10:00:00',
        'current',
      ),
    ).toBe(true)
  })
})
