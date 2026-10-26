import { describe, expect, it, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

describe('reservations repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads reservations for a date range', async () => {
    const rows = [
      {
        id: 'r1',
        property_id: 'p1',
        source: 'direct',
        guest_name: 'Demo Guest',
        check_in: '2026-09-10T14:00:00Z',
        check_out: '2026-09-14T10:00:00Z',
        guests: 4,
        status: 'confirmed',
      },
    ]

    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: rows,
              error: null,
            }),
          }),
        }),
      }),
    })

    const { getReservations } = await import('./lib/reservations-repository')

    await expect(
      getReservations('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'),
    ).resolves.toEqual(rows)

    expect(fromMock).toHaveBeenCalledWith('reservations')
  })

  it('creates a manual reservation', async () => {
    const reservation: import('./lib/reservations-repository').CreateReservationInput = {
      property_id: 'p1',
      source: 'direct',
      guest_name: 'New Guest',
      check_in: '2026-09-20T14:00:00Z',
      check_out: '2026-09-24T10:00:00Z',
      guests: 2,
      status: 'confirmed',
    }

    const created = {
      id: 'r2',
      ...reservation,
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

    const { createReservation } =
      await import('./lib/reservations-repository')

    await expect(createReservation(reservation)).resolves.toEqual(created)
    expect(fromMock).toHaveBeenCalledWith('reservations')
  })
})
