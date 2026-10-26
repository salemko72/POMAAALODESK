import { useEffect, useState } from 'react'
import { listGuests, type Guest } from '../lib/operations'
import { stayNights, stayTotal } from '../lib/stay-calculations'
import { ArrivalTimeInput } from './ArrivalTimeInput'
import { useT } from '../lib/i18n'

import { emptyExtras,type StayExtraValues } from '../lib/stay-extra-values'
export function StayExtras({ value, onChange, start, end, onGuestName, guestName, source, onSourceChange, disabled = false, defaultRate = null, currency = 'EUR', embedded = false }: { value: StayExtraValues; onChange: (v: StayExtraValues) => void; start: string; end: string; onGuestName: (name: string) => void; guestName?: string; source?: 'direct' | 'agency'; onSourceChange?: (source: 'direct' | 'agency') => void; disabled?: boolean; defaultRate?: number | null; currency?: string; embedded?: boolean }) {
 const t = useT()
 const [guests, setGuests] = useState<Guest[]>([])
 const [error, setError] = useState('')
 const [search,setSearch] = useState('')
 useEffect(() => { listGuests().then(setGuests).catch(() => setError(t('guestContactsUnavailable'))) }, [t])
 function select(id: string) { const g = guests.find(g => g.id === id); onChange(g ? { ...value, guest_id: id, email: g.email, phone: g.phone, country: g.country, language: g.language, guest_notes: g.notes } : { ...value, guest_id: '' }); if (g) onGuestName(g.name) }
 const fieldLabels = {email:t('email'),phone:t('phone'),language:t('guestLanguage'),country:t('country'),guest_notes:t('guestNotes'),special_request:t('specialRequest'),adults:t('adults'),children:t('children')}
 return <fieldset disabled={disabled} className={`${embedded ? 'mt-3' : 'mt-3 rounded-3xl bg-white p-4'} space-y-3 [&_input]:border-slate-200 [&_input]:text-sm [&_label]:text-xs [&_label]:text-slate-600`}>
 {error && <p role="alert">{error}</p>}
 <label className="block text-sm font-semibold">{t('guest')}<input type="search" placeholder={t('guestSearchPlaceholder')} className="mt-1 block w-full rounded-xl border p-2 font-normal" value={guestName ?? search} onChange={e=>{if(guestName!==undefined){onGuestName(e.target.value);if(value.guest_id)onChange({...value,guest_id:''})}else setSearch(e.target.value)}}/></label>
 {(guestName ?? search) && !value.guest_id && <div className="max-h-40 overflow-y-auto rounded-xl border bg-white">{guests.filter(g=>`${g.name} ${g.email} ${g.phone}`.toLowerCase().includes((guestName ?? search).toLowerCase())).slice(0,10).map(g=><button type="button" className="block w-full border-b border-slate-100 p-2 text-left last:border-0 hover:bg-violet-50" key={g.id} onClick={()=>{select(g.id);setSearch('')}}><strong className="block">{g.name}</strong><span className="text-xs text-slate-500">{t('existingGuest')} · {g.email||g.phone||g.country}</span></button>)}</div>}
 {value.guest_id && <p className="text-sm text-violet-700">{t('existingContactSelected')} <button type="button" onClick={()=>onChange({...emptyExtras,adults:value.adults,children:value.children,arrival_time:value.arrival_time,special_request:value.special_request,nightly_rate:value.nightly_rate})}>{t('useNewContact')}</button></p>}
 <div className="grid gap-3 sm:grid-cols-2">
  <label className="text-sm">{t('adults')}<input aria-label={t('adults')} className="mt-1 block w-full rounded-xl border p-2" type="number" min={1} value={value.adults} onChange={e=>onChange({...value,adults:Number(e.target.value)})}/></label>
  <label className="text-sm">{t('children')}<input aria-label={t('children')} className="mt-1 block w-full rounded-xl border p-2" type="number" min={0} value={value.children} onChange={e=>onChange({...value,children:Number(e.target.value)})}/></label>
  {source !== undefined && onSourceChange && <label className="text-sm">{t('source')}<select aria-label={t('source')} value={source} onChange={e=>onSourceChange(e.target.value as 'direct'|'agency')} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option value="direct">{t('directManual')}</option><option value="agency">{t('agency')}</option></select></label>}
  <ArrivalTimeInput value={value.arrival_time} onChange={arrival_time => onChange({ ...value, arrival_time })}/>
  {(['email','phone','language','country','guest_notes','special_request'] as const).map(key => <label key={key} className="text-sm">{fieldLabels[key]}<input className="mt-1 block w-full rounded-xl border p-2" type={key === 'email' ? 'email' : 'text'} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}/></label>)}
 </div>
 <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-3"><label className="text-sm font-bold text-slate-900">{t('nightlyRate')} ({currency})<input aria-label={t('nightlyRate')} className="mt-2 block w-full rounded-xl border border-violet-200 bg-white p-2.5 text-base font-bold" type="number" min={0} step="0.01" value={value.nightly_rate} placeholder={defaultRate == null ? '' : String(defaultRate)} onChange={e=>onChange({...value,nightly_rate:e.target.value})}/></label><p className="mt-2 font-semibold">{stayNights(start,end)} {stayNights(start,end) === 1 ? t('nightLabel') : t('nightsLabel')} · {t('total')}: {(value.nightly_rate === '' && defaultRate == null) ? '—' : stayTotal(start,end,value.nightly_rate === '' ? Number(defaultRate) : Number(value.nightly_rate)).toFixed(2)}</p></div>
 </fieldset>
}
