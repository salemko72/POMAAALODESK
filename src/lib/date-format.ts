import { getSettings, type DateFormat } from './settings'

export const DEFAULT_DATE_FORMAT = 'DD.MM.YYYY' as const

function selectedFormat(format?: DateFormat): DateFormat {
  return format ?? getSettings().dateFormat
}

function dateParts(value: string | Date): { day: string; month: string; year: number } | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: date.getFullYear(),
  }
}

export function formatDate(value: string | Date, format?: DateFormat): string {
  const parts = dateParts(value)
  if (!parts) return '—'
  return selectedFormat(format) === 'MM/DD/YYYY'
    ? `${parts.month}/${parts.day}/${parts.year}`
    : `${parts.day}.${parts.month}.${parts.year}`
}

export function formatDateShort(value: string | Date, format?: DateFormat): string {
  const parts = dateParts(value)
  if (!parts) return '—'
  return selectedFormat(format) === 'MM/DD/YYYY'
    ? `${parts.month}/${parts.day}`
    : `${parts.day}.${parts.month}`
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} → ${formatDate(end)}`
}

export function formatDateInput(value: string, format?: DateFormat): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  return selectedFormat(format) === 'MM/DD/YYYY'
    ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}`
    : `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
}

export function parseEUDate(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, day, month, year] = match
  const candidate = new Date(Number(year), Number(month) - 1, Number(day), 12)
  if (candidate.getFullYear() !== Number(year) || candidate.getMonth() !== Number(month) - 1 || candidate.getDate() !== Number(day)) return null
  return `${year}-${month}-${day}`
}
