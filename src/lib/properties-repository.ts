import { supabase } from './supabase'
import { getActiveAgencyId } from './agency-session'

export type Property = {
  id: string
  name: string
  address?: string | null
  country?: string | null
  color?: string | null
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  capacity: number
  rooms: number
  area_m2: number | null
  image_url?: string | null
  notes?: string | null
  check_in_time: string
  check_out_time: string
  parking?: boolean
  wifi: boolean
  keybox?: boolean
  air_conditioning: boolean
  cleaning_duration_minutes: number
  nightly_rate?: number | null
  currency?: string
  is_active: boolean
}

export type CreatePropertyInput = Omit<Property, 'id'>

export async function getProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getAllProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createProperty(property: CreatePropertyInput, propertyId?: string): Promise<Property> {
  // Send the active agency explicitly. The database has a default for this
  // column, but an explicit value keeps inserts reliable when the request
  // header is unavailable or a session has more than one agency.
  const agencyId = getActiveAgencyId()
  const payload = { ...property, ...(agencyId ? { agency_id: agencyId } : {}), ...(propertyId ? { id: propertyId } : {}) }
  const { data, error } = await supabase.from('properties').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateProperty(id: string, changes: Partial<CreatePropertyInput>): Promise<Property> {
  const { data, error } = await supabase.from('properties').update(changes).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deactivateProperty(id: string): Promise<void> {
  const { error } = await supabase.from('properties').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

export async function deleteProperty(id: string): Promise<void> {
  const { data, error } = await supabase.from('properties').delete().eq('id', id).select('id').single()
  if (error) throw error
  if (!data) throw new Error('Property was not deleted.')
}
