import { describe, expect, it } from 'vitest'
import { getReadableTextColor, getReservationBarColor, getReservationSourceBadge } from './lib/calendar-style'

describe('calendar colors', () => {
  it('maps reservation sources to compact source badges', () => {
    expect(getReservationSourceBadge('airbnb')).toEqual({ label: 'A', name: 'Airbnb' })
    expect(getReservationSourceBadge('booking')).toEqual({ label: 'B', name: 'Booking.com' })
    expect(getReservationSourceBadge('agency')).toEqual({ label: 'A', name: 'Agency' })
    expect(getReservationSourceBadge('direct')).toEqual({ label: 'S', name: 'Direct' })
  })
  it('gives Airbnb and Booking.com distinct colors', () => {
    expect(getReservationBarColor('airbnb')).not.toBe(getReservationBarColor('booking'))
  })
  it('gives direct and agency distinct colors', () => {
    expect(getReservationBarColor('direct')).not.toBe(getReservationBarColor('agency'))
  })
  it('chooses readable text color', () => {
    expect(getReadableTextColor('#ffffff')).toBe('#18304f')
    expect(getReadableTextColor('#3B82F6')).toBe('#ffffff')
  })
})
