import { supabase } from './supabase'
import type { CleaningStatus } from './cleaning-repository'

export type CleaningWork = {
  task_id: string
  property_name: string
  address: string | null
  city: string | null
  start_time: string
  end_time: string
  status: CleaningStatus
}

export async function getCleaningWork(start: string, end: string): Promise<CleaningWork[]> {
  const { data, error } = await supabase.rpc('get_my_cleaning_work', { p_start: start, p_end: end })
  if (error) throw error
  return data ?? []
}

export async function updateCleaningStatus(taskId: string, status: CleaningStatus): Promise<void> {
  const { error } = await supabase.rpc('update_my_cleaning_status', { p_task_id: taskId, p_status: status })
  if (error) throw error
}
