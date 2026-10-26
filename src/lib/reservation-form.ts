import type { Property } from './properties-repository'
import type { Reservation } from './reservations-repository'

export type BookingFormValues = {
  propertyId: string
  checkIn: string
  checkOut: string
  guestName: string
  guests: number
  source: 'direct' | 'agency'
  notes: string
}

export function validateBookingForm(values: BookingFormValues, property?: Property): string | null {
  if (!values.propertyId) return 'Select a property.'
  if (!values.checkIn) return 'Select a check-in date.'
  if (!values.checkOut) return 'Select a check-out date.'
  if (values.checkOut <= values.checkIn) return 'Check-out must be after check-in.'
  if (!values.guestName.trim()) return 'Enter the guest name.'
  if (!Number.isInteger(values.guests) || values.guests < 1) return 'Guests must be at least 1.'
  if (property && values.guests > property.capacity) return `This property allows up to ${property.capacity} guests.`
  return null
}

export function findBookingConflict(
  reservations: Reservation[],
  values: BookingFormValues,
): boolean {
  return reservations.some((reservation) => {
    if (reservation.property_id !== values.propertyId) return false
    if (reservation.status === 'cancelled') return false

    // Booking forms use date-only semantics: a checkout on the same
    // calendar day as the next check-in is a valid back-to-back stay.
    const existingStart = reservation.check_in.slice(0, 10)
    const existingEnd = reservation.check_out.slice(0, 10)

    return values.checkIn < existingEnd && values.checkOut > existingStart
  })
}

export function isBookingDateUnavailable(
  reservations: Reservation[],
  propertyId: string,
  date: string,
  boundary: 'checkIn' | 'checkOut',
): boolean {
  return reservations.some((reservation) => {
    if (reservation.property_id !== propertyId || reservation.status === 'cancelled') return false
    const existingStart = reservation.check_in.slice(0, 10)
    const existingEnd = reservation.check_out.slice(0, 10)
    return boundary === 'checkIn'
      ? date >= existingStart && date < existingEnd
      : date > existingStart && date < existingEnd
  })
}
