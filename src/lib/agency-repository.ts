import { supabase } from './supabase'
import type { UserRole } from './permissions'
import type { PendingAgency } from './agency-session'

export type AgencyMembership = {
  id: string; name: string; slug: string; logo_url: string | null; country: string
  language: 'hr' | 'en'; currency: string; timezone: string; role: UserRole; is_active: boolean
}

export async function getMyAgencies(): Promise<AgencyMembership[]> {
  const { data, error } = await supabase.rpc('get_my_agencies')
  if (error) throw error
  return (data ?? []) as AgencyMembership[]
}

export async function createAgency(input: PendingAgency): Promise<AgencyMembership> {
  const { data, error } = await supabase.rpc('create_agency', {
    p_name: input.name, p_logo_url: input.logo_url, p_country: input.country,
    p_language: input.language, p_currency: input.currency, p_timezone: input.timezone,
  })
  if (error) throw error
  return { ...(data as Omit<AgencyMembership, 'role' | 'is_active'>), role: 'owner', is_active: true }
}

export async function updateAgency(id: string, changes: Partial<Pick<AgencyMembership, 'name' | 'logo_url' | 'country' | 'language' | 'currency' | 'timezone'>>): Promise<void> {
  const { error } = await supabase.from('agencies').update(changes).eq('id', id)
  if (error) throw error
}
