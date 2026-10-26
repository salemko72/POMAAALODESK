import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildCalendarDays, layoutReservations, type CalendarReservation } from '../lib/calendar-data'
import { formatDateRange } from '../lib/date-format'
import { getReadableTextColor, getReservationBarColor, normalizeSource } from '../lib/calendar-style'
import type { Reservation } from '../lib/reservations-repository'
import type { Property } from '../lib/properties-repository'
import { useT } from '../lib/i18n'
import { NightCountBadge } from './NightCountBadge'

type Props = { property: Property; reservations: Reservation[]; startDate?: string }

function toDateString(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function todayString() { return toDateString(new Date()) }
function addDays(value: string, days: number) { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate()+days); return toDateString(d) }
function sourceLabel(source: string) { const s = normalizeSource(source); return s === 'airbnb' ? 'AIRBNB' : s === 'booking' ? 'BOOKING' : s === 'agency' ? 'AGENCY' : 'DIRECT' }

export function PropertyTimeline({ property, reservations, startDate }: Props) {
  const t = useT()
  const navigate = useNavigate()
  const start = startDate || todayString()
  const end = addDays(start, 29)
  const days = useMemo(() => buildCalendarDays(start, end), [start, end])
  const visible = reservations.filter((item) => item.property_id === property.id)
  const layout = layoutReservations(visible as CalendarReservation[], start, end)
  const dayWidth = 38
  const width = days.length * dayWidth

  return <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3" data-testid="property-mini-timeline">
    <div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-500">{t('availability')}</p><h3 className="mt-0.5 text-sm font-semibold text-slate-800">{t('availabilityNext30')}</h3></div><span className="text-[10px] text-slate-400">{t('scrollHorizontally')}</span></div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white"><div className="relative min-w-max" style={{width}}>
      <div className="flex border-b border-slate-100">{days.map((day)=><div key={day} className="flex h-7 shrink-0 items-center justify-center border-r border-slate-100 text-[8px] font-semibold text-slate-500" style={{width:dayWidth}} title={day}>{day.slice(8,10)}.{day.slice(5,7)}</div>)}</div>
      <div className="relative" style={{height:Math.max(80,(Math.max(0,...layout.map(p=>p.lane))+1)*28+18)}}>{days.map(day=><div key={day} className="absolute top-0 h-full border-r border-slate-100" style={{left:days.indexOf(day)*dayWidth,width:dayWidth}}/>)}
        {layout.map(position=>{const item=visible.find(r=>r.id===position.id);if(!item)return null;const bg=getReservationBarColor(item.source);const text=getReadableTextColor(bg);const left=position.start*dayWidth+2;const barWidth=Math.max(dayWidth-4,position.span*dayWidth-4);return <button key={item.id} type="button" onDoubleClick={()=>navigate(`/edit-reservation/${item.id}`)} title={`${item.guest_name} · ${formatDateRange(item.check_in,item.check_out)}`} className="absolute flex items-center gap-1 overflow-hidden rounded-full pr-1 text-left" style={{left,top:8+position.lane*28,width:barWidth,height:22,backgroundColor:bg,color:text}}><span className="ml-1.5 min-w-0 flex-1 truncate px-1 text-[8px] font-semibold">{sourceLabel(item.source)} · {item.guest_name}</span><NightCountBadge start={item.check_in} end={item.check_out} compact /></button>})}
      </div>
    </div></div>
    <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400"><span>{start}</span><span>{end}</span></div>
  </section>
}
