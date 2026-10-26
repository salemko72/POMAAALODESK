import { beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ supabase: { rpc } }))
import { getCleaningWork, updateCleaningStatus } from './cleaning-work'
beforeEach(() => rpc.mockReset())
it('fetches the operational projection through the restricted RPC', async () => {
  rpc.mockResolvedValue({ data: [], error: null })
  expect(await getCleaningWork('start', 'end')).toEqual([])
  expect(rpc).toHaveBeenCalledWith('get_my_cleaning_work', { p_start: 'start', p_end: 'end' })
})
it('sends only the task ID and status and propagates rejection', async () => {
  rpc.mockResolvedValue({ error: new Error('denied') })
  await expect(updateCleaningStatus('t1','done')).rejects.toThrow('denied')
  expect(rpc).toHaveBeenCalledWith('update_my_cleaning_status', { p_task_id: 't1', p_status: 'done' })
})
