import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useAppLanguage, useT } from '../lib/i18n'
import { formatDateInput } from '../lib/date-format'

const WEEKDAYS = { en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], hr: ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'] } as const

function fromDateString(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1, 12)
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthTitle(date: Date, language: 'en' | 'hr') {
  return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-GB', { month: 'long', year: 'numeric' }).format(date)
}

export function buildMonthCells(anchor: Date): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, inMonth: date.getMonth() === anchor.getMonth() }
  })
}

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  label: string
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const t = useT()
  const language = useAppLanguage()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(() => fromDateString(value))
  const cells = useMemo(() => buildMonthCells(anchor), [anchor])

  function choose(date: Date) {
    // Close before notifying the parent. This prevents mobile Safari from
    // keeping/reopening the popover while the surrounding form rerenders.
    setOpen(false)
    setAnchor(date)
    onChange(toDateString(date))
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          setAnchor(fromDateString(value))
          setOpen((current) => !current)
        }}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-normal outline-none hover:border-slate-300 focus:border-violet-400"
      >
        <span>{formatDateInput(value)}</span>
        <CalendarDays size={16} className="text-violet-500" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[296px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_50px_rgba(37,48,70,0.16)]">
          <div className="flex items-center justify-between px-1 pb-2">
            <button type="button" aria-label={t('previousMonth')} onClick={() => setAnchor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-slate-800">{monthTitle(anchor, language)}</span>
            <button type="button" aria-label={t('nextMonth')} onClick={() => setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            {WEEKDAYS[language].map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const iso = toDateString(date)
              const selected = iso === value
              return <button key={iso} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); choose(date) }} className={['h-8 rounded-lg text-xs font-semibold transition', inMonth ? 'text-slate-700' : 'text-slate-300', selected ? 'bg-violet-600 text-white hover:bg-violet-600' : 'hover:bg-violet-50'].join(' ')}>{date.getDate()}</button>
            })}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-right text-[10px] font-semibold text-slate-400">{formatDateInput(value)}</div>
        </div>
      )}
    </div>
  )
}
