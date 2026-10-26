import { supabase } from './supabase'

export type OperationalData = {
  reservations: Array<{
    id: string
    property_id: string
    guest_name: string
    check_in: string
    check_out: string
    guests: number
    source: string
    status: string
  }>
  cleanings: Array<{
    id: string
    reservation_id: string
    property_id: string
    start_time: string
    end_time: string
    status: 'pending' | 'in_progress' | 'done'
    is_manually_overridden: boolean
  }>
}

export async function getDailyOperationalData(
  start: string,
  end: string,
): Promise<OperationalData> {
  const [reservationsResult, cleaningsResult] = await Promise.all([
    supabase
      .from('reservations')
      .select('*')
      .or('ical_kind.is.null,ical_kind.eq.reservation')
      .gte('check_out', start)
      .lt('check_in', end)
      .order('check_in'),
    supabase
      .from('cleaning_tasks')
      .select('*')
      .gte('start_time', start)
      .lt('start_time', end)
      .order('start_time'),
  ])

  if (reservationsResult.error) {
    throw reservationsResult.error
  }

  if (cleaningsResult.error) {
    throw cleaningsResult.error
  }

  return {
    reservations: reservationsResult.data ?? [],
    cleanings: cleaningsResult.data ?? [],
  }
}
