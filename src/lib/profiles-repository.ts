import { supabase } from './supabase'
import type { UserProfile, UserRole } from './permissions'

export async function getProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase.rpc('get_agency_members')
  if (error) throw error
  return data ?? []
}


export async function getProfile(id: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,is_active')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateProfile(
  id: string,
  changes: Partial<Pick<UserProfile, 'full_name' | 'role' | 'is_active'>>,
): Promise<UserProfile> {
  if (changes.role !== undefined || changes.is_active !== undefined) {
    const current = await getProfile(id)
    const { error } = await supabase.rpc('update_agency_member', {
      p_user_id: id,
      p_role: changes.role ?? current.role,
      p_is_active: changes.is_active ?? current.is_active,
    })
    if (error) throw error
  }
  if (changes.full_name !== undefined) {
    const { error } = await supabase.from('profiles').update({ full_name: changes.full_name }).eq('id', id)
    if (error) throw error
  }
  const updated = await getProfile(id)
  return { ...updated, role: changes.role ?? updated.role, is_active: changes.is_active ?? updated.is_active }
}

export async function getPropertyAccess(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('property_access')
    .select('property_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => row.property_id)
}

export async function replacePropertyAccess(userId: string, propertyIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('property_access')
    .delete()
    .eq('user_id', userId)
  if (deleteError) throw deleteError

  if (!propertyIds.length) return

  const { error: insertError } = await supabase
    .from('property_access')
    .insert(propertyIds.map((property_id) => ({ user_id: userId, property_id })))
  if (insertError) throw insertError
}

export async function setProfileRole(id: string, role: UserRole): Promise<UserProfile> {
  return updateProfile(id, { role })
}
