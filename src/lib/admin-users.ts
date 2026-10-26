import { supabase } from './supabase'
import type { UserRole } from './permissions'

export type CreateUserInput = {
  email: string
  full_name: string
  role: UserRole
  property_ids: string[]
}

export async function createUser(input: CreateUserInput) {
  const { data, error } = await supabase.functions.invoke('admin-user', {
    body: { action: 'create', ...input },
  })
  if (error) throw error
  return data as { id: string; email: string; temporary_password: string }
}

export async function inviteUser(input: CreateUserInput) {
  const { data, error } = await supabase.functions.invoke('admin-user', {
    body: { action: 'invite', ...input },
  })
  if (error) throw error
  return data as { id: string; email: string }
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke('admin-user', {
    body: { action: 'delete', user_id: userId },
  })
  if (error) throw error
  return data as { id: string }
}

export async function deleteCurrentUser() {
  const { data, error } = await supabase.functions.invoke('admin-user', { body: { action: 'delete-self' } })
  if (error) throw error
  return data as { id: string }
}
