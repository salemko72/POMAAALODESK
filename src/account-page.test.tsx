import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getCurrentSession = vi.hoisted(() => vi.fn())
const getProfile = vi.hoisted(() => vi.fn())
const updateProfile = vi.hoisted(() => vi.fn())
const updatePassword = vi.hoisted(() => vi.fn())
const deleteCurrentUser = vi.hoisted(() => vi.fn())
const signOut = vi.hoisted(() => vi.fn())
vi.mock('./lib/auth-supabase', () => ({ getCurrentSession, updatePassword, signOut }))
vi.mock('./lib/profiles-repository', () => ({ getProfile, updateProfile }))
vi.mock('./lib/admin-users', () => ({ deleteCurrentUser }))

import { AdministrationPages } from './pages/AdministrationPages'

beforeEach(()=>{
  vi.clearAllMocks()
  getCurrentSession.mockResolvedValue({ user: { id:'u1', email:'salem@example.com' } })
  getProfile.mockResolvedValue({ id:'u1', email:'salem@example.com', full_name:'Salem', role:'admin', is_active:true })
  updateProfile.mockResolvedValue({ id:'u1', email:'salem@example.com', full_name:'Salem Updated', role:'admin', is_active:true })
  updatePassword.mockResolvedValue({ error:null })
  deleteCurrentUser.mockResolvedValue({ id:'u1' })
  signOut.mockResolvedValue({ error:null })
})

describe('AccountSection',()=>{
  it('allows editing the profile name', async()=>{
    render(<AdministrationPages mode="account"/>)
    fireEvent.change(await screen.findByLabelText('Account name'),{target:{value:'Salem Updated'}})
    fireEvent.click(screen.getByRole('button',{name:/save profile/i}))
    await waitFor(()=>expect(updateProfile).toHaveBeenCalledWith('u1',{full_name:'Salem Updated'}))
  })

  it('allows changing the password', async()=>{
    render(<AdministrationPages mode="account"/>)
    fireEvent.change(await screen.findByLabelText('New password'),{target:{value:'new-password-123'}})
    fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'new-password-123'}})
    fireEvent.click(screen.getByRole('button',{name:/update password/i}))
    await waitFor(()=>expect(updatePassword).toHaveBeenCalledWith('new-password-123'))
  })
})
