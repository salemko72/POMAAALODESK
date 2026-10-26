import { describe, expect, it } from 'vitest'

import {
  buildDailyOperationalSummary,
  type OperationalReservation,
} from './lib/operational-data'

describe('operational data', () => {
  it("counts today's check-ins, check-outs and cleanings", () => {
    const reservations: OperationalReservation[] = [
      {
        id: 'r1',
        property_id: 'p1',
        guest_name: 'Guest One',
        check_in: '2026-09-05T14:00:00+02:00',
        check_out: '2026-09-08T10:00:00+02:00',
        guests: 4,
        source: 'airbnb',
        status: 'confirmed',
      },
      {
        id: 'r2',
        property_id: 'p2',
        guest_name: 'Guest Two',
        check_in: '2026-09-02T14:00:00+02:00',
        check_out: '2026-09-05T10:00:00+02:00',
        guests: 2,
        source: 'direct',
        status: 'confirmed',
      },
      {
        id: 'r3',
        property_id: 'p3',
        guest_name: 'Cancelled Guest',
        check_in: '2026-09-05T14:00:00+02:00',
        check_out: '2026-09-06T10:00:00+02:00',
        guests: 2,
        source: 'booking',
        status: 'cancelled',
      },
    ]

    const cleanings = [
      {
        id: 'c1',
        reservation_id: 'r2',
        property_id: 'p2',
        start_time: '2026-09-05T10:00:00+02:00',
        end_time: '2026-09-05T12:00:00+02:00',
        status: 'pending' as const,
        is_manually_overridden: false,
      },
    ]

    const result = buildDailyOperationalSummary(
      reservations,
      cleanings,
      '2026-09-05',
    )

    expect(result.checkIns).toHaveLength(1)
    expect(result.checkOuts).toHaveLength(1)
    expect(result.cleanings).toHaveLength(1)
  })

  it('does not include cancelled reservations', () => {
    const reservations: OperationalReservation[] = [
      {
        id: 'r1',
        property_id: 'p1',
        guest_name: 'Cancelled Guest',
        check_in: '2026-09-05T14:00:00+02:00',
        check_out: '2026-09-06T10:00:00+02:00',
        guests: 2,
        source: 'airbnb',
        status: 'cancelled',
      },
    ]

    const result = buildDailyOperationalSummary(
      reservations,
      [],
      '2026-09-05',
    )

    expect(result.checkIns).toHaveLength(0)
    expect(result.checkOuts).toHaveLength(0)
  })
})