import { beforeEach, describe, expect, it } from 'vitest'
import { getSettings, saveSettings } from './lib/settings'

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('uses light mode as the default', () => {
    expect(getSettings()).toEqual({
      appearance: 'light',
      measurementUnits: 'metric',
      dateFormat: 'DD.MM.YYYY',
      language: 'en',
    })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists appearance and measurement preferences', () => {
    saveSettings({ appearance: 'dark', measurementUnits: 'imperial', dateFormat: 'MM/DD/YYYY', language: 'hr' })
    expect(getSettings()).toEqual({ appearance: 'dark', measurementUnits: 'imperial', dateFormat: 'MM/DD/YYYY', language: 'hr' })
  })

  it('applies dark mode only when explicitly selected', () => {
    saveSettings({ appearance: 'dark', measurementUnits: 'metric', dateFormat: 'DD.MM.YYYY', language: 'en' })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    saveSettings({ appearance: 'light', measurementUnits: 'metric', dateFormat: 'DD.MM.YYYY', language: 'en' })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
