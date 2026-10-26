import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agency-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const authHeader = req.headers.get('Authorization')
  const agencyId = req.headers.get('x-agency-id')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)
  if (!agencyId) return json({ error: 'Missing agency context' }, 400)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader, 'x-agency-id': agencyId } } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401)
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: caller } = await service.from('agency_memberships').select('role,is_active').eq('agency_id', agencyId).eq('user_id', authData.user.id).maybeSingle()
  if (!caller?.is_active || !['owner', 'admin'].includes(caller.role)) return json({ error: 'Agency administration access required' }, 403)

  const body = await req.json()
  const allowedRoles = caller.role === 'owner' ? ['owner', 'admin', 'manager', 'viewer', 'cleaning'] : ['admin', 'manager', 'viewer', 'cleaning']
  async function validateProperties(propertyIds: string[]) {
    if (!propertyIds.length) return true
    const { count } = await service.from('properties').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).in('id', propertyIds)
    return count === new Set(propertyIds).size
  }
  async function assignUser(userId: string, email: string, fullName: string, role: string, propertyIds: string[]) {
    const { error: profileError } = await service.from('profiles').upsert({ id: userId, email, full_name: fullName, role: role === 'owner' ? 'admin' : role, is_active: true })
    if (profileError) throw profileError
    const { error: membershipError } = await service.from('agency_memberships').upsert({ agency_id: agencyId, user_id: userId, role, is_active: true })
    if (membershipError) throw membershipError
    const { data: agencyProperties } = await service.from('properties').select('id').eq('agency_id', agencyId)
    const ids = (agencyProperties ?? []).map((row: { id: string }) => row.id)
    if (ids.length) await service.from('property_access').delete().eq('user_id', userId).in('property_id', ids)
    if (propertyIds.length) {
      const { error } = await service.from('property_access').upsert(propertyIds.map((property_id) => ({ user_id: userId, property_id })), { onConflict: 'user_id,property_id' })
      if (error) throw error
    }
  }

  if (body.action === 'create' || body.action === 'invite') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const fullName = String(body.full_name ?? '').trim()
    const role = String(body.role ?? 'viewer')
    const propertyIds = Array.isArray(body.property_ids) ? body.property_ids.filter((id: unknown) => typeof id === 'string') : []
    if (!email || !fullName) return json({ error: 'Email and name are required' }, 400)
    if (!allowedRoles.includes(role)) return json({ error: 'Invalid role' }, 400)
    if (!(await validateProperties(propertyIds))) return json({ error: 'Invalid property access' }, 400)
    if (body.action === 'create') {
      const temporaryPassword = `PmStay-${crypto.randomUUID().slice(0, 12)}!`
      const { data: created, error } = await service.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true, user_metadata: { full_name: fullName } })
      if (error || !created.user) return json({ error: error?.message ?? 'Unable to create user' }, 400)
      try { await assignUser(created.user.id, email, fullName, role, propertyIds) }
      catch (assignError) { await service.auth.admin.deleteUser(created.user.id); return json({ error: assignError instanceof Error ? assignError.message : 'Unable to assign user' }, 500) }
      return json({ id: created.user.id, email, temporary_password: temporaryPassword })
    }
    const { data: invited, error } = await service.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } })
    if (error || !invited.user) return json({ error: error?.message ?? 'Unable to invite user' }, 400)
    try { await assignUser(invited.user.id, email, fullName, role, propertyIds) }
    catch (assignError) { return json({ error: assignError instanceof Error ? assignError.message : 'Unable to assign invitation' }, 500) }
    return json({ id: invited.user.id, email })
  }

  if (body.action === 'delete') {
    const userId = String(body.user_id ?? '')
    if (!userId) return json({ error: 'User id is required' }, 400)
    if (userId === authData.user.id) return json({ error: 'Use account deletion for your own account' }, 400)
    const { data: target } = await service.from('agency_memberships').select('role').eq('agency_id', agencyId).eq('user_id', userId).maybeSingle()
    if (!target) return json({ error: 'Agency member unavailable' }, 404)
    if (target.role === 'owner' && caller.role !== 'owner') return json({ error: 'Only an owner can remove another owner' }, 403)
    if (target.role === 'owner') {
      const { count } = await service.from('agency_memberships').select('user_id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('role', 'owner').eq('is_active', true)
      if ((count ?? 0) <= 1) return json({ error: 'Keep at least one active owner' }, 400)
    }
    const { data: agencyProperties } = await service.from('properties').select('id').eq('agency_id', agencyId)
    const ids = (agencyProperties ?? []).map((row: { id: string }) => row.id)
    if (ids.length) await service.from('property_access').delete().eq('user_id', userId).in('property_id', ids)
    await service.from('agency_memberships').delete().eq('agency_id', agencyId).eq('user_id', userId)
    const { count: remaining } = await service.from('agency_memberships').select('agency_id', { count: 'exact', head: true }).eq('user_id', userId)
    if ((remaining ?? 0) === 0) {
      await service.from('profiles').delete().eq('id', userId)
      const { error } = await service.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 400)
    }
    return json({ id: userId })
  }

  if (body.action === 'delete-self') {
    const { data: owned } = await service.from('agency_memberships').select('agency_id').eq('user_id', authData.user.id).eq('role', 'owner').eq('is_active', true)
    for (const membership of owned ?? []) {
      const { count } = await service.from('agency_memberships').select('user_id', { count: 'exact', head: true }).eq('agency_id', membership.agency_id).eq('role', 'owner').eq('is_active', true)
      if ((count ?? 0) <= 1) return json({ error: 'Transfer ownership before deleting this account.' }, 400)
    }
    await service.from('property_access').delete().eq('user_id', authData.user.id)
    await service.from('agency_memberships').delete().eq('user_id', authData.user.id)
    await service.from('profiles').delete().eq('id', authData.user.id)
    const { error } = await service.auth.admin.deleteUser(authData.user.id)
    if (error) return json({ error: error.message }, 400)
    return json({ id: authData.user.id })
  }
  return json({ error: 'Unknown action' }, 400)
})
