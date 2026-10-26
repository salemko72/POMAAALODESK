import { describe, expect, it, vi } from 'vitest'

import {
  getDailyOperationalData,
} from './lib/operational-repository'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

describe('operational repository', () => {
  it('loads reservations and cleaning tasks for a day', async () => {
    const reservations = [
      {
        id: 'r1',
        property_id: 'p1',
        guest_name: 'Guest One',
        check_in: '2026-09-05T14:00:00+02:00',
        check_out: '2026-09-08T10:00:00+02:00',
        guests: 4,
        source: 'airbnb',
        status: 'confirmed',
      },
    ]

    const cleanings = [
      {
        id: 'c1',
        reservation_id: 'r1',
        property_id: 'p1',
        start_time: '2026-09-05T10:00:00+02:00',
        end_time: '2026-09-05T12:00:00+02:00',
        status: 'pending',
        is_manually_overridden: false,
      },
    ]

    fromMock.mockImplementation((table: string) => {
      if (table === 'reservations') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: reservations,
            error: null,
          }),
        }
      }

      if (table === 'cleaning_tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: cleanings,
            error: null,
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await getDailyOperationalData(
      '2026-09-05T00:00:00+02:00',
      '2026-09-06T00:00:00+02:00',
    )

    expect(result.reservations).toEqual(reservations)
    expect(result.cleanings).toEqual(cleanings)
    expect(fromMock).toHaveBeenCalledWith('reservations')
    expect(fromMock).toHaveBeenCalledWith('cleaning_tasks')
  })

  it('throws when the reservations query fails', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'reservations') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Reservations query failed'),
          }),
        }
      }

      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }
    })

    await expect(
      getDailyOperationalData(
        '2026-09-05T00:00:00+02:00',
        '2026-09-06T00:00:00+02:00',
      ),
    ).rejects.toThrow('Reservations query failed')
  })
})