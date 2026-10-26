import { getActiveAgencyId } from './agency-session'
import type { StoredPropertyImage } from './property-image-storage'
import { supabase } from './supabase'

export type PropertyImageRecord = {
  id: string
  agency_id: string
  property_id: string
  storage_provider: 'r2'
  storage_key: string
  width: number
  height: number
  file_size: number
  format: 'webp' | 'jpeg'
  original_width: number | null
  original_height: number | null
  original_file_size: number | null
  sort_order: number
  is_cover: boolean
}

export async function getPropertyImageRecord(propertyId: string): Promise<PropertyImageRecord | null> {
  const { data, error } = await supabase
    .from('property_images')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function savePropertyImageRecord(propertyId: string, image: StoredPropertyImage): Promise<PropertyImageRecord | null> {
  if (image.provider !== 'r2' || !image.storageKey) return null
  const agencyId = getActiveAgencyId()
  if (!agencyId) throw new Error('Choose an agency before saving its image.')
  const { data, error } = await supabase
    .from('property_images')
    .upsert({
      agency_id: agencyId,
      property_id: propertyId,
      storage_provider: 'r2',
      storage_key: image.storageKey,
      width: image.width,
      height: image.height,
      file_size: image.bytes,
      format: image.format,
      original_width: image.originalWidth,
      original_height: image.originalHeight,
      original_file_size: image.originalBytes,
      sort_order: 0,
      is_cover: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'property_id' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deletePropertyImageRecord(propertyId: string): Promise<void> {
  const { error } = await supabase.from('property_images').delete().eq('property_id', propertyId)
  if (error) throw error
}
