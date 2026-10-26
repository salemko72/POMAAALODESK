export type ExternalCalendarSource = 'airbnb_ical' | 'booking_ical' | 'other_ical'
export type ExternalCalendarSyncStatus = 'idle' | 'syncing' | 'success' | 'error'
export type BookingConflictType = 'overlap'
export type BookingConflictStatus = 'open' | 'resolved'

export type ExternalCalendar = {
  id: string
  property_id: string
  source: ExternalCalendarSource
  feed_url: string
  is_active: boolean
  last_synced_at: string | null
  sync_status: ExternalCalendarSyncStatus
  created_at?: string
  updated_at?: string
}

export type BookingConflict = {
  id: string
  property_id: string
  reservation_a_id: string
  reservation_b_id: string
  conflict_type: BookingConflictType
  status: BookingConflictStatus
  detected_at: string
  resolved_at: string | null
  resolved_by: string | null
  created_at?: string
  updated_at?: string
}
