export type IcalEvent = { uid: string; start: string; end: string; title: string; kind: 'reservation' | 'block' | 'unknown'; cancelled: boolean }

function date(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?$/.exec(value)
  if (!match) throw new Error('Unsupported calendar date')
  const day = `${match[1]}-${match[2]}-${match[3]}`
  if (new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Invalid calendar date')
  return day
}

// Deliberately fail the whole snapshot on unsupported recurrence or invalid events.
// A partial parse must never cancel previously imported bookings.
export function parseIcal(text: string): IcalEvent[] {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n[ \t]|\n[ \t]/g, '').split(/\r?\n/).map(s => s.trim())
  if (lines[0] !== 'BEGIN:VCALENDAR' || lines.filter(s => s === 'END:VCALENDAR').length !== 1 || lines.filter(s => s === 'BEGIN:VCALENDAR').length !== 1 || lines.filter(Boolean).at(-1) !== 'END:VCALENDAR') throw new Error('Not a complete iCal calendar')
  const events = new Map<string, IcalEvent>()
  let fields: Record<string, string> | null = null
  let nested = 0
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (fields) throw new Error('Invalid event'); fields = {}; continue }
    if (!fields) continue
    if (line.startsWith('BEGIN:')) { nested++; continue }
    if (line.startsWith('END:') && nested) { nested--; continue }
    if (nested) continue
    if (line === 'END:VEVENT') {
      if (!fields.UID || !fields.DTSTART || !fields.DTEND) throw new Error('Event is missing UID or dates')
      const start = date(fields.DTSTART), end = date(fields.DTEND)
      if (end <= start) throw new Error('Checkout must follow arrival')
      const title = (fields.SUMMARY || 'External availability').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').slice(0, 200)
      const kind = /not available|unavailable|blocked|closed|not bookable/i.test(title) ? 'block' : /\breserved\b|\breservation\b/i.test(title) ? 'reservation' : 'unknown'
      const event: IcalEvent = { uid: fields.UID, start, end, title, kind, cancelled: fields.STATUS === 'CANCELLED' }
      if (fields.UID.length > 1024) throw new Error('Event UID is too long')
      if (events.has(event.uid) && JSON.stringify(events.get(event.uid)) !== JSON.stringify(event)) throw new Error('Conflicting duplicate UID')
      events.set(event.uid, event); fields = null; continue
    }
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const name = line.slice(0, colon).split(';')[0].toUpperCase()
    if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID', 'DURATION'].includes(name)) throw new Error('Recurring calendars are not supported yet')
    fields[name] = line.slice(colon + 1)
  }
  if (fields) throw new Error('Incomplete calendar event')
  return [...events.values()]
}

// These feeds contain access tokens. Never send them to arbitrary hosts or follow redirects.
export function validateFeedUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('A secure calendar URL is required')
  const airbnb = ['www.airbnb.com', 'airbnb.com'].includes(url.hostname) && /^\/calendar\/ical\/[\w.-]+\.ics$/.test(url.pathname)
  const booking = url.hostname === 'ical.booking.com' && url.pathname === '/v1/export'
  if (!airbnb && !booking) throw new Error('Currently supported: Airbnb and Booking.com calendar URLs')
  return url
}
