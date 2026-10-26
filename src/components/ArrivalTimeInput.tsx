import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { getSettings, type MeasurementUnits } from '../lib/settings'

function splitTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  const hour = match ? Math.min(23, Number(match[1])) : 15
  const minute = match ? Math.min(59, Number(match[2])) : 0
  return { hour, minute }
}

function storedTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function ArrivalTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT()
  const [units, setUnits] = useState<MeasurementUnits>(() => getSettings().measurementUnits)
  const { hour, minute } = splitTime(value)
  const minuteOptions = useMemo(() => {
    const standard = Array.from({ length: 12 }, (_, index) => index * 5)
    return standard.includes(minute) ? standard : [...standard, minute].sort((a, b) => a - b)
  }, [minute])

  useEffect(() => {
    const update = () => setUnits(getSettings().measurementUnits)
    window.addEventListener('booking-manager-settings-change', update)
    return () => window.removeEventListener('booking-manager-settings-change', update)
  }, [])

  const setPart = (nextHour: number, nextMinute = minute) => onChange(storedTime(nextHour, nextMinute))
  const selectClass = 'mt-1 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2 text-sm'

  return <fieldset className="min-w-0">
    <legend className="text-xs capitalize text-slate-600">{t('arrivalTime')}</legend>
    <div className="flex items-center gap-2">
      <select aria-label={t('arrivalHour')} className={selectClass} value={value ? (units === 'imperial' ? (hour % 12 || 12) : hour) : ''} onChange={e => {
        const selected = Number(e.target.value)
        if (units === 'metric') setPart(selected)
        else setPart((selected % 12) + (hour >= 12 ? 12 : 0))
      }}>
        <option value="" disabled>--</option>
        {(units === 'metric' ? Array.from({ length: 24 }, (_, index) => index) : Array.from({ length: 12 }, (_, index) => index + 1)).map(option => <option key={option} value={option}>{String(option).padStart(2, '0')}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={t('arrivalMinute')} className={selectClass} value={minute} disabled={!value} onChange={e => setPart(hour, Number(e.target.value))}>
        {minuteOptions.map(option => <option key={option} value={option}>{String(option).padStart(2, '0')}</option>)}
      </select>
      {units === 'imperial' && <select aria-label={t('arrivalPeriod')} className={selectClass} value={hour >= 12 ? 'PM' : 'AM'} disabled={!value} onChange={e => {
        const isPm = e.target.value === 'PM'
        setPart((hour % 12) + (isPm ? 12 : 0))
      }}><option value="AM">AM</option><option value="PM">PM</option></select>}
    </div>
  </fieldset>
}
