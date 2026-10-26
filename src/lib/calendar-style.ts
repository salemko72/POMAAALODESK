export const reservationSourceColors = {
  airbnb: '#E35D6A',
  booking: '#3B82F6',
  direct: '#7C5CFC',
  agency: '#0F9D7A',
} as const

export function normalizeSource(source: string): keyof typeof reservationSourceColors {
  if (source === 'airbnb' || source === 'airbnb_ical') return 'airbnb'
  if (source === 'booking' || source === 'booking_ical') return 'booking'
  if (source === 'agency') return 'agency'
  return 'direct'
}

export function getReservationBarColor(source: string): string {
  return reservationSourceColors[normalizeSource(source)]
}

export function getReservationSourceBadge(source: string): { label: string; name: string } {
  const normalized = normalizeSource(source)
  if (normalized === 'airbnb') return { label: 'A', name: 'Airbnb' }
  if (normalized === 'booking') return { label: 'B', name: 'Booking.com' }
  if (normalized === 'agency') return { label: 'A', name: 'Agency' }
  return { label: 'S', name: 'Direct' }
}

export function getReadableTextColor(hex: string): string {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.68 ? '#18304f' : '#ffffff'
}
