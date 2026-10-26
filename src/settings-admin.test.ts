import { beforeEach, describe, expect, it } from 'vitest'
import { getCalendarSourceSettings, getNotificationSettings, saveCalendarSourceSettings, saveNotificationSettings } from './lib/settings'

describe('administration preferences', () => {
  beforeEach(() => localStorage.clear())

  it('persists notification preferences', () => {
    saveNotificationSettings({ arrivals: false, departures: true, cleanings: false, newReservations: true })
    expect(getNotificationSettings()).toEqual({ arrivals: false, departures: true, cleanings: false, newReservations: true })
  })

  it('persists calendar source links', () => {
    saveCalendarSourceSettings({ airbnbIcalUrl: 'https://airbnb.example/calendar.ics', bookingIcalUrl: 'https://booking.example/calendar.ics' })
    expect(getCalendarSourceSettings()).toEqual({ airbnbIcalUrl: 'https://airbnb.example/calendar.ics', bookingIcalUrl: 'https://booking.example/calendar.ics' })
  })
})
