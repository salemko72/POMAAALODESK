import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReservationAttribution } from './components/ReservationAttribution'
import type { Reservation } from './lib/reservations-repository'

const booking:Reservation={id:'r',property_id:'p',source:'direct',guest_name:'Guest',check_in:'2026-10-01',check_out:'2026-10-03',guests:1,status:'confirmed'}
afterEach(cleanup)
describe('reservation attribution',()=>{
  it('shows both recorded names and the last edit time',()=>{
    render(<ReservationAttribution hr reservation={{...booking,created_actor_kind:'user',created_by_name:'Kate',last_modified_actor_kind:'user',last_modified_by_name:'Salem',last_modified_at:'2026-09-23T12:00:00Z'}}/>)
    expect(screen.getByText('Rezervaciju napravio')).toBeInTheDocument()
    expect(screen.getByText('Kate')).toBeInTheDocument()
    expect(screen.getByText('Salem')).toBeInTheDocument()
    expect(document.querySelector('time')).toHaveAttribute('datetime','2026-09-23T12:00:00Z')
  })
  it('does not invent an author or claim no edits for legacy records',()=>{
    render(<ReservationAttribution hr={false} reservation={booking}/>)
    expect(screen.getAllByText('Not recorded')).toHaveLength(2)
    expect(screen.queryByText('No edits yet')).not.toBeInTheDocument()
  })
  it('distinguishes automated imports and a new reservation with no edits',()=>{
    render(<ReservationAttribution hr={false} reservation={{...booking,created_actor_kind:'ical'}}/>)
    expect(screen.getByText('Automatic iCal import')).toBeInTheDocument()
    expect(screen.getByText('No edits yet')).toBeInTheDocument()
  })
})
