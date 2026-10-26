import { describe, expect, it, vi } from 'vitest'
import { updateReservationDates } from './reservations-repository'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('updateReservationDates', () => {
  it('updates check-in and check-out and returns the reservation', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'reservation-1',
        property_id: 'property-1',
        source: 'direct',
        guest_name: 'Test Guest',
        check_in: '2026-09-11T14:00:00',
        check_out: '2026-09-16T10:00:00',
        guests: 2,
        status: 'confirmed',
      },
      error: null,
    })

    const select = vi.fn(() => ({ single }))
    const update = vi.fn(() => ({ eq: vi.fn(() => ({ select })) }))
    vi.mocked(supabase.from).mockReturnValue({ update } as never)

    const result = await updateReservationDates(
      'reservation-1',
      '2026-09-11T14:00:00',
      '2026-09-16T10:00:00',
    )

    expect(update).toHaveBeenCalledWith({
      check_in: '2026-09-11T14:00:00',
      check_out: '2026-09-16T10:00:00',
    })
    expect(result.id).toBe('reservation-1')
  })
})
