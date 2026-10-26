import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))
vi.mock('./lib/cleaning-work', () => ({ getCleaningWork: mocks.get, updateCleaningStatus: mocks.update }))
import { CleaningPage } from './pages/CleaningPage'
beforeEach(() => {
  mocks.get.mockResolvedValue([{ task_id: 't1', property_name: 'Test home', address: 'Test street', city: 'Test city', start_time: new Date().toISOString(), end_time: new Date(Date.now()+3600000).toISOString(), status: 'pending' }])
  mocks.update.mockResolvedValue(undefined)
})
it('shows an assigned task and saves only its status', async () => {
  render(<CleaningPage onLogout={() => {}} />)
  expect(await screen.findByText('Test home')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Status — Test home'), { target: { value: 'done' } })
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('t1', 'done'))
  expect(screen.queryByText(/guest name/i)).not.toBeInTheDocument()
})
it('keeps the previous status and reports a rejected update', async () => {
  mocks.update.mockRejectedValue(new Error('denied'))
  render(<CleaningPage onLogout={() => {}} />)
  const select = await screen.findByLabelText('Status — Test home')
  fireEvent.change(select, { target: { value: 'done' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update')
  expect(select).toHaveValue('pending')
})
