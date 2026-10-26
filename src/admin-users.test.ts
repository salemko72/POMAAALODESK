import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('./lib/supabase', () => ({ supabase: { functions: { invoke } } }))

import { deleteUser, inviteUser } from './lib/admin-users'

beforeEach(() => vi.clearAllMocks())

describe('admin user operations', () => {
  it('invites a new user with role and property access', async () => {
    invoke.mockResolvedValue({ data: { id: 'u2', email: 'kate@example.com' }, error: null })
    await inviteUser({ email: 'kate@example.com', full_name: 'Kate', role: 'manager', property_ids: ['p1', 'p2'] })
    expect(invoke).toHaveBeenCalledWith('admin-user', { body: { action: 'invite', email: 'kate@example.com', full_name: 'Kate', role: 'manager', property_ids: ['p1', 'p2'] } })
  })

  it('deletes a user through the admin function', async () => {
    invoke.mockResolvedValue({ data: { id: 'u2' }, error: null })
    await deleteUser('u2')
    expect(invoke).toHaveBeenCalledWith('admin-user', { body: { action: 'delete', user_id: 'u2' } })
  })
})
