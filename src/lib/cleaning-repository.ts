import { supabase } from './supabase'

export type CleaningStatus = 'pending' | 'in_progress' | 'done'

export type CleaningTask = {
  id?: string
  reservation_id: string
  property_id: string
  start_time: string
  end_time: string
  status: CleaningStatus
  is_manually_overridden: boolean
}

type DefaultCleaningTaskInput = {
  reservationId: string
  propertyId: string
  checkout: string
  cleaningDurationMinutes: number
}

export function buildDefaultCleaningTask(
  input: DefaultCleaningTaskInput,
): Omit<CleaningTask, 'id'> {
  const start = new Date(input.checkout)
  const end = new Date(
    start.getTime() + input.cleaningDurationMinutes * 60 * 1000,
  )

  return {
    reservation_id: input.reservationId,
    property_id: input.propertyId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: 'pending',
    is_manually_overridden: false,
  }
}

export async function createCleaningTask(
  task: Omit<CleaningTask, 'id'>,
): Promise<CleaningTask> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .insert(task)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}
