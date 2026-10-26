import { describe, expect, it } from 'vitest'
import { findBookingConflict, isBookingDateUnavailable, validateBookingForm, type BookingFormValues } from './lib/reservation-form'
import type { Property } from './lib/properties-repository'
import type { Reservation } from './lib/reservations-repository'

const property: Property = { id: 'p1', name: 'Priko', capacity: 6, rooms: 3, area_m2: 61, check_in_time: '14:00:00', check_out_time: '10:00:00', cleaning_duration_minutes: 120, wifi: true, air_conditioning: true, is_active: true }
const base: BookingFormValues = { propertyId: 'p1', checkIn: '2026-09-10', checkOut: '2026-09-15', guestName: 'Demo Guest', guests: 2, source: 'direct', notes: '' }

describe('new booking validation', () => {
  it('rejects an invalid date range', () => expect(validateBookingForm({ ...base, checkOut: '2026-09-10' }, property)).toBe('Check-out must be after check-in.'))
  it('rejects guests over property capacity', () => expect(validateBookingForm({ ...base, guests: 7 }, property)).toContain('up to 6 guests'))
  it('rejects a missing guest name', () => expect(validateBookingForm({ ...base, guestName: '   ' }, property)).toBe('Enter the guest name.'))
  it('detects overlap and ignores cancelled bookings', () => {
    const existing: Reservation[] = [{ id: 'r1', property_id: 'p1', source: 'direct', guest_name: 'Existing', check_in: '2026-09-12T14:00:00.000Z', check_out: '2026-09-18T10:00:00.000Z', guests: 2, status: 'confirmed' }]
    expect(findBookingConflict(existing, base)).toBe(true)
    expect(findBookingConflict(existing.map((item) => ({ ...item, status: 'cancelled' })), base)).toBe(false)
  })
  it('allows back-to-back stays', () => {
    const existing: Reservation[] = [{ id: 'r1', property_id: 'p1', source: 'direct', guest_name: 'Existing', check_in: '2026-09-05T14:00:00.000Z', check_out: '2026-09-10T10:00:00.000Z', guests: 2, status: 'confirmed' }]
    expect(findBookingConflict(existing, base)).toBe(false)
  })
  it('checks selected arrival and departure dates immediately with back-to-back boundaries', () => {
    const existing: Reservation[] = [{ id: 'r1', property_id: 'p1', source: 'direct', guest_name: 'Existing', check_in: '2026-09-12T14:00:00.000Z', check_out: '2026-09-18T10:00:00.000Z', guests: 2, status: 'confirmed' }]
    expect(isBookingDateUnavailable(existing, 'p1', '2026-09-14', 'checkIn')).toBe(true)
    expect(isBookingDateUnavailable(existing, 'p1', '2026-09-14', 'checkOut')).toBe(true)
    expect(isBookingDateUnavailable(existing, 'p1', '2026-09-18', 'checkIn')).toBe(false)
    expect(isBookingDateUnavailable(existing, 'p1', '2026-09-12', 'checkOut')).toBe(false)
  })
})
