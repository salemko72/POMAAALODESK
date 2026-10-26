import { beforeEach,describe,expect,it,vi } from 'vitest'
import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const mocks=vi.hoisted(()=>({rows:vi.fn(),blocks:vi.fn(),guests:vi.fn(),tasks:vi.fn(),saveTask:vi.fn(),status:vi.fn()}))
vi.mock('./lib/supabase',()=>({supabase:{from:()=>({select:()=>({order:()=>({order:()=>({range:mocks.rows})})})})}}))
vi.mock('./lib/properties-repository',()=>({getProperties:vi.fn().mockResolvedValue([{id:'p',name:'Nelly'}])}))
vi.mock('./lib/operations',async original=>({...await original<typeof import('./lib/operations')>(),listBlocks:mocks.blocks,listGuests:mocks.guests,listTasks:mocks.tasks,saveTask:mocks.saveTask,setTaskStatus:mocks.status,taskProperties:vi.fn().mockResolvedValue([{id:'p',name:'Nelly'}])}))
import { OperationsPage } from './pages/OperationsPage'
const row={id:'r',property_id:'p',guest_id:'g',guest_name:'Martin',check_in:'2026-09-10',check_out:'2026-09-13',source:'airbnb',status:'confirmed',guests:2,external_id:'REF123'}
beforeEach(()=>{vi.clearAllMocks();mocks.rows.mockResolvedValue({data:[row],error:null});mocks.blocks.mockResolvedValue([{id:'b',property_id:'p',start_date:'2026-09-11',end_date:'2026-09-12',reason:'Repair',notes:''}]);mocks.guests.mockResolvedValue([{id:'g',name:'Martin',email:'martin@example.invalid',phone:'',country:'Germany',language:'German',notes:''}]);mocks.tasks.mockResolvedValue([{id:'t',property_id:'p',kind:'Repair',title:'Window',start_time:'2026-09-10T10:00Z',end_time:'2026-09-10T12:00Z',status:'pending'}]);mocks.status.mockResolvedValue(undefined)})
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
