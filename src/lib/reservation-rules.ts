type ReservationLike = {
  id?: string
  property_id: string
  check_in: string
  check_out: string
  status: string
}

export function hasReservationConflict(
  existing: ReservationLike[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string,
): boolean {
  const requestedStart = checkIn.slice(0,10)
  const requestedEnd = checkOut.slice(0,10)

  return existing.some((reservation) => {
    if (
      excludeReservationId &&
      reservation.id === excludeReservationId
    ) {
      return false
    }

    if (reservation.property_id !== propertyId) {
      return false
    }

    if (reservation.status === 'cancelled') {
      return false
    }

    const existingStart = reservation.check_in.slice(0,10)
    const existingEnd = reservation.check_out.slice(0,10)

    return requestedStart < existingEnd && requestedEnd > existingStart
  })
}
