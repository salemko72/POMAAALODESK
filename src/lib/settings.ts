export type Appearance = 'light' | 'dark' | 'system'
export type MeasurementUnits = 'metric' | 'imperial'
export type DateFormat = 'DD.MM.YYYY' | 'MM/DD/YYYY'
export type AppLanguage = 'en' | 'hr'
export type NotificationSettings = { arrivals: boolean; departures: boolean; cleanings: boolean; newReservations: boolean }
export type CalendarSourceSettings = { airbnbIcalUrl: string; bookingIcalUrl: string }

export type AppSettings = {
  appearance: Appearance
  measurementUnits: MeasurementUnits
  dateFormat: DateFormat
  language: AppLanguage
}

const STORAGE_KEY = 'booking-manager-settings'
const NOTIFICATION_STORAGE_KEY = 'booking-manager-notifications'
const SOURCES_STORAGE_KEY = 'booking-manager-calendar-sources'
const defaults: AppSettings = { appearance: 'light', measurementUnits: 'metric', dateFormat: 'DD.MM.YYYY', language: 'en' }

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...defaults, ...parsed }
  } catch { return defaults }
}

export const defaultNotificationSettings: NotificationSettings = { arrivals: true, departures: true, cleanings: true, newReservations: false }
export const defaultCalendarSourceSettings: CalendarSourceSettings = { airbnbIcalUrl: '', bookingIcalUrl: '' }

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY)
    if (!raw) return defaultNotificationSettings
    return { ...defaultNotificationSettings, ...(JSON.parse(raw) as Partial<NotificationSettings>) }
  } catch { return defaultNotificationSettings }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('booking-manager-settings-change'))
}

export function getCalendarSourceSettings(): CalendarSourceSettings {
  try {
    const raw = localStorage.getItem(SOURCES_STORAGE_KEY)
    if (!raw) return defaultCalendarSourceSettings
    return { ...defaultCalendarSourceSettings, ...(JSON.parse(raw) as Partial<CalendarSourceSettings>) }
  } catch { return defaultCalendarSourceSettings }
}

export function saveCalendarSourceSettings(settings: CalendarSourceSettings): void {
  localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('booking-manager-settings-change'))
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  applyAppearance(settings.appearance)
  window.dispatchEvent(new Event('booking-manager-settings-change'))
}

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement
  const dark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}
