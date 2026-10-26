import { describe, expect, it } from 'vitest'
import { formatDate, formatDateInput, formatDateRange, formatDateShort, parseEUDate } from './date-format'

describe('date formatting', () => {
  it('uses the required European date format', () => {
    expect(formatDate('2026-09-06T12:00:00')).toBe('06.09.2026')
  })
  it('formats a short date without swapping month and day', () => {
    expect(formatDateShort('2026-09-06T12:00:00')).toBe('06.09')
  })
  it('formats a reservation range consistently', () => {
    expect(formatDateRange('2026-09-06T12:00:00', '2026-09-10T12:00:00')).toBe('06.09.2026 → 10.09.2026')
  })
  it('formats and parses the EU booking date input', () => {
    expect(formatDateInput('2026-09-06')).toBe('06.09.2026')
    expect(parseEUDate('06.09.2026')).toBe('2026-09-06')
    expect(parseEUDate('31.02.2026')).toBeNull()
  })
  it('supports the American date format from settings', () => {
    expect(formatDate('2026-09-06T12:00:00', 'MM/DD/YYYY')).toBe('09/06/2026')
    expect(formatDateShort('2026-09-06T12:00:00', 'MM/DD/YYYY')).toBe('09/06')
    expect(formatDateInput('2026-09-06', 'MM/DD/YYYY')).toBe('09/06/2026')
  })
})
