import { supabase } from './supabase'
import type { Reservation } from './reservations-repository'

export type SyncedReservationInput = {
  external_id: string
  property_id: string
  source: 'airbnb_ical' | 'booking_ical' | 'other_ical'
  guest_name: string
  check_in: string
  check_out: string
  guests: number
  status?: 'tentative' | 'confirmed' | 'cancelled'
  notes?: string | null
}

export type ExternalCalendarRecord = {
  id: string
  property_id: string
  source: 'airbnb_ical' | 'booking_ical' | 'other_ical'
  feed_url: string
  is_active: boolean
  last_synced_at: string | null
  sync_error?: string | null
  event_count?: number
  sync_status: 'idle' | 'syncing' | 'success' | 'error'
}

export async function getExternalCalendars(
  propertyId: string,
): Promise<ExternalCalendarRecord[]> {
  const { data, error } = await supabase
    .from('external_calendars')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at')

  if (error) throw error
  return data ?? []
}

export async function createExternalCalendar(
  calendar: Omit<ExternalCalendarRecord, 'id' | 'created_at' | 'updated_at'>,
): Promise<ExternalCalendarRecord> {
  const { data, error } = await supabase
    .from('external_calendars')
    .insert(calendar)
    .select()
    .single()

  if (error) throw error
  await synchronizeCalendar(data.id)
  return data
}


export async function updateExternalCalendar(
  id: string,
  changes: Partial<Pick<ExternalCalendarRecord, 'source' | 'feed_url' | 'is_active'>>,
): Promise<ExternalCalendarRecord> {
  const { data, error } = await supabase
    .from('external_calendars')
    .update(changes)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  await synchronizeCalendar(id)
  return data
}

async function synchronizeCalendar(id: string): Promise<void> {
  // Saving a link and fetching a provider are separate outcomes. Status UI reports sync errors.
  try {
    const { error } = await supabase.functions.invoke('ical-sync', { body: { calendar_id: id, force: true } })
    if (error) window.dispatchEvent(new Event('ical-sync-error'))
  } catch { window.dispatchEvent(new Event('ical-sync-error')) }
  window.dispatchEvent(new Event('booking-data-changed'))
}

export async function deleteExternalCalendar(id: string): Promise<void> {
  const { error } = await supabase
    .from('external_calendars')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function upsertSyncedReservation(
  calendarId: string,
  reservation: SyncedReservationInput,
): Promise<Reservation> {
  const payload = {
    external_calendar_id: calendarId,
    external_id: reservation.external_id,
    property_id: reservation.property_id,
    source: reservation.source,
    guest_name: reservation.guest_name,
    check_in: reservation.check_in,
    check_out: reservation.check_out,
    guests: reservation.guests,
    status: reservation.status ?? 'confirmed',
    notes: reservation.notes ?? null,
  }

  const { data, error } = await supabase
    .from('reservations')
    .upsert(payload, {
      onConflict: 'external_calendar_id,external_id',
    })
    .select()
    .single()

  if (error) throw error
  return data
}
