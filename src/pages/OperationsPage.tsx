import { format, subDays, subMonths } from 'date-fns'
import { ReservationSourceMark } from '../components/ReservationSourceMark'
import { OverbookAlerts } from '../components/OverbookAlerts'
import { useIcalSync } from '../lib/ical-sync-context'
import { getReservationBarColor, getReservationSourceBadge, getReadableTextColor } from '../lib/calendar-style'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { supabase } from '../lib/supabase'
import { getProperties, type Property } from '../lib/properties-repository'
import { type Reservation } from '../lib/reservations-repository'
import { blockReasons, taskKinds, listBlocks, listGuests, listTasks, taskProperties, saveBlock, removeBlock, saveTask, setTaskStatus, type AvailabilityBlock, type Guest, type Task } from '../lib/operations'
import { canEditReservation, type UserRole } from '../lib/permissions'
import { translateValue, useAppLanguage, useT } from '../lib/i18n'
import { formatDate, formatDateRange } from '../lib/date-format'

type ReservationPhase = 'current' | 'upcoming' | 'past' | 'cancelled'

// Sync-only updates change updated_at, but attribution preserves the last
// meaningful change. Missing/invalid historical dates stay visible for safety.
function isArchivedCancellation(reservation: Reservation, now: number) {
 const imported = Boolean(reservation.external_calendar_id) || ['airbnb', 'booking', 'airbnb_ical', 'booking_ical', 'other_ical'].includes(reservation.source)
 if (!imported || reservation.status !== 'cancelled') return false
 const insertedAt = reservation.created_actor_kind === 'ical' ? reservation.created_at : undefined
 const changedAt = Date.parse(reservation.last_modified_at ?? insertedAt ?? reservation.updated_at ?? '')
 return Number.isFinite(changedAt) && now - changedAt >= 7 * 24 * 60 * 60 * 1000
}

function reservationPhase(reservation: Reservation, today: string): ReservationPhase {
 if (reservation.status === 'cancelled') return 'cancelled'
 if (reservation.check_out.slice(0, 10) <= today) return 'past'
 if (reservation.check_in.slice(0, 10) <= today) return 'current'
 return 'upcoming'
}

function reservationPhaseColor(phase: ReservationPhase) {
 return phase === 'current' ? '#16a34a' : phase === 'upcoming' ? '#7c3aed' : phase === 'past' ? '#2563eb' : '#dc2626'
}

function translucentColor(color: string) {
 return `color-mix(in srgb, ${color} 40%, transparent)`
}

function reservationPhaseLabel(phase: ReservationPhase, language: string) {
 const labels = language === 'hr'
  ? { current: 'AKTV', upcoming: 'DOLZ', past: 'ZAVR', cancelled: 'OTKZ' }
  : { current: 'CURR', upcoming: 'UPCM', past: 'PAST', cancelled: 'CNCL' }
 return labels[phase]
}

export function OperationsPage({ mode, role }: { mode: 'reservations' | 'guests' | 'tasks' | 'blocks'; role: UserRole }) {
 const { overlaps, revision } = useIcalSync()
 const t = useT()
 const language = useAppLanguage()
 const navigate = useNavigate()
 const [properties,setProperties] = useState<Pick<Property,'id'|'name'>[]>([]), [bookings,setBookings] = useState<Reservation[]>([]), [blocks,setBlocks] = useState<AvailabilityBlock[]>([]), [guests,setGuests] = useState<Guest[]>([]), [tasks,setTasks] = useState<Task[]>([])
 const [error,setError] = useState(''), [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [query,setQuery] = useState(''), [property,setProperty] = useState(''), [filter,setFilter] = useState('all'), [selected,setSelected] = useState('')
 const [olderOpen,setOlderOpen] = useState(false)
 const [start,setStart] = useState(''), [end,setEnd] = useState(''), [reason,setReason] = useState<string>(blockReasons[0]), [kind,setKind] = useState<string>(taskKinds[0]), [notes,setNotes] = useState('')
 const editable = canEditReservation(role)
 const load = useCallback(async () => {
  try {
   setProperties(role === 'cleaning' ? await taskProperties() : await getProperties())
   if (mode === 'tasks') setTasks(await listTasks())
   else {
    const all: Reservation[]=[]
    for(let from=0;;from+=500){const {data,error}=await supabase.from('reservations').select('*').order('check_in',{ascending:false}).order('id').range(from,from+499);if(error)throw error;all.push(...(data??[]));if(!data||data.length<500)break}
    setBookings(all)
    setBlocks(await listBlocks())
    if(mode === 'guests') setGuests(await listGuests())
   }
  } catch { setError(t('unableLoadOperations')) }
  finally { setLoading(false) }
 },[mode,role,t,revision])
 useEffect(() => { void load() }, [load])
 async function mutate(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await load() } catch { setError(t('unableSaveOperation')) } finally { setBusy(false) } }
 const [now,setNow] = useState(Date.now)
 useEffect(() => {
  if (mode !== 'reservations') return
  const timer = window.setInterval(() => setNow(Date.now()), 60000)
  return () => window.clearInterval(timer)
 }, [mode])
 const today = new Date(now).toLocaleDateString('en-CA')
 const archiveBefore = format(subMonths(new Date(now),3),'yyyy-MM-dd')
 const secondaryBefore = format(subDays(new Date(now),7),'yyyy-MM-dd')
 const archived = (r: Reservation) => isArchivedCancellation(r,now) || /^\d{4}-\d{2}-\d{2}/.test(r.check_out) && r.check_out.slice(0,10) < archiveBefore
 const conflict = (r: Reservation) => overlaps.some(o=>!o.acknowledged && (o.a_id===r.id || o.b_id===r.id))
 const results = bookings.filter(r => (filter === 'archived' ? archived(r) : !archived(r)) && (!property || r.property_id===property) && `${r.guest_name} ${r.id} ${r.external_id ?? ''} ${r.source}`.toLowerCase().includes(query.toLowerCase()) && (filter==='all' || filter==='archived' || filter==='conflict' && conflict(r) || filter==='upcoming' && r.status!=='cancelled' && r.check_in.slice(0,10)>today || filter==='current' && r.status!=='cancelled' && r.check_in.slice(0,10)<=today && r.check_out.slice(0,10)>today || r.status===filter)).sort((a,b)=>{const rank=(r:Reservation)=>r.status==='cancelled'?3:r.check_out.slice(0,10)<=today?2:r.check_in.slice(0,10)<=today?0:1;return rank(a)-rank(b)||(a.check_in.localeCompare(b.check_in))})
 const secondaryResults = filter === 'archived' ? [] : results.filter(r => r.check_out.slice(0,10) <= secondaryBefore)
 const primaryResults = filter === 'archived' ? results : results.filter(r => r.check_out.slice(0,10) > secondaryBefore)
 const propertyName = (id: string) => properties.find(p => p.id===id)?.name ?? id
 const guest = guests.find(g => g.id===selected)
 const stays = bookings.filter(r => r.guest_id===selected && r.status!=='cancelled' && (!property || r.property_id===property))
 const inputClass='rounded-xl border border-slate-200 bg-white p-2 text-sm'
 const renderReservation = (r: Reservation) => <article onDoubleClick={()=>navigate(`/edit-reservation/${r.id}`)} title={t('editReservation')} className="relative flex cursor-pointer flex-wrap items-center justify-between gap-2 overflow-hidden rounded-xl border-l-4 bg-white py-2.5 pl-3 pr-8" style={{borderLeftColor:getReservationBarColor(r.source)}} key={r.id}><div className="flex min-w-0 items-center gap-2.5"><span title={getReservationSourceBadge(r.source).name} aria-label={getReservationSourceBadge(r.source).name} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{backgroundColor:getReservationBarColor(r.source),color:getReadableTextColor(getReservationBarColor(r.source))}}><ReservationSourceMark source={r.source} /></span><div className="min-w-0"><p className="truncate text-sm leading-tight"><strong>{r.guest_name}</strong> <span className="text-slate-500">· {propertyName(r.property_id)}</span></p><p className="text-[11px] leading-tight text-slate-500">{formatDateRange(r.check_in,r.check_out)} · {translateValue(language,r.source)} · {translateValue(language,r.status)}{conflict(r) && <strong className="ml-2 text-rose-600">{t('conflict')}</strong>}</p></div></div><div className="flex items-center gap-1.5"><span className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{backgroundColor:translucentColor(getReservationBarColor(r.source)),color:getReservationBarColor(r.source)}}>{t('total')}: {r.total_price == null ? '—' : `€${r.total_price.toFixed(2)}`}</span><Link className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] text-slate-700" to={`/calendar?reservation=${r.id}`}>{t('goToCalendar')}</Link></div><span style={{backgroundColor:reservationPhaseColor(reservationPhase(r,today))}} className="absolute inset-y-0 right-0 flex w-6 items-center justify-center rounded-r-xl"><span className="status-ribbon-label text-[7px] font-bold uppercase leading-none tracking-[0.04em] text-white">{reservationPhaseLabel(reservationPhase(r,today),language)}</span></span></article>
 return <section className="mx-auto max-w-6xl space-y-4 p-4"><h1 className="text-[2.938rem] font-light leading-[.95] capitalize tracking-tight sm:text-[3.7rem]">{mode === 'blocks' ? t('blockDates') : mode === 'tasks' ? t('tasksPage') : mode === 'guests' ? t('guestsPage') : t('reservations')}<AgencyTitleMark /></h1>
 <div className="flex flex-wrap gap-2.5">{role!=='cleaning' && <><Link className="rounded-xl border border-slate-300 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-400 hover:bg-white/70 hover:text-violet-700" to="/reservations">{t('reservations')}</Link><Link className="rounded-xl border border-slate-300 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-400 hover:bg-white/70 hover:text-violet-700" to="/guests">{t('guestsPage')}</Link><Link className="rounded-xl border border-slate-300 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-400 hover:bg-white/70 hover:text-violet-700" to="/blocks">{t('blockDates')}</Link></>}<Link className="rounded-xl border border-slate-300 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-400 hover:bg-white/70 hover:text-violet-700" to="/tasks">{t('tasksPage')}</Link></div>
 {mode==='reservations' && <><OverbookAlerts/></>}
 {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}{loading && <p>{t('loading')}</p>}
 <div className="flex flex-wrap gap-3"><input aria-label={t('search')} placeholder={t('searchOperations')} className={inputClass} value={query} onChange={e => setQuery(e.target.value)}/><select aria-label={t('filterProperty')} className={inputClass} value={property} onChange={e => setProperty(e.target.value)}><option value="">{t('allProperties')}</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{mode==='reservations' && <select aria-label={t('reservationFilter')} className={inputClass} value={filter} onChange={e => setFilter(e.target.value)}>{['all','upcoming','current','conflict','confirmed','tentative','cancelled','archived'].map(f=><option key={f} value={f}>{t(f as 'all'|'upcoming'|'current'|'conflict'|'confirmed'|'tentative'|'cancelled'|'archived')}</option>)}</select>}</div>
 {mode==='reservations' && <div className="space-y-1.5">{primaryResults.map(renderReservation)}
 {secondaryResults.length > 0 && <div className="pt-3"><button type="button" aria-expanded={olderOpen} aria-controls="older-reservations" className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-3 text-left text-sm font-semibold text-slate-600" onClick={()=>setOlderOpen(open=>!open)}><span aria-hidden="true">{olderOpen ? '⌄' : '›'}</span>{t('olderReservations')} ({secondaryResults.length})</button>{olderOpen && <div id="older-reservations" className="mt-2 space-y-1.5">{secondaryResults.map(renderReservation)}</div>}</div>}
 {!loading && !results.length && <p>{t('noReservations')}</p>}</div>}
 {mode==='guests' && <div className="grid gap-4 md:grid-cols-2"><div>{guests.filter(g=>`${g.name} ${g.email} ${g.phone}`.toLowerCase().includes(query.toLowerCase()) && (!property || bookings.some(r=>r.guest_id===g.id && r.property_id===property))).map(g=><button key={g.id} className="mb-2 block w-full rounded-2xl bg-white p-4 text-left" onClick={()=>setSelected(g.id)}>{g.name}<small className="block">{g.email} · {g.phone}</small></button>)}</div>{guest && <article className="rounded-2xl bg-white p-5"><h2 className="text-2xl">{guest.name}</h2><p>{guest.country} · {guest.language}</p><p>{guest.phone}</p><p>{guest.email}</p><p>{guest.notes}</p><h3 className="mt-4 font-semibold">{stays.length} {t('stays')} {stays.filter(r=>r.check_in.slice(0,10)<=today).length>1 ? `· ${t('repeatGuest')}` : ''}</h3>{stays.map(r=><Link className="mt-3 block" key={r.id} to={`/edit-reservation/${r.id}`}>{formatDateRange(r.check_in,r.check_out)} · {propertyName(r.property_id)} · {translateValue(language,r.source)}</Link>)}</article>}</div>}
 {(mode==='blocks' || mode==='tasks') && editable && <form className="flex flex-wrap gap-3 rounded-2xl bg-white p-4" onSubmit={e=>{e.preventDefault(); if(!property){setError(t('selectPropertyFirst'));return} void mutate(async()=>{if(mode==='blocks') await saveBlock({property_id:property,start_date:start,end_date:end,reason,notes}); else await saveTask({property_id:property,kind,title:notes,start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),status:'pending'})})}}><input aria-label={t('from')} required type={mode==='blocks'?'date':'datetime-local'} className={inputClass} value={start} onChange={e=>setStart(e.target.value)}/><input aria-label={t('until')} required type={mode==='blocks'?'date':'datetime-local'} className={inputClass} value={end} onChange={e=>setEnd(e.target.value)}/><select aria-label={t('type')} className={inputClass} value={mode==='blocks'?reason:kind} onChange={e=>mode==='blocks'?setReason(e.target.value):setKind(e.target.value)}>{(mode==='blocks'?blockReasons:taskKinds).map(r=><option key={r} value={r}>{translateValue(language,r)}</option>)}</select><input aria-label={t('description')} required={mode==='tasks'} placeholder={t('description')} className={inputClass} value={notes} onChange={e=>setNotes(e.target.value)}/><button disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2 text-white">{mode==='blocks'?t('blockDates'):t('createTask')}</button></form>}
 {mode==='blocks' && blocks.filter(b=>(!property||b.property_id===property)&&`${b.reason} ${b.notes}`.toLowerCase().includes(query.toLowerCase())).map(b=><article key={b.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4"><div><strong>{propertyName(b.property_id)} · {translateValue(language,b.reason)}</strong><p>{formatDate(b.start_date)} → {formatDate(b.end_date)} ({t('availableAgainShort')})</p><p>{b.notes}</p></div>{editable && <button className="shrink-0 rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700" disabled={busy} onClick={()=>{if(window.confirm(t('removeBlockConfirm'))) void mutate(()=>removeBlock(b.id))}}>{t('unblock')}</button>}</article>)}
 {mode==='tasks' && tasks.filter(task=>(!property||task.property_id===property)&&`${task.kind} ${task.title}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.start_time.localeCompare(b.start_time)).map(task=><article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"><div><strong>{propertyName(task.property_id)} · {translateValue(language,task.kind)}</strong><p>{task.title}</p><small>{new Date(task.start_time).toLocaleString(language==='hr'?'hr-HR':'en-GB')} – {new Date(task.end_time).toLocaleString(language==='hr'?'hr-HR':'en-GB')}</small></div><select aria-label={`${t('status')} ${task.title}`} disabled={busy||role==='viewer'} className={inputClass} value={task.status} onChange={e=>void mutate(()=>setTaskStatus(task.id,e.target.value))}>{['pending','in_progress','done'].map(s=><option key={s} value={s}>{translateValue(language,s)}</option>)}</select></article>)}
 </section>
}

