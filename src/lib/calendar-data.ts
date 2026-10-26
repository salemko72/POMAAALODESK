import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'

export type CalendarReservation = {
  id: string
  property_id: string
  check_in: string
  check_out: string
  status: string
}

export type CalendarReservationPosition = {
  id: string
  lane: number
  start: number
  end: number
  span: number
}

export function buildCalendarDays(start: string, end: string): string[] {
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  const days: string[] = []

  for (
    let current = startDate;
    current <= endDate;
    current = addDays(current, 1)
  ) {
    days.push(
      [
        current.getFullYear(),
        String(current.getMonth() + 1).padStart(2, '0'),
        String(current.getDate()).padStart(2, '0'),
      ].join('-'),
    )
  }

  return days
}

export function getReservationPosition(
  reservation: CalendarReservation,
  start: string,
  end: string,
): { start: number; end: number; span: number } | null {
  if (reservation.status === 'cancelled') {
    return null
  }

  const rangeStart = parseISO(start)
  const rangeEnd = parseISO(end)
  const checkIn = parseISO(reservation.check_in)
  const checkOut = parseISO(reservation.check_out)

  // A stay starts and ends around the middle of its arrival/departure day.
  // This lets a checkout and the next check-in share the same date column,
  // matching the usual accommodation turnover model.
  const visibleDayCount = differenceInCalendarDays(rangeEnd, rangeStart) + 1
  const rawStart = differenceInCalendarDays(checkIn, rangeStart) + 0.5
  const rawEnd = differenceInCalendarDays(checkOut, rangeStart) + 0.5
  const startIndex = Math.max(0, rawStart)
  const endIndex = Math.min(visibleDayCount, rawEnd)

  if (startIndex >= endIndex) {
    return null
  }
  const span = endIndex - startIndex

  return {
    start: startIndex,
    end: endIndex,
    span,
  }
}

export function layoutReservations(
  reservations: CalendarReservation[],
  start: string,
  end: string,
): CalendarReservationPosition[] {
  const lanes: number[][] = []
  const result: CalendarReservationPosition[] = []

  const sorted = reservations
    .filter((reservation) => reservation.status !== 'cancelled')
    .map((reservation) => ({
      reservation,
      position: getReservationPosition(reservation, start, end),
    }))
    .filter(
      (
        item,
      ): item is {
        reservation: CalendarReservation
        position: { start: number; end: number; span: number }
      } => item.position !== null,
    )
    .sort((a, b) => {
      if (a.position.start !== b.position.start) {
        return a.position.start - b.position.start
      }

      return b.position.span - a.position.span
    })

  for (const { reservation, position } of sorted) {
    let lane = 0

    while (lanes[lane]?.some((endPosition) => endPosition > position.start)) {
      lane += 1
    }

    if (!lanes[lane]) {
      lanes[lane] = []
    }

    lanes[lane].push(position.end)

    result.push({
      id: reservation.id,
      lane,
      ...position,
    })
  }

  return result.sort((a, b) => a.start - b.start || a.lane - b.lane)
}
