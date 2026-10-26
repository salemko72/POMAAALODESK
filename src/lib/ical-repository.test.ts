import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.hoisted(() => vi.fn())
const select = vi.hoisted(() => vi.fn())
const insert = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
const remove = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      table,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: select,
        })),
        single: select,
      })),
      insert: (...args: unknown[]) => {
        insert(...args)
        return { select: () => ({ single: select }) }
      },
      update: (...args: unknown[]) => {
        update(...args)
        return { eq: vi.fn(() => ({ select: () => ({ single: select }) })) }
      },
      delete: () => ({ eq: (...args: unknown[]) => { remove(...args); return { error: null } } }),
      upsert: (...args: unknown[]) => {
        upsert(...args)
        return {
          select: () => ({
            single: select,
          }),
        }
      },
    }),
  },
}))

import {
  createExternalCalendar,
  updateExternalCalendar,
  deleteExternalCalendar,
  getExternalCalendars,
  upsertSyncedReservation,
} from './ical-repository'

const reservation = {
  id: 'r1',
  external_calendar_id: 'cal1',
  external_id: 'airbnb-123',
  property_id: 'p1',
  source: 'airbnb_ical',
  guest_name: 'ICAL Guest',
  check_in: '2026-09-10T14:00:00',
  check_out: '2026-09-15T10:00:00',
  guests: 2,
  status: 'confirmed',
  notes: null,
}

describe('iCal repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    select.mockResolvedValue({ data: reservation, error: null })
  })

  it('loads external calendars only for the selected property', async () => {
    await getExternalCalendars('p1')

    expect(select).toHaveBeenCalled()
  })

  it('creates an external calendar record for a property', async () => {
    await createExternalCalendar({
      property_id: 'p1',
      source: 'airbnb_ical',
      feed_url: 'https://example.com/airbnb.ics',
      is_active: true,
      last_synced_at: null,
      sync_status: 'idle',
    })

    expect(insert).toHaveBeenCalledWith({
      property_id: 'p1',
      source: 'airbnb_ical',
      feed_url: 'https://example.com/airbnb.ics',
      is_active: true,
      last_synced_at: null,
      sync_status: 'idle',
    })
  })


  it('updates and deletes a property-scoped external calendar link', async () => {
    await updateExternalCalendar('cal1', { feed_url: 'https://example.com/new.ics', source: 'booking_ical' })
    expect(update).toHaveBeenCalledWith({ feed_url: 'https://example.com/new.ics', source: 'booking_ical' })

    await deleteExternalCalendar('cal1')
    expect(remove).toHaveBeenCalledWith('id', 'cal1')
  })

  it('uses calendar id plus external id as the iCal upsert identity', async () => {
    const result = await upsertSyncedReservation('cal1', {
      external_id: 'airbnb-123',
      property_id: 'p1',
      source: 'airbnb_ical',
      guest_name: 'ICAL Guest',
      check_in: '2026-09-10T14:00:00',
      check_out: '2026-09-15T10:00:00',
      guests: 2,
    })

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        external_calendar_id: 'cal1',
        external_id: 'airbnb-123',
        property_id: 'p1',
        source: 'airbnb_ical',
      }),
      {
        onConflict: 'external_calendar_id,external_id',
      },
    )
    expect(result).toEqual(reservation)
  })

  it('keeps two calendar feeds distinct when they reuse an external id', async () => {
    select
      .mockResolvedValueOnce({
        data: { ...reservation, external_calendar_id: 'airbnb-cal' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...reservation, id: 'r2', external_calendar_id: 'booking-cal' },
        error: null,
      })

    const first = await upsertSyncedReservation('airbnb-cal', {
      external_id: 'same-id',
      property_id: 'p1',
      source: 'airbnb_ical',
      guest_name: 'Guest A',
      check_in: '2026-09-10T14:00:00',
      check_out: '2026-09-15T10:00:00',
      guests: 2,
    })

    const second = await upsertSyncedReservation('booking-cal', {
      external_id: 'same-id',
      property_id: 'p1',
      source: 'booking_ical',
      guest_name: 'Guest B',
      check_in: '2026-09-12T14:00:00',
      check_out: '2026-09-16T10:00:00',
      guests: 2,
    })

    expect(first.id).toBe('r1')
    expect(second.id).toBe('r2')
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ external_calendar_id: 'airbnb-cal', external_id: 'same-id' }),
      { onConflict: 'external_calendar_id,external_id' },
    )
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ external_calendar_id: 'booking-cal', external_id: 'same-id' }),
      { onConflict: 'external_calendar_id,external_id' },
    )
  })
})
