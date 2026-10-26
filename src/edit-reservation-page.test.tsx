import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const getReservation = vi.hoisted(() => vi.fn())
const getReservations = vi.hoisted(() => vi.fn())
const updateReservation = vi.hoisted(() => vi.fn())
const deleteReservation = vi.hoisted(() => vi.fn())
const getProperties = vi.hoisted(() => vi.fn())

vi.mock('./lib/reservations-repository', () => ({ getReservation, getReservations, updateReservation, deleteReservation }))
vi.mock('./lib/properties-repository', () => ({ getProperties }))
vi.mock('./lib/operations', async importOriginal => ({...await importOriginal<typeof import('./lib/operations')>(),listGuests:vi.fn().mockResolvedValue([]),saveGuest:vi.fn().mockResolvedValue({id:'g1'})}))

import { EditReservationPage } from './pages/EditReservationPage'

const property = { id:'p1', name:'Priko', capacity:6, rooms:3, area_m2:61, check_in_time:'14:00:00', check_out_time:'10:00:00', cleaning_duration_minutes:120, wifi:true, air_conditioning:true, is_active:true }
const property2 = { ...property, id:'p2', name:'Nelly' }
const reservation = { id:'r1', property_id:'p1', source:'direct', guest_name:'Demo Guest', check_in:'2026-09-10T14:00:00', check_out:'2026-09-15T10:00:00', guests:2, status:'confirmed', notes:'test' }

beforeEach(()=>{vi.clearAllMocks();getProperties.mockResolvedValue([property, property2]);getReservation.mockResolvedValue(reservation);getReservations.mockResolvedValue([reservation]);updateReservation.mockResolvedValue(reservation);deleteReservation.mockResolvedValue(undefined)})

describe('EditReservationPage',()=>{
  it('shows reservation details without mutation controls to a viewer', async()=>{
    render(<MemoryRouter initialEntries={['/edit-reservation/r1']}><Routes><Route path="/edit-reservation/:id" element={<EditReservationPage role="viewer"/>}/></Routes></MemoryRouter>)
    expect(await screen.findByText('Reservation details')).toBeInTheDocument()
    expect(screen.getByText('5 nights')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Demo Guest')).toBeDisabled()
    expect(screen.getByLabelText('Properties')).toBeDisabled()
    expect(screen.queryByRole('button',{name:/save changes/i})).not.toBeInTheDocument()
    expect(updateReservation).not.toHaveBeenCalled()
  })
  it('shows the editable reservation form', async()=>{
    render(<MemoryRouter initialEntries={['/edit-reservation/r1']}><Routes><Route path="/edit-reservation/:id" element={<EditReservationPage role="admin"/>}/></Routes></MemoryRouter>)
    expect(await screen.findByText('Edit reservation')).toBeInTheDocument()
    expect(screen.getByText('10.09.2026')).toBeInTheDocument()
  })

  it('saves reservation changes', async()=>{
    render(<MemoryRouter initialEntries={['/edit-reservation/r1']}><Routes><Route path="/edit-reservation/:id" element={<EditReservationPage role="admin"/>}/></Routes></MemoryRouter>)
    const guest = await screen.findByDisplayValue('Demo Guest')
    fireEvent.change(guest,{target:{value:'Updated Guest'}})
    fireEvent.click(screen.getByRole('button',{name:/save changes/i}))
    await waitFor(()=>expect(updateReservation).toHaveBeenCalled())
  })
})


describe('EditReservationPage property move',()=>{
  it('allows moving a reservation to another property', async()=>{
    render(<MemoryRouter initialEntries={['/edit-reservation/r1']}><Routes><Route path="/edit-reservation/:id" element={<EditReservationPage role="admin"/>}/></Routes></MemoryRouter>)
    await screen.findByText('Edit reservation')
    fireEvent.change(screen.getByLabelText('Properties'),{target:{value:'p2'}})
    fireEvent.click(screen.getByRole('button',{name:/save changes/i}))
    await waitFor(()=>expect(updateReservation).toHaveBeenCalledWith('r1', expect.objectContaining({property_id:'p2'}), undefined))
  })
})
