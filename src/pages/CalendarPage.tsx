import { ReservationSourceMark } from '../components/ReservationSourceMark'
import { requestOverbookOverride } from '../lib/overbook-override'
import { OverbookAlerts } from '../components/OverbookAlerts'
import { useIcalSync } from '../lib/ical-sync-context'
import { canEditReservation, type UserRole } from '../lib/permissions'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, EllipsisVertical, GripVertical, Minus, Plus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { NightCountBadge } from '../components/NightCountBadge'
import { buildCalendarDays, layoutReservations, getReservationPosition, type CalendarReservation } from '../lib/calendar-data'
import { getProperties, type Property } from '../lib/properties-repository'
import { getReservation, getReservations, updateReservationDates, type Reservation } from '../lib/reservations-repository'
import { hasReservationConflict } from '../lib/reservation-rules'
import { getReadableTextColor, getReservationBarColor, getReservationSourceBadge, normalizeSource } from '../lib/calendar-style'
import { formatDate, formatDateRange } from '../lib/date-format'
import { useAppLanguage, useT } from '../lib/i18n'
import { listBlocks, updateBlockDates, type AvailabilityBlock } from '../lib/operations'

type TimelineReservation = CalendarReservation & { guest_name: string; guests: number; source: string }
type PendingResize = { overrideReason?: string; id: string; isBlock: boolean; previousCheckIn: string; previousCheckOut: string; nextCheckIn: string; nextCheckOut: string }

const DAY_WIDTH_BASE = 51
const ROW_LABEL_WIDTH = 72
const LANE_HEIGHT = 40
const BAR_HEIGHT = 32
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5] as const

const fallbackImages: Record<string, string> = {
  Priko: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=120&h=120&fit=crop',
  Nelly: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=120&h=120&fit=crop',
  Pjaca: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=120&h=120&fit=crop',
}

function toDateString(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function addDaysToString(value: string, days: number) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return toDateString(date) }
function formatDay(value: string, language: 'en' | 'hr') { return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-GB', { weekday: 'short' }).format(new Date(`${value}T12:00:00`)) }
function monthLabel(value: string, language: 'en' | 'hr') { return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }
function formatTimelineDateRange(start: string, end: string) {
  const startDate = formatDate(start)
  const endDate = formatDate(end)
  return `${startDate.slice(0, 6)} - ${endDate}`
}

export function CalendarPage({ role = 'viewer' }: { role?: UserRole } = {}) {
  const { overlaps, revision } = useIcalSync()
  const t = useT()
  const language = useAppLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusedReservationId = searchParams.get('reservation')
  const [blocks,setBlocks] = useState<AvailabilityBlock[]>([])
  const [blockError,setBlockError] = useState('')
  useEffect(()=>{let active=true; listBlocks().then(data=>{if(active)setBlocks(data)}).catch(()=>{if(active)setBlockError(t('blockLoadError'))});return()=>{active=false}},[t])
  const [properties, setProperties] = useState<Property[]>([])
  const [reservations, setReservations] = useState<TimelineReservation[]>([])
  const [rangeStart, setRangeStart] = useState(() => { const d = new Date(); d.setDate(1); return toDateString(d) })
  const [rangeDays, setRangeDays] = useState(45)
  const [resizeMessage, setResizeMessage] = useState<string | null>(null)
  const [savingReservationId, setSavingReservationId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(() => Number(localStorage.getItem('calendar-zoom')) as (typeof ZOOMS)[number] || 1)
  const [fitMode, setFitMode] = useState(() => localStorage.getItem('calendar-fit') === 'true')
  const [fitDayWidth, setFitDayWidth] = useState(32)
  const [resizing, setResizing] = useState<{ id: string; isBlock: boolean; propertyId: string; side: 'start' | 'end'; initialX: number; initialCheckIn: string; initialCheckOut: string } | null>(null)
  const [pendingResize, setPendingResize] = useState<PendingResize | null>(null)
  const [sortOn, setSortOn] = useState(() => localStorage.getItem('calendar-sort') === 'true')
  const [propertyOrder, setPropertyOrder] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('calendar-property-order') || '[]') } catch { return [] } })
  const [draggedProperty, setDraggedProperty] = useState<string | null>(null)
  const [propertyDragTarget, setPropertyDragTarget] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const rangeEnd = useMemo(() => addDaysToString(rangeStart, rangeDays - 1), [rangeStart, rangeDays])
  const days = useMemo(() => buildCalendarDays(rangeStart, rangeEnd), [rangeStart, rangeEnd])
  const dayWidth = focusedReservationId || fitMode ? fitDayWidth : DAY_WIDTH_BASE * zoom
  useEffect(() => {
    if (!focusedReservationId) return
    let active = true
    getReservation(focusedReservationId).then(r => {
      if (!active) return
      setRangeStart(addDaysToString(r.check_in.slice(0,10), -2))
      setRangeDays(Math.max(5, Math.round((Date.parse(r.check_out.slice(0,10))-Date.parse(r.check_in.slice(0,10)))/86400000)+5))
      if (timelineRef.current) timelineRef.current.scrollLeft = 0
    }).catch(() => { if(active) setResizeMessage(t('reservationLoadError')) })
    return () => { active = false }
  }, [focusedReservationId, t])
  useEffect(() => { localStorage.setItem('calendar-zoom', String(zoom)) }, [zoom])
  useEffect(() => { localStorage.setItem('calendar-fit', String(fitMode)) }, [fitMode])
  useEffect(() => { localStorage.setItem('calendar-sort', String(sortOn)) }, [sortOn])

  useEffect(() => {
    let mounted = true
    Promise.all([getProperties(), getReservations(`${rangeStart}T00:00:00`, `${rangeEnd}T23:59:59.999`)]).then(([propertyData, reservationData]) => {
      if (!mounted) return
      setProperties(propertyData)
      const mapped = reservationData.map((reservation: Reservation) => ({ id: reservation.id, property_id: reservation.property_id, check_in: reservation.check_in, check_out: reservation.check_out, status: reservation.status, guest_name: reservation.guest_name, guests: reservation.guests, source: reservation.source }))
      setReservations(mapped)
    }).catch(() => { if (mounted) { setProperties([]); setReservations([]) } })
    return () => { mounted = false }
  }, [rangeStart, rangeEnd, focusedReservationId, revision])

  useEffect(() => {
    if (!fitMode && !focusedReservationId) return
    const recalc = () => {
      const width = timelineRef.current?.clientWidth ?? window.innerWidth
      const available = Math.max(1, width - ROW_LABEL_WIDTH - 12)
      setFitDayWidth(focusedReservationId ? available / rangeDays : Math.max(22, Math.floor(available / rangeDays)))
    }
    recalc(); window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [fitMode, focusedReservationId, rangeDays])

  useEffect(() => {
    if (!resizing) return
    const handlePointerMove = (event: PointerEvent) => {
      const deltaDays = Math.round((event.clientX - resizing.initialX) / dayWidth)
      if (!deltaDays) return
      if (resizing.side === 'start') {
        const nextIn = new Date(resizing.initialCheckIn); nextIn.setDate(nextIn.getDate() + deltaDays)
        if (nextIn >= new Date(resizing.initialCheckOut)) return
        if (resizing.isBlock) setBlocks(items => items.map(item => item.id===resizing.id ? {...item,start_date:toDateString(nextIn)} : item))
        else setReservations((items) => items.map((item) => item.id === resizing.id ? { ...item, check_in: nextIn.toISOString() } : item))
      } else {
        const nextOut = new Date(resizing.initialCheckOut); nextOut.setDate(nextOut.getDate() + deltaDays)
        if (nextOut <= new Date(resizing.initialCheckIn)) return
        if (resizing.isBlock) setBlocks(items => items.map(item => item.id===resizing.id ? {...item,end_date:toDateString(nextOut)} : item))
        else setReservations((items) => items.map((item) => item.id === resizing.id ? { ...item, check_out: nextOut.toISOString() } : item))
      }
    }
    const handlePointerUp = () => {
      const resize = resizing
      const block = resize.isBlock ? blocks.find(item=>item.id===resize.id) : undefined
      const reservation = block ? {id:block.id,property_id:block.property_id,check_in:block.start_date,check_out:block.end_date,status:'confirmed',guest_name:block.reason,guests:0,source:'block'} : reservations.find((item) => item.id === resize.id)
      setResizing(null)
      if (!reservation) return
      const changed = reservation.check_in !== resize.initialCheckIn || reservation.check_out !== resize.initialCheckOut
      if (!changed) return
      let overrideReason:string|null=null
      if (!resize.isBlock && hasReservationConflict([...reservations,...blocks.map(b=>({id:b.id,property_id:b.property_id,check_in:b.start_date,check_out:b.end_date,status:'confirmed'}))], reservation.property_id, reservation.check_in, reservation.check_out, reservation.id)) {
        overrideReason=requestOverbookOverride(role,language==='hr')
        if(!overrideReason){
        setReservations((items) => items.map((item) => item.id === resize.id ? { ...item, check_in: resize.initialCheckIn, check_out: resize.initialCheckOut } : item))
        setResizeMessage(t('reservationOverlapError'))
        return
        }
      }
      setResizeMessage(null)
      setPendingResize({ overrideReason:overrideReason??undefined, id: reservation.id, isBlock: resize.isBlock, previousCheckIn: resize.initialCheckIn, previousCheckOut: resize.initialCheckOut, nextCheckIn: reservation.check_in, nextCheckOut: reservation.check_out })
    }
    window.addEventListener('pointermove', handlePointerMove); window.addEventListener('pointerup', handlePointerUp)
    return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp) }
  }, [dayWidth, resizing, reservations, blocks, t,role,language])

  const confirmResize = async () => {
    if (!pendingResize) return
    const pending = pendingResize
    setPendingResize(null)
    setSavingReservationId(pending.id)
    setResizeMessage(null)
    try {
      if (pending.isBlock) {
        const saved = await updateBlockDates(pending.id, pending.nextCheckIn, pending.nextCheckOut)
        setBlocks(items=>items.map(item=>item.id===pending.id?saved:item))
      } else {
        const saved = pending.overrideReason
          ? await updateReservationDates(pending.id, pending.nextCheckIn, pending.nextCheckOut,pending.overrideReason)
          : await updateReservationDates(pending.id, pending.nextCheckIn, pending.nextCheckOut)
        setReservations((items) => items.map((item) => item.id === pending.id ? { ...item, check_in: saved.check_in, check_out: saved.check_out } : item))
      }
    } catch {
      if(pending.isBlock) setBlocks(items=>items.map(item=>item.id===pending.id?{...item,start_date:pending.previousCheckIn.slice(0,10),end_date:pending.previousCheckOut.slice(0,10)}:item))
      else setReservations((items) => items.map((item) => item.id === pending.id ? { ...item, check_in: pending.previousCheckIn, check_out: pending.previousCheckOut } : item))
      setResizeMessage(t('resizeSaveError'))
    } finally { setSavingReservationId(null) }
  }

  const cancelResize = () => {
    if (!pendingResize) return
    const pending = pendingResize
    setPendingResize(null)
    if(pending.isBlock) setBlocks(items=>items.map(item=>item.id===pending.id?{...item,start_date:pending.previousCheckIn.slice(0,10),end_date:pending.previousCheckOut.slice(0,10)}:item))
    else setReservations((items) => items.map((item) => item.id === pending.id ? { ...item, check_in: pending.previousCheckIn, check_out: pending.previousCheckOut } : item))
  }
  const moveRange = (daysToMove: number) => setRangeStart(addDaysToString(rangeStart, daysToMove))
  const toggleFit = () => setFitMode((current) => { const next = !current; setRangeDays(next ? 90 : 45); return next })
  const setManualZoom = (value: (typeof ZOOMS)[number]) => { setFitMode(false); setRangeDays(45); setZoom(value) }
  const today = toDateString(new Date())
  const orderedProperties = useMemo(() => {
    if (focusedReservationId) return properties.filter(property => reservations.some(reservation => reservation.id === focusedReservationId && reservation.property_id === property.id))
    if (sortOn) return [...properties].sort((a,b) => (reservations.find(r=>r.property_id===a.id && r.status!=='cancelled')?.check_in || '9999').localeCompare(reservations.find(r=>r.property_id===b.id && r.status!=='cancelled')?.check_in || '9999'))
    const index = new Map(propertyOrder.map((id,i)=>[id,i]))
    return [...properties].sort((a,b)=>(index.get(a.id)??9999)-(index.get(b.id)??9999))
  }, [properties,reservations,sortOn,propertyOrder,focusedReservationId])
  function dropProperty(source: string, target: string) { if (source===target) return; const ids=orderedProperties.map(p=>p.id); const from=ids.indexOf(source), to=ids.indexOf(target); if(from<0||to<0)return; ids.splice(from,1); ids.splice(to,0,source); setPropertyOrder(ids); localStorage.setItem('calendar-property-order',JSON.stringify(ids)) }

  return <section className="mx-auto max-w-[1600px] p-3 pb-8 md:p-5">
    {blockError && <p role="alert" className="mb-3 text-rose-700">{blockError}</p>}
    {resizeMessage && <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{resizeMessage}</div>}
    {pendingResize && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"><div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.2)]"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('confirmDateChange')}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{t('areYouSure')}</h2><p className="mt-2 text-sm text-slate-600">{t('changeReservationTo',{range:formatDateRange(pendingResize.nextCheckIn, pendingResize.nextCheckOut)})}</p><div className="mt-5 flex gap-2"><button type="button" onClick={cancelResize} className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700">{t('cancel')}</button><button type="button" onClick={() => void confirmResize()} className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white">{t('confirmChange')}</button></div></div></div>}
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('availability')}</p><h1 className="mt-1 text-[2.938rem] font-light leading-[.95] tracking-tight sm:text-[3.7rem]">{focusedReservationId ? (reservations.find(r=>r.id===focusedReservationId)?.guest_name || t('booking')) : t('calendar')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{focusedReservationId ? t('focusedBookingView') : t('continuousTimeline')}</p></div>
      <div className="flex flex-wrap items-center gap-1.5">
        {focusedReservationId && <button type="button" onClick={()=>navigate('/reservations')} className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white"><ChevronLeft size={16}/>{t('backToList')}</button>}
        <label className="order-4 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold text-slate-600">{t('sort')} <input aria-label={t('sortProperties')} type="checkbox" checked={sortOn} onChange={e=>setSortOn(e.target.checked)} className="accent-violet-600"/></label>
        <div data-testid="calendar-zoom" className="order-3 flex items-center rounded-xl border border-[#ded7cd] bg-white p-1"><span className="hidden px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:block">{t('zoom')}</span><button type="button" aria-label={t('zoomOut')} disabled={fitMode} onClick={() => setManualZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Minus size={14}/></button><span className="min-w-10 text-center text-[11px] font-semibold text-slate-600">{Math.round(zoom * 100)}%</span><button type="button" aria-label={t('zoomIn')} disabled={fitMode} onClick={() => setManualZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Plus size={14}/></button></div>
        <button type="button" aria-label={fitMode ? t('fitOn') : t('fitOff')} aria-pressed={fitMode} onClick={toggleFit} className="order-2 flex h-6 w-11 items-center rounded-full border border-slate-300 bg-slate-100 p-0.5 shadow-inner transition-colors aria-pressed:border-violet-300 aria-pressed:bg-violet-100" title={t('fitTimelineTitle')}><span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform" style={{transform:fitMode?'translateX(20px)':'translateX(0)'}} /></button>
        <span data-testid="calendar-fit-label" className="order-2 w-12 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{t('fit')} {fitMode ? t('on') : t('off')}</span>
        <div className="order-1 flex w-auto items-center gap-1.5"><button type="button" aria-label={t('previous')} onClick={() => moveRange(-14)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft size={16}/></button>
        <div className="min-w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-700">{monthLabel(rangeStart, language)}</div>
        <button type="button" aria-label={t('next')} onClick={() => moveRange(14)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronRight size={16}/></button></div>
      </div>
    </div>

    <div ref={timelineRef} data-testid="calendar-timeline" className="overflow-x-auto rounded-[1.35rem] border border-[#ded7cd] bg-white">
      <div className="relative min-w-max" style={{ width: ROW_LABEL_WIDTH + days.length * dayWidth }}>
        <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-white"><div className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600" style={{width:ROW_LABEL_WIDTH}}>{t('properties')}</div><div className="flex">{days.map(day => <div key={day} data-testid={`calendar-day-${day}`} className={['flex h-12 shrink-0 flex-col justify-center border-r border-slate-100 px-1 text-center', day === today ? 'bg-violet-50' : ''].join(' ')} style={{width:dayWidth}}><span className="text-[8px] font-semibold uppercase text-slate-400">{formatDay(day, language)}</span><span className={['mt-0.5 text-[11px] font-semibold', day === today ? 'text-violet-700' : 'text-slate-700'].join(' ')}>{day.slice(8)}</span></div>)}</div></div>
        {orderedProperties.map(property => {
          const propertyReservations = [...reservations.filter(r => r.property_id === property.id && (!focusedReservationId || r.id === focusedReservationId)), ...blocks.filter(b=>!focusedReservationId && b.property_id===property.id).map(b=>({id:b.id,property_id:b.property_id,check_in:b.start_date,check_out:b.end_date,status:'confirmed',guest_name:b.reason,guests:0,source:'block'}))]
          const layout = layoutReservations(propertyReservations, rangeStart, rangeEnd)
          const laneCount = Math.max(1, ...layout.map(item => item.lane + 1))
          const propertyConflicts = overlaps.filter(o=>!o.acknowledged && o.property_id===property.id)
          const image = property.image_url || fallbackImages[property.name]
          return <div key={property.id} data-property-id={property.id} data-testid="calendar-property-row" className={`relative z-10 flex border-b border-slate-100 transition-all ${draggedProperty===property.id?'opacity-65 scale-[0.995]':'opacity-100'} ${propertyDragTarget===property.id&&draggedProperty!==property.id?'bg-violet-50 ring-2 ring-inset ring-violet-300':''}`} style={{minHeight:laneCount * LANE_HEIGHT + 15}}>
            <div className="sticky left-0 z-[60] shrink-0 border-r border-slate-200 bg-white px-0.5 py-2" style={{width:ROW_LABEL_WIDTH}}><div className="relative flex h-full items-center rounded-lg"><button type="button" disabled={sortOn} aria-label={t('sortProperties')} onPointerDown={e=>{if(sortOn)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setDraggedProperty(property.id);setPropertyDragTarget(property.id)}} onPointerMove={e=>{if(draggedProperty!==property.id)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-property-id]');if(row?.dataset.propertyId)setPropertyDragTarget(row.dataset.propertyId)}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(propertyDragTarget)dropProperty(property.id,propertyDragTarget);setDraggedProperty(null);setPropertyDragTarget(null)}} onPointerCancel={()=>{setDraggedProperty(null);setPropertyDragTarget(null)}} className={sortOn?'hidden':'absolute left-0 top-1/2 z-10 flex h-7 w-4 -translate-y-1/2 shrink-0 touch-none items-center justify-center rounded-lg text-slate-300 transition hover:bg-violet-100 hover:text-violet-600 active:cursor-grabbing'}><GripVertical size={13}/></button><div className={`relative h-full min-w-0 flex-1 ${sortOn?'ml-2.5':'ml-4'}`}><div className="flex items-start justify-between"><div className="ml-1 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-300 shadow-sm">{image ? <img src={image} alt="" className="h-full w-full object-cover"/> : null}</div><span className="mt-0.5 inline-flex h-1.5 w-[14px] shrink-0 rounded-full" style={{backgroundColor:property.color||'#7C5CFC'}} /></div><p className="absolute left-0 right-0 top-[33px] truncate text-[11px] font-semibold leading-none tracking-[-0.02em] text-slate-900" title={property.name}>{property.name}</p></div></div></div>
            <div className="relative" style={{width:days.length * dayWidth}}>
              <div className="pointer-events-none absolute inset-0 flex">{days.map(day => <div key={day} className="h-full border-r border-slate-100" style={{width:dayWidth}} />)}</div>
              {propertyConflicts.map(o=>{const pos=getReservationPosition({id:o.a_id,property_id:o.property_id,check_in:o.overlap_start,check_out:o.overlap_end,status:'confirmed'},rangeStart,rangeEnd);return pos && <div key={o.a_id+o.b_id} aria-hidden="true" className="pointer-events-none absolute inset-y-0 border-x border-rose-400 bg-rose-500/20" style={{left:pos.start*dayWidth,width:pos.span*dayWidth}}/>})}
              {layout.map(position => {
                const reservation = propertyReservations.find(item => item.id === position.id)
                if (!reservation) return null
                const left = position.start * dayWidth + 3
                const width = Math.max(dayWidth - 6, position.span * dayWidth - 6)
                const source = normalizeSource(reservation.source)
                const isBlock = reservation.source === 'block'
                const imported = source === 'airbnb' || source === 'booking' || reservation.source.endsWith('_ical')
                const blockConflict = overlaps.some(o=>!o.acknowledged && (o.a_id===reservation.id || o.b_id===reservation.id))
                const bg = isBlock ? '#64748b' : getReservationBarColor(source)
                const text = getReadableTextColor(bg)
                const badge = getReservationSourceBadge(reservation.source)
                return <div key={reservation.id} data-testid={`reservation-lane-${position.lane}`} className={`absolute flex items-stretch overflow-hidden rounded-xl transition-[box-shadow,transform] ${blockConflict ? 'ring-2 ring-rose-600' : ''} ${resizing?.id===reservation.id?'z-30 scale-[1.02] shadow-[0_8px_24px_rgba(15,23,42,0.22)] ring-2 ring-violet-300':'z-0'}`} style={{left, top:position.lane * LANE_HEIGHT + 4, width, height:BAR_HEIGHT}}>
                  <button type="button" disabled={!canEditReservation(role) || imported || savingReservationId === reservation.id} title={imported ? t('importedReadOnly') : t('resizeStart')} aria-label={t('resizeStart')} aria-busy={savingReservationId === reservation.id} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!canEditReservation(role) || imported) return; setResizeMessage(null); setResizing({id:reservation.id,isBlock,propertyId:reservation.property_id,side:'start',initialX:e.clientX,initialCheckIn:reservation.check_in,initialCheckOut:reservation.check_out}) }} data-testid="reservation-resize-start" className={['z-20 flex w-4 shrink-0 touch-none select-none items-center justify-center transition-colors', imported ? 'cursor-default opacity-65' : 'cursor-ew-resize'].join(' ')} style={{backgroundColor:bg}}><EllipsisVertical size={12} strokeWidth={2.3} color={text}/></button>
                  <div onDoubleClick={() => navigate(isBlock ? '/blocks' : `/edit-reservation/${reservation.id}`)} data-testid={`reservation-body-${reservation.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 overflow-hidden px-1.5" style={{height:BAR_HEIGHT, backgroundImage:`linear-gradient(135deg, ${bg} 0%, ${bg}CC 100%)`, color:text}} title={`${reservation.guest_name} · ${formatDateRange(reservation.check_in, reservation.check_out)}`}>
                    <span data-testid={`reservation-source-badge-${reservation.id}`} title={badge.name} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/20 text-[9px] font-bold"><ReservationSourceMark source={reservation.source} /></span>
                    <div className="min-w-0 flex-1 overflow-hidden"><p className="truncate text-[12px] font-bold leading-none tracking-[-0.01em]">{blockConflict ? '⚠ ' : ''}{reservation.guest_name}</p><p className="mt-1 truncate text-[7px] font-medium leading-none opacity-90">{formatTimelineDateRange(reservation.check_in, reservation.check_out)}</p></div>
                    {!isBlock && <NightCountBadge start={reservation.check_in} end={reservation.check_out} compact />}
                  </div>
                  <button type="button" disabled={!canEditReservation(role) || imported || savingReservationId === reservation.id} title={imported ? t('importedReadOnly') : t('resizeEnd')} aria-label={t('resizeEnd')} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!canEditReservation(role) || imported) return; setResizeMessage(null); setResizing({id:reservation.id,isBlock,propertyId:reservation.property_id,side:'end',initialX:e.clientX,initialCheckIn:reservation.check_in,initialCheckOut:reservation.check_out}) }} data-testid="reservation-resize-end" className={['z-20 flex w-4 shrink-0 touch-none select-none items-center justify-center transition-colors', imported ? 'cursor-default opacity-65' : 'cursor-ew-resize'].join(' ')} style={{backgroundColor:bg}}><EllipsisVertical size={12} strokeWidth={2.3} color={text}/></button>
                </div>
              })}
              {propertyConflicts.map(o=>{const pos=getReservationPosition({id:o.a_id,property_id:o.property_id,check_in:o.overlap_start,check_out:o.overlap_end,status:'confirmed'},rangeStart,rangeEnd);return pos && <button key={o.a_id+o.b_id} type="button" title={o.possible?'Possible overbook — review':'Overbook — review'} onClick={()=>document.querySelector('[aria-label="Overbooking alerts"]')?.scrollIntoView({behavior:'smooth'})} className="absolute bottom-0 z-40 overflow-hidden rounded bg-rose-700 px-1 text-[8px] font-bold leading-[14px] text-white" style={{left:pos.start*dayWidth,width:pos.span*dayWidth}}>{o.possible?'? OVERBOOK':'OVERBOOK'}</button>})}
            </div>
          </div>
        })}
        <div data-testid="calendar-empty-row" aria-hidden="true" className="relative z-10 flex border-b border-slate-100" style={{minHeight:LANE_HEIGHT + 15}}>
          <div className="sticky left-0 z-[60] shrink-0 border-r border-slate-200 bg-white/50" style={{width:ROW_LABEL_WIDTH}} />
          <div className="relative" style={{width:days.length * dayWidth}}>
            <div className="pointer-events-none absolute inset-0 flex">{days.map(day => <div key={day} className="h-full border-r border-slate-100" style={{width:dayWidth}} />)}</div>
          </div>
        </div>
      </div>
    </div>
    <OverbookAlerts includePast/>
    <p className="mt-2 text-[10px] text-slate-400">{t('calendarHint')}</p>
  </section>
}
