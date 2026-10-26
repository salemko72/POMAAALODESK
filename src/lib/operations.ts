import { supabase } from './supabase'
export { stayNights, stayTotal } from './stay-calculations'

export const blockReasons = ['Owner stay', 'Maintenance', 'Problem', 'Renovation', 'Not available', 'Other'] as const
export const taskKinds = ['Cleaning', 'Maintenance', 'Inspection', 'Linen', 'Repair', 'Delivery', 'Supplies', 'Other'] as const
export type AvailabilityBlock = { id: string; property_id: string; start_date: string; end_date: string; reason: string; notes: string }
export type Guest = { id: string; name: string; email: string; phone: string; language: string; country: string; notes: string }
export type Task = { id: string; property_id: string; kind: string; title: string; start_time: string; end_time: string; status: string }
export function overlapsBlock(block: AvailabilityBlock, property: string, start: string, end: string) {
  return block.property_id === property && start.slice(0, 10) < block.end_date && end.slice(0, 10) > block.start_date
}
export async function listBlocks(): Promise<AvailabilityBlock[]> {
  const { data, error } = await supabase.from('availability_blocks').select('*').order('start_date')
  if (error) throw error
  return data ?? []
}
export async function saveBlock(block: Omit<AvailabilityBlock, 'id'>) {
  const { error } = await supabase.from('availability_blocks').insert(block)
  if (error) throw error
}
export async function removeBlock(id: string) {
  const { error } = await supabase.from('availability_blocks').delete().eq('id', id)
  if (error) throw error
}
export async function updateBlockDates(id: string, start_date: string, end_date: string): Promise<AvailabilityBlock> {
  const { data, error } = await supabase.from('availability_blocks').update({ start_date: start_date.slice(0,10), end_date: end_date.slice(0,10) }).eq('id', id).select('*').single()
  if (error) throw error
  return data
}
export async function listGuests(): Promise<Guest[]> {
  const result: Guest[]=[]
  for(let from=0;;from+=500) {
    const { data,error }=await supabase.from('guests').select('*').order('name').order('id').range(from,from+499)
    if(error) throw error
    result.push(...(data??[]))
    if(!data || data.length<500) return result
  }
}
export async function taskProperties(): Promise<{id:string;name:string}[]> {
 const {data,error}=await supabase.rpc('get_task_properties')
 if(error) throw error
 return data??[]
}
export async function saveGuest(guest: Omit<Guest, 'id'> & { id?: string }): Promise<Guest> {
  const { data, error } = await supabase.rpc('save_guest_contact', { p_guest: guest })
  if (error) throw error
  return data
}
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.rpc('get_property_tasks')
  if (error) throw error
  return data ?? []
}
export async function saveTask(task: Omit<Task, 'id'>) {
  const { error } = await supabase.from('property_tasks').insert(task)
  if (error) throw error
}
export async function setTaskStatus(id: string, status: string) {
  const { error } = await supabase.rpc('set_property_task_status', { p_id: id, p_status: status })
  if (error) throw error
}
