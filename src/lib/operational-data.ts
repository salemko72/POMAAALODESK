export type OperationalReservation = {
  id: string
  property_id: string
  guest_name: string
  check_in: string
  check_out: string
  guests: number
  source: string
  status: string
}

export type OperationalCleaning = {
  id?: string
  reservation_id: string
  property_id: string
  start_time: string
  end_time: string
  status: 'pending' | 'in_progress' | 'done'
  is_manually_overridden: boolean
}

export type DailyOperationalSummary = {
  checkIns: OperationalReservation[]
  checkOuts: OperationalReservation[]
  cleanings: OperationalCleaning[]
}

function isSameDate(value: string, date: string): boolean {
  return value.slice(0, 10) === date
}

export function buildDailyOperationalSummary(
  reservations: OperationalReservation[],
  cleanings: OperationalCleaning[],
  date: string,
): DailyOperationalSummary {
  const activeReservations = reservations.filter(
    (reservation) => reservation.status !== 'cancelled',
  )

  return {
    checkIns: activeReservations.filter((reservation) =>
      isSameDate(reservation.check_in, date),
    ),

    checkOuts: activeReservations.filter((reservation) =>
      isSameDate(reservation.check_out, date),
    ),

    cleanings: cleanings.filter((cleaning) =>
      isSameDate(cleaning.start_time, date),
    ),
  }
}