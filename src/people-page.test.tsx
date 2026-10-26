import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getProfiles = vi.hoisted(() => vi.fn())
const getPropertyAccess = vi.hoisted(() => vi.fn())
const replacePropertyAccess = vi.hoisted(() => vi.fn())
const updateProfile = vi.hoisted(() => vi.fn())
const getAllProperties = vi.hoisted(() => vi.fn())
const inviteUser = vi.hoisted(() => vi.fn())
const createAdminUser = vi.hoisted(() => vi.fn())
const deleteUser = vi.hoisted(() => vi.fn())
vi.mock('./lib/profiles-repository', () => ({ getProfiles, getPropertyAccess, replacePropertyAccess, updateProfile }))
vi.mock('./lib/properties-repository', () => ({ getAllProperties }))
vi.mock('./lib/admin-users', () => ({ inviteUser, createUser: createAdminUser, deleteUser }))

import { PeoplePage } from './pages/PeoplePage'

const people = [{id:'admin',email:'admin@example.com',full_name:'Admin',role:'admin',is_active:true}]
const properties = [{id:'p1',name:'Priko',capacity:6,rooms:3,area_m2:61,check_in_time:'14:00:00',check_out_time:'10:00:00',cleaning_duration_minutes:120,wifi:true,air_conditioning:true,is_active:true}]
beforeEach(()=>{vi.clearAllMocks();getProfiles.mockResolvedValue(people);getAllProperties.mockResolvedValue(properties);getPropertyAccess.mockResolvedValue([]);replacePropertyAccess.mockResolvedValue(undefined);updateProfile.mockResolvedValue(people[0]);inviteUser.mockResolvedValue({id:'u2',email:'kate@example.com'});createAdminUser.mockResolvedValue({id:'u2',email:'kate@example.com',temporary_password:'Temp!1234'});deleteUser.mockResolvedValue({id:'u2'})})

describe('PeoplePage',()=>{
  it('opens the add user dialog', async()=>{
    render(<PeoplePage/>)
    expect(await screen.findByText('Admin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/add user/i}))
    expect(screen.getByRole('dialog')).toHaveTextContent('Send invitation')
  })

  it('sends a user invitation', async()=>{
    render(<PeoplePage/>)
    fireEvent.click(await screen.findByRole('button',{name:/add user/i}))
    fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Kate'}})
    fireEvent.change(screen.getByLabelText('Email'),{target:{value:'kate@example.com'}})
    fireEvent.click(screen.getByRole('button',{name:/send invitation/i}))
    await waitFor(() => expect(inviteUser).toHaveBeenCalled())
  })
})


describe('PeoplePage direct user creation',()=>{
  it('creates a user directly and shows the temporary password', async()=>{
    render(<PeoplePage/>)
    fireEvent.click(await screen.findByRole('button',{name:/add user/i}))
    fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Kate'}})
    fireEvent.change(screen.getByLabelText('Email'),{target:{value:'kate@example.com'}})
    fireEvent.click(screen.getByRole('button',{name:/create user/i}))
    await waitFor(()=>expect(createAdminUser).toHaveBeenCalled())
    expect(await screen.findByText('Temp!1234')).toBeInTheDocument()
  })
})
