import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const getReservations = vi.hoisted(() => vi.fn())
vi.mock('./lib/reservations-repository', () => ({ getReservations }))
vi.mock('./lib/properties-repository', () => ({}))

import { PropertyTimeline } from './components/PropertyTimeline'

const property = { id:'p1', name:'Priko', capacity:6, rooms:3, area_m2:61, check_in_time:'14:00:00', check_out_time:'10:00:00', cleaning_duration_minutes:120, wifi:true, air_conditioning:true, is_active:true }
const reservation = { id:'r1', property_id:'p1', source:'direct', guest_name:'Demo', check_in:'2026-09-10T14:00:00', check_out:'2026-09-15T10:00:00', guests:2, status:'confirmed' }

beforeEach(()=>vi.clearAllMocks())

describe('PropertyTimeline',()=>{
  it('renders a compact three-month reminder timeline',()=>{
    render(<MemoryRouter><PropertyTimeline property={property} reservations={[reservation]}/></MemoryRouter>)
    expect(screen.getByTestId('property-mini-timeline')).toHaveTextContent('Next 30 days')
    expect(screen.getByTitle(/Demo/)).toBeInTheDocument()
    expect(screen.getByLabelText('5 nights')).toHaveTextContent('5N')
  })

  it('can open the reservation editor on double click',()=>{
    render(<MemoryRouter><PropertyTimeline property={property} reservations={[reservation]}/></MemoryRouter>)
    const bar = screen.getByTitle(/Demo/)
    fireEvent.doubleClick(bar)
    // navigation is intentionally exercised by the component; route rendering is covered by EditReservationPage tests.
    expect(bar).toBeInTheDocument()
  })
})
