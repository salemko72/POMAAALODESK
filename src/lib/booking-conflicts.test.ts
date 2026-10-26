import { describe, expect, it } from 'vitest'
import {
  findReservationConflicts,
  hasReservationConflictPair,
  type ConflictReservation,
} from './booking-conflicts'

const reservation = (
  overrides: Partial<ConflictReservation> = {},
): ConflictReservation => ({
  id: 'r1',
  property_id: 'p1',
  check_in: '2026-09-10T14:00:00Z',
  check_out: '2026-09-15T10:00:00Z',
  status: 'confirmed',
  source: 'direct',
  ...overrides,
})

describe('booking conflict engine', () => {
  it('detects an Airbnb and Booking overlap on the same property', () => {
    const conflicts = findReservationConflicts([
      reservation({ id: 'airbnb', source: 'airbnb_ical' }),
      reservation({
        id: 'booking',
        source: 'booking_ical',
        check_in: '2026-09-12T14:00:00Z',
        check_out: '2026-09-16T10:00:00Z',
      }),
    ])

    expect(conflicts).toEqual([
      {
        reservationAId: 'airbnb',
        reservationBId: 'booking',
        propertyId: 'p1',
      },
    ])
  })

  it('detects iCal versus manual and manual versus manual overlaps', () => {
    const conflicts = findReservationConflicts([
      reservation({ id: 'ical', source: 'airbnb_ical' }),
      reservation({
        id: 'manual-a',
        source: 'direct',
        check_in: '2026-09-12T14:00:00Z',
        check_out: '2026-09-16T10:00:00Z',
      }),
      reservation({
        id: 'manual-b',
        source: 'agency',
        check_in: '2026-09-13T14:00:00Z',
        check_out: '2026-09-17T10:00:00Z',
      }),
    ])

    expect(conflicts).toHaveLength(3)
    expect(hasReservationConflictPair(
      [
        reservation({ id: 'ical', source: 'airbnb_ical' }),
        reservation({
          id: 'manual-a',
          source: 'direct',
          check_in: '2026-09-12T14:00:00Z',
          check_out: '2026-09-16T10:00:00Z',
        }),
        reservation({
          id: 'manual-b',
          source: 'agency',
          check_in: '2026-09-13T14:00:00Z',
          check_out: '2026-09-17T10:00:00Z',
        }),
      ],
      'manual-b',
    )).toBe(true)
  })

  it('allows back-to-back stays where checkout equals the next check-in', () => {
    const conflicts = findReservationConflicts([
      reservation({
        id: 'first',
        check_out: '2026-09-15T10:00:00Z',
      }),
      reservation({
        id: 'second',
        check_in: '2026-09-15T10:00:00Z',
        check_out: '2026-09-20T10:00:00Z',
      }),
    ])

    expect(conflicts).toEqual([])
  })

  it('ignores cancelled reservations', () => {
    const conflicts = findReservationConflicts([
      reservation({ id: 'confirmed' }),
      reservation({
        id: 'cancelled',
        status: 'cancelled',
        check_in: '2026-09-12T14:00:00Z',
        check_out: '2026-09-16T10:00:00Z',
      }),
    ])

    expect(conflicts).toEqual([])
  })

  it('does not report overlaps between different properties', () => {
    const conflicts = findReservationConflicts([
      reservation({ id: 'p1-reservation', property_id: 'p1' }),
      reservation({ id: 'p2-reservation', property_id: 'p2' }),
    ])

    expect(conflicts).toEqual([])
  })

  it('returns each overlapping pair exactly once for three-way overbooking', () => {
    const conflicts = findReservationConflicts([
      reservation({ id: 'r1', check_in: '2026-09-10T14:00:00Z', check_out: '2026-09-16T10:00:00Z' }),
      reservation({ id: 'r2', check_in: '2026-09-11T14:00:00Z', check_out: '2026-09-17T10:00:00Z' }),
      reservation({ id: 'r3', check_in: '2026-09-12T14:00:00Z', check_out: '2026-09-18T10:00:00Z' }),
    ])

    expect(conflicts).toEqual([
      { reservationAId: 'r1', reservationBId: 'r2', propertyId: 'p1' },
      { reservationAId: 'r1', reservationBId: 'r3', propertyId: 'p1' },
      { reservationAId: 'r2', reservationBId: 'r3', propertyId: 'p1' },
    ])
  })
})
