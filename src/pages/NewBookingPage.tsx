import { requestOverbookOverride } from '../lib/overbook-override'
import { useOptionalAgency } from '../lib/agency-context'
import { useIcalSync } from '../lib/ical-sync-context'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, FileText, UserRound, UsersRound } from 'lucide-react'
import { DatePicker } from '../components/DatePicker'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { NightCountBadge } from '../components/NightCountBadge'
import { useNavigate } from 'react-router-dom'
import { getProperties, type Property } from '../lib/properties-repository'
import { getReservations, type Reservation } from '../lib/reservations-repository'
import { createReservationWithCleaning } from '../lib/booking-workflow'
import { findBookingConflict, isBookingDateUnavailable, validateBookingForm, type BookingFormValues } from '../lib/reservation-form'
import { formatDateRange } from '../lib/date-format'
import { useT, useAppLanguage } from '../lib/i18n'
import { StayExtras } from '../components/StayExtras'
import { emptyExtras } from '../lib/stay-extra-values'
import { saveGuest, listBlocks, overlapsBlock } from '../lib/operations'
import { PropertyTimeline } from '../components/PropertyTimeline'
import { BlockDatesDialog } from '../components/BlockDatesDialog'

function todayString() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function addDays(value:string,days:number){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const initial: BookingFormValues = { propertyId:'', checkIn:todayString(), checkOut:todayString(), guestName:'', guests:1, source:'direct', notes:'' }

export function NewBookingPage() {
  const agency=useOptionalAgency(), hr=useAppLanguage()==='hr', {revision}=useIcalSync()
  const [extras,setExtras] = useState(emptyExtras)
  const [blocking,setBlocking] = useState(false)
  const [checkingAvailability,setCheckingAvailability] = useState(false)
  const [availabilityError,setAvailabilityError] = useState<string|null>(null)
  const [timelineReservations,setTimelineReservations] = useState<Reservation[]>([])
  const t=useT(); const navigate=useNavigate(); const [properties,setProperties]=useState<Property[]>([]); const [form,setForm]=useState<BookingFormValues>(initial); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null); const [message,setMessage]=useState<string|null>(null)
  useEffect(()=>{getProperties().then(items=>{setProperties(items);setForm(current=>({...current,propertyId:current.propertyId||items[0]?.id||''}));setLoading(false)}).catch(()=>{setError(t('unableLoadProperties'));setLoading(false)})},[t])
  const selectedProperty=useMemo(()=>properties.find(p=>p.id===form.propertyId),[properties,form.propertyId])
  useEffect(()=>{
    setExtras(current=>({...current,nightly_rate:selectedProperty?.nightly_rate == null ? '' : String(selectedProperty.nightly_rate)}))
  },[selectedProperty?.id, selectedProperty?.nightly_rate])
  useEffect(()=>{
    let active=true
    if(!form.propertyId||!form.checkIn||!form.checkOut)return()=>{active=false}
    const first=form.checkIn<form.checkOut?form.checkIn:form.checkOut
    const selectedLast=form.checkIn>form.checkOut?form.checkIn:form.checkOut
    const timelineLast=addDays(form.checkIn,29)
    const last=selectedLast>timelineLast?selectedLast:timelineLast
    Promise.all([getReservations(`${first}T00:00:00`,`${last}T23:59:59.999`),listBlocks()]).then(([items,blocks])=>{
      if(!active)return
      setTimelineReservations(items)
      const unavailable=form.checkOut>form.checkIn
        ? findBookingConflict(items,{propertyId:form.propertyId,checkIn:form.checkIn,checkOut:form.checkOut,guestName:'',guests:1,source:'direct',notes:''})
        : isBookingDateUnavailable(items,form.propertyId,form.checkIn,'checkIn')||isBookingDateUnavailable(items,form.propertyId,form.checkOut,'checkOut')
      setAvailabilityError((unavailable||blocks.some(b=>overlapsBlock(b,form.propertyId,form.checkIn,form.checkOut)))?t('overlappingBooking'):null)
    }).catch(()=>{if(active){setAvailabilityError(hr?'Nije moguće provjeriti zauzetost.':'Unable to verify availability.');setTimelineReservations([])}}).finally(()=>{if(active)setCheckingAvailability(false)})
    return()=>{active=false}
  },[form.propertyId,form.checkIn,form.checkOut,t,revision,hr])
  function update<K extends keyof BookingFormValues>(key:K,value:BookingFormValues[K]){setForm(current=>({...current,[key]:value}))}
  function updateBookingDate(key:'checkIn'|'checkOut',value:string){setCheckingAvailability(true);setAvailabilityError(null);update(key,value)}
  async function handleSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError(null);setMessage(null);const validationError=validateBookingForm({...form,guests:extras.adults+extras.children},selectedProperty);if(validationError){const translated=validationError==='Select a property.'?t('selectProperty'):validationError==='Select a check-in date.'?t('selectCheckIn'):validationError==='Select a check-out date.'?t('selectCheckOut'):validationError==='Check-out must be after check-in.'?t('checkOutAfterCheckIn'):validationError==='Enter the guest name.'?t('enterGuestName'):validationError==='Guests must be at least 1.'?t('guestsAtLeastOne'):validationError.startsWith('This property allows')?t('propertyGuestLimit',{count:selectedProperty?.capacity??0}):validationError;setError(translated);return}setSaving(true);try{const [reservations,blocks]=await Promise.all([getReservations(`${form.checkIn}T00:00:00`,`${form.checkOut}T23:59:59.999`),listBlocks()]);let overrideReason:string|null=null;if(findBookingConflict(reservations,form)||blocks.some(b=>overlapsBlock(b,form.propertyId,form.checkIn,form.checkOut))){overrideReason=requestOverbookOverride(agency?.role??'viewer',hr);if(!overrideReason){setError(t('overlappingBooking'));return}}if(!selectedProperty){setError(t('selectProperty'));return}
    const guest = await saveGuest({id:extras.guest_id||undefined,name:form.guestName.trim(),email:extras.email,phone:extras.phone,language:extras.language,country:extras.country,notes:extras.guest_notes})
    setExtras(current=>({...current,guest_id:guest.id}))
    await createReservationWithCleaning({overbook_override_reason:overrideReason??undefined,guest_id:guest.id,adults:extras.adults,children:extras.children,arrival_time:extras.arrival_time||null,special_request:extras.special_request,nightly_rate:extras.nightly_rate===''?(selectedProperty.nightly_rate ?? null):Number(extras.nightly_rate),property_id:form.propertyId,source:form.source,guest_name:form.guestName.trim(),check_in:new Date(`${form.checkIn}T${selectedProperty.check_in_time.slice(0,5)}:00`).toISOString(),check_out:new Date(`${form.checkOut}T${selectedProperty.check_out_time.slice(0,5)}:00`).toISOString(),guests:extras.adults+extras.children,status:'confirmed',notes:form.notes.trim()||null},selectedProperty.cleaning_duration_minutes);setMessage(t('bookingCreated'));setTimeout(()=>navigate('/calendar'),500)}catch{setError(t('unableCreateBooking'))}finally{setSaving(false)}}
  if(loading)return <section className="mx-auto max-w-3xl p-3 md:p-5"><p className="text-xs text-slate-500">{t('loading')}</p></section>
  return <section className="mx-auto max-w-3xl p-3 pb-8 md:p-5"><header className="mb-4"><button type="button" className="float-right mt-5 rounded-xl bg-slate-800 px-4 py-2 text-white" onClick={()=>setBlocking(true)}>{t('blockDates').toUpperCase()}</button><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('reservations')}</p><h1 className="mt-1 text-[2.938rem] font-light leading-[.95] sm:text-[3.7rem] tracking-tight">{t('newBooking')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{t('createBookingDescription')}</p></header>{blocking && <BlockDatesDialog properties={properties} propertyId={form.propertyId} start={form.checkIn} end={form.checkOut} onClose={()=>setBlocking(false)}/>}<form onSubmit={handleSubmit} className="space-y-3">
    <section className="relative z-30 rounded-[1.35rem] bg-white p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={17} className="text-violet-500"/>{t('stay')}</div><NightCountBadge start={form.checkIn} end={form.checkOut} /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-[11px] font-semibold text-slate-600 md:col-span-2">{t('properties')}<select id="property" value={form.propertyId} onChange={e=>{setCheckingAvailability(true);setAvailabilityError(null);update('propertyId',e.target.value)}} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-bold outline-none focus:border-violet-400">{properties.map(property=><option className="text-base font-bold" key={property.id} value={property.id}>{property.name} · {property.capacity}</option>)}</select></label>
      <label className="text-[11px] font-semibold text-slate-600">{t('checkIn')}<DatePicker label={t('checkIn')} value={form.checkIn} onChange={(value)=>updateBookingDate('checkIn',value)}/></label>
      <label className="text-[11px] font-semibold text-slate-600">{t('checkOut')}<DatePicker label={t('checkOut')} value={form.checkOut} onChange={(value)=>updateBookingDate('checkOut',value)}/></label>
    </div>{checkingAvailability&&<p aria-live="polite" className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">{t('checkingAvailability')}</p>}{availabilityError&&<p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{availabilityError}</p>}<p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">{formatDateRange(`${form.checkIn}T12:00:00`,`${form.checkOut}T12:00:00`)}</p>{selectedProperty&&<PropertyTimeline property={selectedProperty} reservations={timelineReservations} startDate={form.checkIn}/>}</section>
    <section className="relative z-20 rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-violet-500"/>{t('guest')}</div><StayExtras embedded value={extras} onChange={setExtras} start={form.checkIn} end={form.checkOut} guestName={form.guestName} source={form.source} onSourceChange={source=>update('source',source)} defaultRate={selectedProperty?.nightly_rate} currency={selectedProperty?.currency ?? 'EUR'} onGuestName={name=>update('guestName',name)}/></section>
    <section className="relative z-10 rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold"><FileText size={17} className="text-violet-500"/>{t('notes')}</div><textarea id="notes" rows={3} value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder={t('optionalNotes')} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"/></section>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>}{message&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">{message}</div>}
    <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"><UsersRound size={15}/>{saving?t('creatingBooking'):t('createBooking')}</button>
  </form></section>
}
