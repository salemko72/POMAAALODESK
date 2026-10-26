import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useIcalSync, type Overlap } from '../lib/ical-sync-context'
import { useAppLanguage } from '../lib/i18n'
import { formatDateRange } from '../lib/date-format'
import { useOptionalAgency } from '../lib/agency-context'

export function IcalSyncStatus({ compact = false }: { compact?: boolean }) {
  const { calendars, busy, error, sync } = useIcalSync()
  const hr = useAppLanguage() === 'hr'
  if (!compact && !calendars.length && !error) return null
  if (compact) {
    const failed = calendars.filter(c => c.sync_status === 'error').length
    const synced = calendars.filter(c => c.sync_status === 'success').length
    return <div className="ml-auto w-fit max-w-full px-3 py-1 text-[9px] text-slate-600"><div className="flex items-center gap-2 whitespace-nowrap"><button type="button" disabled={busy} onClick={()=>void sync(true)} aria-label={hr?'Osvježi iCal':'Refresh iCal'} title={hr?'Osvježi iCal':'Refresh iCal'} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-violet-600 hover:bg-violet-50 disabled:opacity-50"><RefreshCw size={11} className={busy?'animate-spin':''}/></button><span className="font-semibold">iCal</span><span>{synced}/{calendars.length} {hr?'sinhr.':'synced'}</span>{failed>0 && <span className="font-semibold text-rose-600">{failed} {hr?'greška':'error'}</span>}<span className="text-slate-400">· 15 min</span></div></div>
  }
  return <div className="my-3 text-xs text-slate-600"><div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={()=>void sync(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-semibold disabled:opacity-50"><RefreshCw size={14} className={busy?'animate-spin':''}/>{busy ? (hr?'Osvježavam…':'Syncing…') : (hr?'Sinhroniziraj sada':'Sync now')}</button><span>{hr?'iCal · automatski svakih 15 min':'iCal · automatic every 15 min'}</span></div>{error && <p role="alert" className="mt-2 text-rose-700">{hr?'Osvježavanje nije potpuno. Zadržani su prethodni podaci; provjeri stanje linkova.':error}</p>}<details className="mt-2"><summary className="cursor-pointer">{hr?'Stanje povezanih kalendara':'Connected calendar status'}</summary><div className="mt-2 space-y-2">{calendars.map(c=><div key={c.id} className="rounded-lg bg-white/80 p-2"><strong>{c.property_name} · {c.source.replace('_ical','')}</strong> · {c.sync_status} · {c.event_count} {hr?'stavki':'items'}<span className="block">{c.last_synced_at ? new Date(c.last_synced_at).toLocaleString(hr?'hr-HR':'en-GB') : hr?'Još nije sinhronizirano':'Not synced yet'}{c.sync_error && <span className="block text-rose-700">{c.sync_error}</span>}</span></div>)}</div></details></div>
}

export function OverbookAlerts({ compact = false, includePast = false }: { compact?: boolean; includePast?: boolean }) {
  const { overlaps, acknowledge } = useIcalSync()
  const agency = useOptionalAgency(), hr = useAppLanguage() === 'hr'
  const [error, setError] = useState(''), [pending, setPending] = useState('')
  const today = new Date().toLocaleDateString('en-CA')
  const active = overlaps.filter(o=>!o.acknowledged && (includePast || o.overlap_end>today)).sort((a,b)=>a.overlap_start.localeCompare(b.overlap_start))
  const linked = overlaps.filter(o=>o.acknowledged && (includePast || o.overlap_end>today))
  const editable = !!agency && ['owner','admin','manager'].includes(agency.role)
  async function confirm(o: Overlap, reopen = false) {
    if (!window.confirm(hr ? (reopen?'Ponovno uključi upozorenje?':'Potvrđuješ da oba zapisa predstavljaju istu rezervaciju?') : (reopen?'Restore this alert?':'Confirm that both entries represent the same reservation?'))) return
    setPending(o.a_id+o.b_id);setError('')
    try { await acknowledge(o,reopen) } catch { setError(hr?'Promjena nije spremljena.':'Could not save this change.') } finally { setPending('') }
  }
  if (!active.length && !linked.length) return null
  return <section aria-label="Overbooking alerts" className="my-4 space-y-2">{!!active.length && <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={19}/>{hr?'Potrebna provjera':'Needs attention'} · {active.length} {hr?'preklapanja':'overlap(s)'}</p><div className="mt-3 space-y-3">{(compact?active.slice(0,3):active).map(o=><article key={o.a_id+o.b_id} className="rounded-xl border border-rose-200 bg-white/80 p-3 text-xs"><strong className="block text-rose-700">{o.possible ? (hr?'MOGUĆI OVERBOOK':'POSSIBLE OVERBOOK'):'OVERBOOK'} · {o.property_name}</strong><p className="mt-1 font-semibold">{formatDateRange(o.overlap_start,o.overlap_end)} · {Math.round((Date.parse(o.overlap_end)-Date.parse(o.overlap_start))/86400000)} {hr?'noćenja':'night(s)'}</p><p className="mt-1">{o.a_name} ({o.a_source}) / {o.b_name} ({o.b_source})</p><div className="mt-2 flex flex-wrap gap-3"><Link className="font-bold underline" to={`/calendar?reservation=${o.a_source==='block'?o.b_id:o.a_id}`}>{hr?'Prikaži u kalendaru':'Show in calendar'}</Link>{editable && o.can_link && <button disabled={!!pending} type="button" className="font-semibold underline" onClick={()=>void confirm(o)}>{hr?'Ista rezervacija':'Same reservation'}</button>}</div></article>)}</div>{compact && <Link className="mt-3 inline-block text-xs font-bold underline" to="/reservations">{hr?'Pregledaj sve':'Review all'}</Link>}</div>}{!compact && !!linked.length && <details className="rounded-xl bg-white/80 p-3 text-xs"><summary>{hr?'Potvrđeni isti boravci':'Confirmed same stays'} ({linked.length})</summary>{linked.map(o=><div key={o.a_id+o.b_id} className="mt-2">{o.property_name} · {formatDateRange(o.overlap_start,o.overlap_end)} {editable && <button disabled={!!pending} className="ml-2 underline" onClick={()=>void confirm(o,true)}>{hr?'Vrati upozorenje':'Restore alert'}</button>}</div>)}</details>}{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}</section>
}
