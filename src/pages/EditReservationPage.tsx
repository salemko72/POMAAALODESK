import { canEditReservation, type UserRole } from '../lib/permissions'
import { requestOverbookOverride } from '../lib/overbook-override'
import { BookingAvailability } from '../components/BookingAvailability'
import { ReservationAttribution } from '../components/ReservationAttribution'
import { useAppLanguage } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileText, Trash2, UserRound, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { DatePicker } from '../components/DatePicker'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { NightCountBadge } from '../components/NightCountBadge'
import { getProperties, type Property } from '../lib/properties-repository'
import { deleteReservation, getReservation, getReservations, updateReservation, type Reservation } from '../lib/reservations-repository'
import { findBookingConflict } from '../lib/reservation-form'
import { formatDateInput, formatDateRange } from '../lib/date-format'
import { useT } from '../lib/i18n'
import { StayExtras } from '../components/StayExtras'
import { emptyExtras } from '../lib/stay-extra-values'
import { listGuests, saveGuest } from '../lib/operations'

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EditReservationPage({ role = 'viewer' }: { role?: UserRole } = {}) {
  const t = useT()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [checkIn, setCheckIn] = useState(todayString())
  const [checkOut, setCheckOut] = useState(todayString())
  const [guestName, setGuestName] = useState('')
  const [source, setSource] = useState<'direct' | 'agency'>('direct')
  const [notes, setNotes] = useState('')
  const [extras,setExtras] = useState(emptyExtras)
  const [contactReady,setContactReady] = useState(false)

  useEffect(() => {
    let mounted = true
    if (!id) return
    Promise.all([getReservation(id), getProperties()]).then(([item, propertyData]) => {
      if (!mounted) return
      setReservation(item)
      setProperties(propertyData)
      setSelectedPropertyId(item.property_id)
      setCheckIn(item.check_in.slice(0, 10))
      setCheckOut(item.check_out.slice(0, 10))
      setGuestName(item.guest_name)
      setSource(item.source === 'agency' ? 'agency' : 'direct')
      setNotes(item.notes ?? '')
      setExtras({...emptyExtras,guest_id:item.guest_id??'',adults:item.adults??item.guests,children:item.children??0,arrival_time:item.arrival_time??'',special_request:item.special_request??'',nightly_rate:item.nightly_rate?.toString()??''})
      if(!item.guest_id) setContactReady(true)
      else void listGuests().then(items=>{const g=items.find(g=>g.id===item.guest_id);if(!g)throw new Error('Contact unavailable');if(mounted){setExtras(current=>({...current,email:g.email,phone:g.phone,language:g.language,country:g.country,guest_notes:g.notes}));setContactReady(true)}}).catch(()=>{if(mounted)setError(t('unableLoadGuestContact'))})
    }).catch(() => {
      if (mounted) setError(t('unableLoadReservation'))
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [id, t])

  const property = useMemo(() => properties.find((item) => item.id === selectedPropertyId), [properties, selectedPropertyId])
  const hr=useAppLanguage()==='hr'
  const imported = ['airbnb','booking','airbnb_ical','booking_ical','other_ical'].includes(reservation?.source ?? '')
  const readOnly = !canEditReservation(role) || imported

  async function save() {
    if (imported || !canEditReservation(role) || !contactReady || !reservation || !property || !selectedPropertyId) return
    if(extras.nightly_rate!=='' && (!Number.isFinite(Number(extras.nightly_rate)) || Number(extras.nightly_rate)<0)){setError(t('validNightlyRate'));return}
    setError(null); setMessage(null)
    if (!guestName.trim()) { setError(t('enterGuestName')); return }
    if (checkOut <= checkIn) { setError(t('checkOutAfterCheckIn')); return }
    if (!Number.isInteger(extras.adults) || !Number.isInteger(extras.children) || extras.adults < 1 || extras.children < 0 || extras.adults + extras.children > property.capacity) { setError(t('propertyGuestLimit',{count:property.capacity})); return }

    setSaving(true)
    try {
      const current = await getReservations(`${checkIn}T00:00:00`, `${checkOut}T23:59:59.999`)
      const values = { propertyId: selectedPropertyId, checkIn, checkOut, guestName, guests: extras.adults + extras.children, source, notes }
      let overrideReason:string|null=null
      if (findBookingConflict(current.filter((item) => item.id !== reservation.id), values)) {
        overrideReason=requestOverbookOverride(role,hr)
        if(!overrideReason){setError(t('overlappingBooking'));return}
      }
      const saved = await updateReservation(reservation.id, {
        guest_id: (await saveGuest({id:extras.guest_id||undefined,name:guestName.trim(),email:extras.email,phone:extras.phone,language:extras.language,country:extras.country,notes:extras.guest_notes})).id,
        adults:extras.adults,children:extras.children,arrival_time:extras.arrival_time||null,special_request:extras.special_request,nightly_rate:extras.nightly_rate===''?null:Number(extras.nightly_rate),
        property_id: selectedPropertyId,
        guest_name: guestName.trim(),
        check_in: imported ? reservation.check_in : new Date(`${checkIn}T${property.check_in_time.slice(0, 5)}:00`).toISOString(),
        check_out: imported ? reservation.check_out : new Date(`${checkOut}T${property.check_out_time.slice(0, 5)}:00`).toISOString(),
        guests:extras.adults+extras.children,
        source: imported ? (reservation.source as 'airbnb' | 'booking') : source,
        status: reservation.status as 'tentative' | 'confirmed' | 'cancelled',
        notes: notes.trim() || null,
      },overrideReason??undefined)
      setReservation(saved)
      setMessage(t('reservationUpdated'))
    } catch {
      setError(t('unableSaveReservation'))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (readOnly || !reservation) return
    if (!window.confirm(t('deleteReservationConfirm',{name:reservation.guest_name}))) return
    setDeleting(true)
    setError(null)
    try {
      await deleteReservation(reservation.id)
      navigate('/calendar')
    } catch {
      setError(t('unableDeleteReservation'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <section className="mx-auto max-w-3xl p-4 md:p-5"><p className="text-xs text-slate-500">{t('loading')}</p></section>
  if (!reservation) return <section className="mx-auto max-w-3xl p-4 md:p-5"><div role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error || t('reservationNotFound')}</div></section>

  return <section className="mx-auto max-w-3xl p-3 pb-8 md:p-5">
    <header className="mb-4 flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('reservations')}</p><h1 className="mt-1 text-3xl font-semibold sm:text-4xl tracking-tight">{readOnly ? t('reservationDetails') : t('editReservation')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{formatDateRange(`${checkIn}T12:00:00`, `${checkOut}T12:00:00`)}</p></div>
      <button type="button" aria-label={t('close')} onClick={() => navigate('/calendar')} className="rounded-xl p-2 text-slate-400 hover:bg-white"><X size={18}/></button>
    </header>

    {error && <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>}
    {message && <div role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">{message}</div>}

    <section className="relative z-30 rounded-[1.35rem] bg-white p-4">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={17} className="text-violet-500"/>{t('stay')}</div><NightCountBadge start={checkIn} end={checkOut} /></div>
      <label className="mt-3 block text-[11px] font-semibold text-slate-600">{t('properties')}
        <select disabled={readOnly} aria-label={t('properties')} value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
          {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-[11px] font-semibold text-slate-600">{t('checkIn')}{readOnly ? <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-500">{formatDateInput(checkIn)}</div> : <DatePicker label={t('checkIn')} value={checkIn} onChange={setCheckIn}/>}</label>
        <label className="text-[11px] font-semibold text-slate-600">{t('checkOut')}{readOnly ? <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-500">{formatDateInput(checkOut)}</div> : <DatePicker label={t('checkOut')} value={checkOut} onChange={setCheckOut}/>}</label>
      </div>
      {property && <BookingAvailability property={property} start={checkIn} end={checkOut} exclude={id}/>}
      {reservation && <ReservationAttribution reservation={reservation} hr={hr}/>}
    </section>

    <section className="relative z-20 mt-3 rounded-[1.35rem] bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-violet-500"/>{t('guest')}</div>
      <StayExtras embedded value={extras} onChange={setExtras} start={checkIn} end={checkOut} guestName={guestName} source={source} onSourceChange={setSource} onGuestName={setGuestName} disabled={readOnly||!contactReady}/>
    </section>

    <section className="relative z-10 mt-3 rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold"><FileText size={17} className="text-violet-500"/>{t('notes')}</div><textarea disabled={readOnly} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"/></section>

    {imported && <p className="mt-2 text-[10px] text-slate-400">{t('importedReservationHint',{source:reservation.source === 'airbnb' ? 'Airbnb' : 'Booking.com'})}</p>}

    {!readOnly&&<div className="mt-3 flex gap-2"><button type="button" disabled={saving||deleting} onClick={()=>void save()} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-xs font-semibold text-white disabled:opacity-60">{saving?t('saving'):t('saveChanges')}</button>{!imported && <button type="button" aria-label={t('deleteProperty')} disabled={saving||deleting} onClick={()=>void remove()} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"><Trash2 size={15}/></button>}</div>}
  </section>
}
