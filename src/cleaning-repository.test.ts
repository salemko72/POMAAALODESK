import { describe, expect, it, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

describe('cleaning repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a cleaning task for a reservation', async () => {
    const task: Omit<
  import('./lib/cleaning-repository').CleaningTask,
  'id'
> = {
      reservation_id: 'r1',
      property_id: 'p1',
      start_time: '2026-09-14T10:00:00Z',
      end_time: '2026-09-14T12:00:00Z',
      status: 'pending',
      is_manually_overridden: false,
    }

    const created = {
      id: 'c1',
      ...task,
    }

    fromMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: created,
            error: null,
          }),
        }),
      }),
    })

    const { createCleaningTask } =
      await import('./lib/cleaning-repository')

    await expect(createCleaningTask(task)).resolves.toEqual(created)
    expect(fromMock).toHaveBeenCalledWith('cleaning_tasks')
  })

  it('uses the property cleaning duration when building a default task', async () => {
    const { buildDefaultCleaningTask } =
      await import('./lib/cleaning-repository')

    const result = buildDefaultCleaningTask({
      reservationId: 'r1',
      propertyId: 'p1',
      checkout: '2026-09-14T10:00:00Z',
      cleaningDurationMinutes: 120,
    })

    expect(result).toEqual({
      reservation_id: 'r1',
      property_id: 'p1',
      start_time: '2026-09-14T10:00:00.000Z',
      end_time: '2026-09-14T12:00:00.000Z',
      status: 'pending',
      is_manually_overridden: false,
    })
  })
})
