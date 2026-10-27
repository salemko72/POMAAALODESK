import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const mocks=vi.hoisted(()=>({rows:vi.fn(),blocks:vi.fn(),guests:vi.fn(),tasks:vi.fn(),saveTask:vi.fn(),status:vi.fn()}))
vi.mock('./lib/supabase',()=>({supabase:{from:()=>({select:()=>({order:()=>({order:()=>({range:mocks.rows})})})})}}))
vi.mock('./lib/properties-repository',()=>({getProperties:vi.fn().mockResolvedValue([{id:'p',name:'Nelly'}])}))
vi.mock('./lib/operations',async original=>({...await original<typeof import('./lib/operations')>(),listBlocks:mocks.blocks,listGuests:mocks.guests,listTasks:mocks.tasks,saveTask:mocks.saveTask,setTaskStatus:mocks.status,taskProperties:vi.fn().mockResolvedValue([{id:'p',name:'Nelly'}])}))
import { OperationsPage } from './pages/OperationsPage'
const row={id:'r',property_id:'p',guest_id:'g',guest_name:'Martin',check_in:'2026-09-10',check_out:'2026-09-13',source:'airbnb',status:'confirmed',guests:2,external_id:'REF123'}
afterEach(()=>vi.useRealTimers())
beforeEach(()=>{vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));vi.clearAllMocks();mocks.rows.mockResolvedValue({data:[row],error:null});mocks.blocks.mockResolvedValue([{id:'b',property_id:'p',start_date:'2026-09-11',end_date:'2026-09-12',reason:'Repair',notes:''}]);mocks.guests.mockResolvedValue([{id:'g',name:'Martin',email:'martin@example.invalid',phone:'',country:'Germany',language:'German',notes:''}]);mocks.tasks.mockResolvedValue([{id:'t',property_id:'p',kind:'Repair',title:'Window',start_time:'2026-09-10T10:00Z',end_time:'2026-09-10T12:00Z',status:'pending'}]);mocks.status.mockResolvedValue(undefined)})
describe('operations views',()=>{
 it('finds imported reservations by reference and flags block conflicts',async()=>{
  render(<MemoryRouter><OperationsPage mode="reservations" role="admin"/></MemoryRouter>)
  expect(await screen.findByText('Martin')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'REF123'}})
  fireEvent.change(screen.getByLabelText('Reservation filter'),{target:{value:'conflict'}})
  expect(screen.getAllByText('Conflict').length).toBeGreaterThan(0)
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'missing'}})
  expect(screen.getByText('No reservations found.')).toBeInTheDocument()
 })
 it('shows linked stays in guest cards',async()=>{
  render(<MemoryRouter><OperationsPage mode="guests" role="viewer"/></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button',{name:/Martin/}))
  expect(screen.getByText(/1 stays/)).toBeInTheDocument()
  expect(screen.getByRole('link',{name:/10\.09\.2026/})).toHaveAttribute('href','/edit-reservation/r')
 })
 it('lets cleaning update operational task status without contact or creation controls',async()=>{
  render(<MemoryRouter><OperationsPage mode="tasks" role="cleaning"/></MemoryRouter>)
  const status=await screen.findByLabelText('Status Window')
  fireEvent.change(status,{target:{value:'done'}})
  expect(mocks.status).toHaveBeenCalledWith('t','done')
  await waitFor(()=>expect(status).toBeEnabled())
  expect(screen.queryByRole('link',{name:'Guests'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Create task'})).not.toBeInTheDocument()
  expect(mocks.rows).not.toHaveBeenCalled()
 })
 it('prevents viewers from updating task status',async()=>{
  render(<MemoryRouter><OperationsPage mode="tasks" role="viewer"/></MemoryRouter>)
  expect(await screen.findByLabelText('Status Window')).toBeDisabled()
 })
})


describe('cancelled import archive', () => {
 const now = new Date('2026-10-27T12:00:00Z')
 function cancelled(id: string, source: string, modified: string | null) {
  return { ...row, check_in:'2026-10-25',check_out:'2026-10-28', id, guest_name: id, source, status: 'cancelled', last_modified_at: modified, updated_at: now.toISOString() }
 }
 it('moves old cancellations from every imported provider into a searchable archive', async () => {
  vi.setSystemTime(now)
  try {
   mocks.rows.mockResolvedValue({data:[
    cancelled('Old Airbnb','airbnb','2026-10-20T12:00:00Z'),
    cancelled('Old Booking','booking','2026-10-19T12:00:00Z'),
    cancelled('Other feed','other_ical','2026-10-19T12:00:00Z'),
    {...cancelled('Imported as cancelled','airbnb',null),created_actor_kind:'ical',created_at:'2026-10-19T12:00:00Z'},
    cancelled('Recent Airbnb','airbnb','2026-10-20T12:00:01Z'),
    cancelled('Manual cancellation','direct','2026-10-01T12:00:00Z'),
    {...cancelled('Reactivated','booking','2026-10-01T12:00:00Z'),status:'confirmed'},
   ],error:null})
   render(<MemoryRouter><OperationsPage mode="reservations" role="admin"/></MemoryRouter>)
   expect(await screen.findByText('Recent Airbnb')).toBeInTheDocument()
   expect(screen.queryByText('Old Airbnb')).not.toBeInTheDocument()
   expect(screen.queryByText('Old Booking')).not.toBeInTheDocument()
   expect(screen.queryByText('Other feed')).not.toBeInTheDocument()
   expect(screen.queryByText('Imported as cancelled')).not.toBeInTheDocument()
   expect(screen.getByText('Manual cancellation')).toBeInTheDocument()
   expect(screen.getByText('Reactivated')).toBeInTheDocument()
   fireEvent.change(screen.getByLabelText('Reservation filter'),{target:{value:'archived'}})
   expect(screen.getByText('Old Airbnb')).toBeInTheDocument()
   expect(screen.getByText('Old Booking')).toBeInTheDocument()
   expect(screen.getByText('Other feed')).toBeInTheDocument()
   expect(screen.getByText('Imported as cancelled')).toBeInTheDocument()
   expect(screen.queryByText('Recent Airbnb')).not.toBeInTheDocument()
   expect(screen.queryByText('Manual cancellation')).not.toBeInTheDocument()
   expect(screen.queryByText('Reactivated')).not.toBeInTheDocument()
   fireEvent.change(screen.getByLabelText('Search'),{target:{value:'Old Booking'}})
   expect(screen.getByText('Old Booking')).toBeInTheDocument()
   expect(screen.queryByText('Old Airbnb')).not.toBeInTheDocument()
  } finally { vi.useRealTimers() }
 })
 it('keeps undated cancellations visible and uses the update date for legacy rows', async () => {
  vi.setSystemTime(now)
  try {
   mocks.rows.mockResolvedValue({data:[
    {...cancelled('Legacy old','booking',null),updated_at:'2026-10-01T12:00:00Z'},
    {...cancelled('Undated','airbnb',null),updated_at:undefined},
    {...cancelled('Invalid date','airbnb','invalid'),updated_at:undefined},
   ],error:null})
   render(<MemoryRouter><OperationsPage mode="reservations" role="viewer"/></MemoryRouter>)
   expect(await screen.findByText('Undated')).toBeInTheDocument()
   expect(screen.getByText('Invalid date')).toBeInTheDocument()
   expect(screen.queryByText('Legacy old')).not.toBeInTheDocument()
   fireEvent.change(screen.getByLabelText('Reservation filter'),{target:{value:'cancelled'}})
   expect(screen.getByText('Undated')).toBeInTheDocument()
   expect(screen.queryByText('Legacy old')).not.toBeInTheDocument()
   fireEvent.change(screen.getByLabelText('Reservation filter'),{target:{value:'archived'}})
   expect(screen.getByText('Legacy old')).toBeInTheDocument()
   expect(screen.queryByText('Undated')).not.toBeInTheDocument()
  } finally { vi.useRealTimers() }
 })
})


describe('reservation age categories', () => {
 it('collapses completed stays after seven days and archives all sources after three calendar months', async () => {
  vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
  const stay = (id: string, check_out: string, source = 'direct', status = 'confirmed') => ({...row,id,guest_name:id,check_in:'2026-01-01',check_out,source,status})
  mocks.rows.mockResolvedValue({data:[
   stay('Current stay','2026-10-28'),
   stay('Recent departure','2026-10-21'),
   stay('Older stay','2026-10-20'),
   stay('Three months exactly','2026-07-27','booking'),
   stay('Archived direct','2026-07-26'),
   stay('Archived Airbnb','2026-07-26','airbnb'),
   stay('Archived agency','2026-07-26','agency'),
   stay('Archived cancellation','2026-07-26','direct','cancelled'),
   {...stay('Future booking','2027-01-07'),check_in:'2027-01-01',created_at:'2025-01-01'},
  ],error:null})
  render(<MemoryRouter><OperationsPage mode="reservations" role="admin"/></MemoryRouter>)
  expect(await screen.findByText('Current stay')).toBeVisible()
  expect(screen.getByText('Recent departure')).toBeVisible()
  expect(screen.getByText('Future booking')).toBeVisible()
  expect(screen.queryByText('Older stay')).not.toBeInTheDocument()
  expect(screen.queryByText('Archived direct')).not.toBeInTheDocument()
  const toggle = screen.getByRole('button',{name:/Category II.*2/})
  expect(toggle).toHaveAttribute('aria-expanded','false')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded','true')
  expect(screen.getByText('Older stay')).toBeVisible()
  expect(screen.getByText('Three months exactly')).toBeVisible()
  fireEvent.click(toggle)
  expect(screen.queryByText('Older stay')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Reservation filter'),{target:{value:'archived'}})
  for(const name of ['Archived direct','Archived Airbnb','Archived agency','Archived cancellation']) expect(screen.getByText(name)).toBeVisible()
  expect(screen.queryByRole('button',{name:/Category II/})).not.toBeInTheDocument()
  expect(screen.queryByText('Current stay')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'Archived agency'}})
  expect(screen.getByText('Archived agency')).toBeVisible()
  expect(screen.queryByText('Archived direct')).not.toBeInTheDocument()
 })
})
