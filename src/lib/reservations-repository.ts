import { supabase } from './supabase'

export type ReservationStatus = 'tentative' | 'confirmed' | 'cancelled'
export type ReservationSource = 'airbnb' | 'booking' | 'direct' | 'agency'

export type Reservation = {
  created_by?: string | null
  created_by_name?: string | null
  created_actor_kind?: 'user' | 'ical' | 'system' | null
  last_modified_by?: string | null
  last_modified_by_name?: string | null
  last_modified_actor_kind?: 'user' | 'ical' | 'system' | null
  last_modified_at?: string | null
  ical_kind?: 'reservation' | 'block' | 'unknown' | null
  external_calendar_id?: string | null
  guest_id?: string | null
  adults?: number
  children?: number
  arrival_time?: string | null
  special_request?: string | null
  nightly_rate?: number | null
  total_price?: number | null
  id: string
  property_id: string
  source: string
  guest_name: string
  check_in: string
  check_out: string
  guests: number
  status: string
  external_id?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type CreateReservationInput = {
  overbook_override_reason?: string
  guest_id?: string | null
  adults?: number
  children?: number
  arrival_time?: string | null
  special_request?: string | null
  nightly_rate?: number | null
  property_id: string
  source: ReservationSource
  guest_name: string
  check_in: string
  check_out: string
  guests: number
  status: ReservationStatus
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type UpdateReservationInput = {
  guest_id?: string | null
  adults?: number
  children?: number
  arrival_time?: string | null
  special_request?: string | null
  nightly_rate?: number | null
  property_id: string
  guest_name: string
  check_in: string
  check_out: string
  guests: number
  source: ReservationSource
  status: ReservationStatus
  notes?: string | null
}

export async function getReservation(id: string): Promise<Reservation> {
  const { data, error } = await supabase.from('reservations').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function updateReservation(id: string, changes: UpdateReservationInput, overrideReason?: string): Promise<Reservation> {
  const { data, error } = overrideReason ? await supabase.rpc('save_reservation_override',{p_data:changes,p_reason:overrideReason,p_id:id}) : await supabase.from('reservations').update(changes).eq('id', id).select().single()
  if (error) throw error
  window.dispatchEvent(new Event('booking-data-changed'))
  return data
}

export async function getReservations(start: string, end: string): Promise<Reservation[]> {
  const { data, error } = await supabase.from('reservations').select('*')
    .gte('check_out', start).lt('check_in', end).order('check_in')
  if (error) throw error
  return data ?? []
}

export async function createReservation(reservation: CreateReservationInput): Promise<Reservation> {
  const { overbook_override_reason: reason, ...payload } = reservation
  const { data, error } = reason ? await supabase.rpc('save_reservation_override',{p_data:payload,p_reason:reason,p_id:null}) : await supabase.from('reservations').insert(payload).select().single()
  if (error) throw error
  window.dispatchEvent(new Event('booking-data-changed'))
  return data
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase.from('reservations').delete().eq('id', id)
  if (error) throw error
  window.dispatchEvent(new Event('booking-data-changed'))
}

export async function updateReservationDates(id: string, checkIn: string, checkOut: string, overrideReason?: string): Promise<Reservation> {
  const { data, error } = overrideReason ? await supabase.rpc('save_reservation_override',{p_data:{check_in:checkIn,check_out:checkOut},p_reason:overrideReason,p_id:id}) : await supabase.from('reservations').update({ check_in: checkIn, check_out: checkOut }).eq('id', id).select().single()
  if (error) throw error
  window.dispatchEvent(new Event('booking-data-changed'))
  return data
}
