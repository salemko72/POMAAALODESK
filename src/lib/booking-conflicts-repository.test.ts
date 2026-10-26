import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
const eq = vi.hoisted(() => vi.fn())
const order = vi.hoisted(() => vi.fn())
const insert = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
const select = vi.hoisted(() => vi.fn())
const single = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    from,
  },
}))

import {
  getOpenConflicts,
  resolveConflict,
  syncOpenConflicts,
} from './booking-conflicts-repository'

const reservations = [
  {
    id: 'airbnb',
    property_id: 'p1',
    check_in: '2026-09-10T14:00:00Z',
    check_out: '2026-09-15T10:00:00Z',
    status: 'confirmed',
    source: 'airbnb_ical',
  },
  {
    id: 'manual',
    property_id: 'p1',
    check_in: '2026-09-12T14:00:00Z',
    check_out: '2026-09-16T10:00:00Z',
    status: 'confirmed',
    source: 'direct',
  },
]

const openConflict = {
  id: 'c1',
  property_id: 'p1',
  reservation_a_id: 'airbnb',
  reservation_b_id: 'manual',
  conflict_type: 'overbook',
  status: 'open',
  detected_at: '2026-09-06T12:00:00Z',
  resolved_at: null,
  resolved_by: null,
}

function createQueryBuilder(
  result = { data: [openConflict], error: null },
) {
  const builder: Record<string, unknown> = {}

  builder.select = (...args: unknown[]) => {
    select(...args)
    return builder
  }

  builder.eq = (...args: unknown[]) => {
    eq(...args)
    return builder
  }

  builder.order = (...args: unknown[]) => {
    order(...args)
    return builder
  }

  builder.insert = (...args: unknown[]) => {
    insert(...args)
    return {
      select: () => ({
        single: (...singleArgs: unknown[]) => {
          single(...singleArgs)
          return Promise.resolve({
            data: openConflict,
            error: null,
          })
        },
      }),
    }
  }

  builder.update = (...args: unknown[]) => {
    update(...args)
    return {
      eq: (...eqArgs: unknown[]) => {
        eq(...eqArgs)
        return Promise.resolve({ data: null, error: null })
      },
    }
  }

  builder.then = (
    resolve: (value: typeof result) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)

  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  from.mockImplementation(() => createQueryBuilder())
})

describe('booking conflict persistence', () => {
  it('loads only open conflicts for a selected property', async () => {
    const result = await getOpenConflicts('p1')

    expect(eq).toHaveBeenCalledWith('status', 'open')
    expect(eq).toHaveBeenCalledWith('property_id', 'p1')
    expect(order).toHaveBeenCalledWith(
      'detected_at',
      { ascending: false },
    )
    expect(result).toEqual([openConflict])
  })

  it('resolves a conflict for a specific user', async () => {
    await resolveConflict('c1', 'user1')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolved_by: 'user1',
      }),
    )
  })

  it('keeps the same open conflict as one logical record on repeated sync', async () => {
    const result = await syncOpenConflicts('p1', reservations)

    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(result).toEqual([openConflict])
  })

  it('reopens a previously resolved conflict when the overlap returns', async () => {
    const resolvedConflict = {
      ...openConflict,
      status: 'resolved',
      resolved_at: '2026-09-07T12:00:00Z',
      resolved_by: 'user1',
    }

    let selectCalls = 0

    from.mockImplementation(() => {
      selectCalls += 1

      if (selectCalls === 1) {
        const builder: Record<string, unknown> = {}

        builder.select = () => builder

        builder.eq = () =>
          Promise.resolve({
            data: [resolvedConflict],
            error: null,
          })

        return builder
      }

      return createQueryBuilder()
    })

    await syncOpenConflicts('p1', reservations)

    expect(update).toHaveBeenCalledWith({
      status: 'open',
      resolved_at: null,
      resolved_by: null,
    })
  })
})
