export type ConflictReservation = {
  id: string
  property_id: string
  check_in: string
  check_out: string
  status: string
  source: string
}

export type ReservationConflictPair = {
  reservationAId: string
  reservationBId: string
  propertyId: string
}

function isActiveReservation(reservation: ConflictReservation): boolean {
  return reservation.status !== 'cancelled'
}

function overlaps(a: ConflictReservation, b: ConflictReservation): boolean {
  const aStart = a.check_in.slice(0,10)
  const aEnd = a.check_out.slice(0,10)
  const bStart = b.check_in.slice(0,10)
  const bEnd = b.check_out.slice(0,10)

  return aStart < bEnd && aEnd > bStart
}

function normalizePair(
  first: ConflictReservation,
  second: ConflictReservation,
): ReservationConflictPair {
  return first.id < second.id
    ? {
        reservationAId: first.id,
        reservationBId: second.id,
        propertyId: first.property_id,
      }
    : {
        reservationAId: second.id,
        reservationBId: first.id,
        propertyId: first.property_id,
      }
}

export function findReservationConflicts(
  reservations: ConflictReservation[],
): ReservationConflictPair[] {
  const conflicts: ReservationConflictPair[] = []
  const active = reservations.filter(isActiveReservation)

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const first = active[i]
      const second = active[j]

      if (first.property_id !== second.property_id) continue
      if (!overlaps(first, second)) continue

      conflicts.push(normalizePair(first, second))
    }
  }

  return conflicts.sort((a, b) =>
    `${a.propertyId}:${a.reservationAId}:${a.reservationBId}`.localeCompare(
      `${b.propertyId}:${b.reservationAId}:${b.reservationBId}`,
    ),
  )
}

export function hasReservationConflictPair(
  reservations: ConflictReservation[],
  reservationId: string,
): boolean {
  return findReservationConflicts(reservations).some(
    (conflict) =>
      conflict.reservationAId === reservationId ||
      conflict.reservationBId === reservationId,
  )
}
