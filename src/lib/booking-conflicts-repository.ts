import { supabase } from './supabase'
import {
  findReservationConflicts,
  type ConflictReservation,
} from './booking-conflicts'

export type BookingConflictStatus = 'open' | 'resolved'

export type BookingConflict = {
  id: string
  property_id: string
  reservation_a_id: string
  reservation_b_id: string
  conflict_type: string
  status: BookingConflictStatus
  detected_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export async function getOpenConflicts(
  propertyId?: string,
): Promise<BookingConflict[]> {
  let query = supabase
    .from('booking_conflicts')
    .select('*')
    .eq('status', 'open')
    .order('detected_at', { ascending: false })

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function syncOpenConflicts(
  propertyId: string,
  reservations: ConflictReservation[],
): Promise<BookingConflict[]> {
  const current = findReservationConflicts(
    reservations.filter((reservation) => reservation.property_id === propertyId),
  )

  const existingResponse = await supabase
    .from('booking_conflicts')
    .select('*')
    .eq('property_id', propertyId)

  if (existingResponse.error) throw existingResponse.error

  const existing = (existingResponse.data ?? []) as BookingConflict[]
  const currentKeys = new Set(
    current.map(
      (pair) =>
        `${pair.propertyId}:${pair.reservationAId}:${pair.reservationBId}`,
    ),
  )

  for (const pair of current) {
    const existingPair = existing.find(
      (conflict) =>
        conflict.reservation_a_id === pair.reservationAId &&
        conflict.reservation_b_id === pair.reservationBId,
    )

    if (existingPair) {
      if (existingPair.status === 'resolved') {
        const reopened = await supabase
          .from('booking_conflicts')
          .update({
            status: 'open',
            resolved_at: null,
            resolved_by: null,
          })
          .eq('id', existingPair.id)

        if (reopened.error) throw reopened.error
      }
      continue
    }

    const created = await supabase
      .from('booking_conflicts')
      .insert({
        property_id: pair.propertyId,
        reservation_a_id: pair.reservationAId,
        reservation_b_id: pair.reservationBId,
        conflict_type: 'overbook',
        status: 'open',
      })
      .select()
      .single()

    if (created.error) throw created.error
  }

  for (const conflict of existing) {
    const key = `${conflict.property_id}:${conflict.reservation_a_id}:${conflict.reservation_b_id}`
    if (conflict.status === 'open' && !currentKeys.has(key)) {
      const resolved = await supabase
        .from('booking_conflicts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', conflict.id)

      if (resolved.error) throw resolved.error
    }
  }

  return getOpenConflicts(propertyId)
}

export async function resolveConflict(
  conflictId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('booking_conflicts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', conflictId)

  if (error) throw error
}
