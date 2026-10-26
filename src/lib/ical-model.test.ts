import { describe, expect, it } from 'vitest'
import type {
  BookingConflict,
  ExternalCalendar,
} from './ical-model'

describe('iCal model', () => {
  it('models an external calendar as property-scoped', () => {
    const calendar: ExternalCalendar = {
      id: 'calendar-1',
      property_id: 'property-1',
      source: 'airbnb_ical',
      feed_url: 'https://example.com/calendar.ics',
      is_active: true,
      last_synced_at: null,
      sync_status: 'idle',
    }

    expect(calendar.property_id).toBe('property-1')
    expect(calendar.source).toBe('airbnb_ical')
  })

  it('models an independently resolvable booking conflict', () => {
    const conflict: BookingConflict = {
      id: 'conflict-1',
      property_id: 'property-1',
      reservation_a_id: 'reservation-a',
      reservation_b_id: 'reservation-b',
      conflict_type: 'overlap',
      status: 'open',
      detected_at: '2026-09-06T12:00:00Z',
      resolved_at: null,
      resolved_by: null,
    }

    expect(conflict.status).toBe('open')
    expect(conflict.reservation_a_id).not.toBe(conflict.reservation_b_id)
  })
})
