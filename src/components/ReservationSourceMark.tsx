import { getReservationSourceBadge, normalizeSource } from '../lib/calendar-style'

/** Shared mark inside the existing source circles, including iCal imports. */
export function ReservationSourceMark({ source }: { source: string }) {
  const normalized = normalizeSource(source)
  if (normalized === 'airbnb' || normalized === 'booking') {
    return <img src={`/${normalized}-logo.svg`} alt="" aria-hidden="true" draggable={false} style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
  }
  return <>{getReservationSourceBadge(source).label}</>
}
