import { describe, expect, it, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

describe('properties repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads active properties ordered by name', async () => {
    const rows = [
      {
        id: 'p1',
        name: 'Nelly',
        capacity: 4,
        rooms: 2,
        area_m2: 48,
        check_in_time: '14:00:00',
        check_out_time: '10:00:00',
        cleaning_duration_minutes: 120,
        wifi: true,
        air_conditioning: true,
        is_active: true,
      },
    ]

    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: rows,
            error: null,
          }),
        }),
      }),
    })

    const { getProperties } = await import('./lib/properties-repository')

    await expect(getProperties()).resolves.toEqual(rows)
    expect(fromMock).toHaveBeenCalledWith('properties')
  })
})
