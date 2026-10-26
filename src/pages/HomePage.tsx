import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Brush, CalendarDays, LogIn, LogOut, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { buildDailyOperationalSummary, type DailyOperationalSummary } from '../lib/operational-data'
import { getDailyOperationalData } from '../lib/operational-repository'
import { getProperties, type Property } from '../lib/properties-repository'
import { formatDate } from '../lib/date-format'
import { signOut, getCurrentSession } from '../lib/auth-supabase'
import { useT } from '../lib/i18n'
import { getProfile } from '../lib/profiles-repository'
import { getSettings } from '../lib/settings'
import { OverbookAlerts } from '../components/OverbookAlerts'
import { useIcalSync } from '../lib/ical-sync-context'
import { stayNights } from '../lib/stay-calculations'

type HomePageProps = { onLogout?: () => void }
type HomeEvent = { id: string; reservationId?: string; kind: 'arrival' | 'departure' | 'cleaning'; time: string; propertyId: string; guestName?: string; guests?: number; nights?: number; status: string }

const emptySummary: DailyOperationalSummary = { checkIns: [], checkOuts: [], cleanings: [] }
const fallbackImages: Record<string, string> = {
  Priko: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=180&h=180&fit=crop',
  Nelly: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=180&h=180&fit=crop',
  Pjaca: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=180&h=180&fit=crop',
}
function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return dateString(date)
}
function timeLabel(value: string, language: 'en' | 'hr') {
  return new Intl.DateTimeFormat(language === 'hr' ? 'hr-HR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
function buildEvents(summary: DailyOperationalSummary): HomeEvent[] {
  return [
    ...summary.checkIns.map((reservation) => ({ id: `arrival-${reservation.id}`, reservationId: reservation.id, kind: 'arrival' as const, time: reservation.check_in, propertyId: reservation.property_id, guestName: reservation.guest_name, guests: reservation.guests, nights: stayNights(reservation.check_in, reservation.check_out), status: 'Arriving' })),
    ...summary.checkOuts.map((reservation) => ({ id: `departure-${reservation.id}`, reservationId: reservation.id, kind: 'departure' as const, time: reservation.check_out, propertyId: reservation.property_id, guestName: reservation.guest_name, guests: reservation.guests, nights: stayNights(reservation.check_in, reservation.check_out), status: 'Departing' })),
    ...summary.cleanings.map((cleaning) => ({ id: `cleaning-${cleaning.id}`, kind: 'cleaning' as const, time: cleaning.start_time, propertyId: cleaning.property_id, status: 'Cleaning' })),
  ].sort((a, b) => a.time.localeCompare(b.time))
}

function EventRow({ event, property, t, language }: { event: HomeEvent; property?: Property; t: (key: any) => string; language: 'en' | 'hr' }) {
  const icon = event.kind === 'arrival' ? <LogIn size={16} /> : event.kind === 'departure' ? <LogOut size={16} /> : <Brush size={16} />
  const badgeClass = event.kind === 'arrival' ? 'bg-emerald-50 text-emerald-700' : event.kind === 'departure' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
  const image = property?.image_url || (property?.name ? fallbackImages[property.name] : undefined)
  const content = <article data-testid={`home-event-${event.id}`} className="flex items-center gap-3 border-b border-[#ebe5dc] py-3 last:border-b-0 sm:gap-4">
    <div className="w-12 shrink-0"><p className="text-sm font-semibold tracking-tight text-slate-900">{timeLabel(event.time, language)}</p><p className="mt-0.5 text-[10px] text-slate-500">{event.kind === 'cleaning' ? t('cleaning') : event.kind === 'arrival' ? t('arrivals') : t('departures')}</p></div>
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">{image ? <img data-testid={`home-event-image-${event.id.replace(/^(arrival|departure|cleaning)-/, '')}`} src={image} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center text-violet-500">{event.kind === 'cleaning' ? <Brush size={17}/> : <CalendarDays size={17}/>}</div>}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{property?.name ?? t('properties')}</p>{event.kind === 'cleaning' ? <p className="mt-0.5 text-xs text-slate-500">{t('turnoverCleaning')}</p> : <><p className="truncate text-xs text-slate-600">{event.guestName}</p><p className="mt-1 flex items-center gap-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><UsersRound size={12}/>{event.guests} {t('guestsLabel')}</span><span>{event.nights} {t('nightsLabel')}</span></p></>}</div>
    <span className={`hidden shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-semibold sm:inline-flex ${badgeClass}`}>{icon}{event.kind === 'arrival' ? t('arriving') : event.kind === 'departure' ? t('departing') : t('cleaning')}</span>
    <ArrowRight size={16} className="shrink-0 text-slate-300" />
  </article>
  return event.reservationId ? <Link aria-label={`${event.guestName ?? t('reservations')} – ${t('editReservation')}`} className="block rounded-xl transition hover:bg-violet-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500" to={`/edit-reservation/${event.reservationId}`}>{content}</Link> : content
}

function DayPanel({ label, date, summary, properties, testId, t, language }: { label: string; date: string; summary: DailyOperationalSummary; properties: Property[]; testId: string; t: (key: any) => string; language: 'en' | 'hr' }) {
  const events = buildEvents(summary)
  const propertyById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties])
  return <section data-testid={testId} className="rounded-[1.6rem] border border-[#e5ded3] bg-white p-4 shadow-[0_8px_24px_rgba(76,62,45,0.035)] sm:p-5">
    <header className="mb-2 flex items-baseline justify-between gap-3"><div><h2 className={`${label === 'Tomorrow' ? 'text-2xl' : 'text-3xl'} font-semibold tracking-tight text-slate-900`}>{label}</h2><p className="mt-0.5 text-xs font-medium text-slate-500">{formatDate(new Date(`${date}T12:00:00`))}</p></div><span className="rounded-full bg-[#f6f1e9] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{events.length} {events.length === 1 ? 'event' : 'events'}</span></header>
    {events.length ? <div>{events.map((event) => <EventRow key={event.id} event={event} property={propertyById.get(event.propertyId)} t={t} language={language} />)}</div> : <div className="flex min-h-36 items-center justify-center rounded-2xl bg-[#fbfaf7] px-5 text-center"><div><CalendarDays size={20} className="mx-auto text-slate-300"/><p className="mt-2 text-sm font-semibold text-slate-700">{t('noEvents')}</p><p className="mt-1 text-xs text-slate-500">{t('nothingScheduled')}</p></div></div>}
  </section>
}

export function HomePage({ onLogout }: HomePageProps) {
  const { revision } = useIcalSync()
  const t = useT()
  const language = getSettings().language
  const [properties, setProperties] = useState<Property[]>([])
  const [summary, setSummary] = useState<DailyOperationalSummary>(emptySummary)
  const [tomorrowSummary, setTomorrowSummary] = useState<DailyOperationalSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [currentUser, setCurrentUser] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        let session = await getCurrentSession()
        if (!session) {
          await new Promise((resolve) => window.setTimeout(resolve, 250))
          session = await getCurrentSession()
        }
        if (!session) throw new Error('Your session is not ready yet. Please sign in again.')
        if (session.user?.id) { try { const profile = await getProfile(session.user.id); setCurrentUser(profile.full_name || session.user.email?.split('@')[0] || '') } catch { setCurrentUser(session.user.email?.split('@')[0] || '') } }
        const now = new Date()
        const today = dateString(now)
        const tomorrow = addDays(today, 1)
        const start = `${today}T00:00:00`
        const end = `${tomorrow}T23:59:59.999`
        const [operational, propertyData] = await Promise.all([
          getDailyOperationalData(start, end),
          getProperties(),
        ])
        if (!mounted) return
        setProperties(propertyData)
        setSummary(buildDailyOperationalSummary(operational.reservations, operational.cleanings, today))
        setTomorrowSummary(buildDailyOperationalSummary(operational.reservations, operational.cleanings, tomorrow))
        setError(null)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to load today’s data')
      } finally { if (mounted) setLoading(false) }
    }
    void load()
    return () => { mounted = false }
  }, [revision])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try { await signOut() } finally { setLoggingOut(false); onLogout?.() }
  }

  if (loading) return <section className="mx-auto max-w-6xl p-4 md:p-7"><p className="text-sm text-slate-500">Loading today...</p></section>
  if (error) return <section className="mx-auto max-w-6xl p-4 md:p-7"><div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-800">We couldn’t load your daily overview.</p><p className="mt-1 text-xs text-rose-700">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700">Try again</button></div></section>

  const cards = [
    [t('checkIns'), summary.checkIns.length, LogIn, 'check-ins', 'bg-sky-50 text-sky-600'],
    [t('checkOuts'), summary.checkOuts.length, LogOut, 'check-outs', 'bg-rose-50 text-rose-600'],
    [t('cleanings'), summary.cleanings.length, Brush, 'cleanings', 'bg-emerald-50 text-emerald-600'],
  ] as const
  const tomorrowDate = addDays(dateString(new Date()), 1)

  return <section className="mx-auto max-w-6xl p-4 pb-8 md:p-7">
    
    <header className="mb-5 flex items-start justify-between gap-4"><div><h1 className="text-[2.04rem] font-light leading-[.95] tracking-tight text-slate-900 md:text-[3.264rem]">{t('dailyOverview')}<AgencyTitleMark /></h1><p className="mt-2 text-base font-medium text-slate-700">{t('goodMorning').replace('Kate', currentUser || 'there')}</p><p className="mt-1 text-xs text-slate-500">{formatDate(new Date())}</p></div><button type="button" onClick={() => void handleLogout()} disabled={loggingOut} aria-label="Logout" title={t('logoutTitle')} className="flex shrink-0 flex-col items-center gap-1 text-[9px] font-semibold text-slate-500 disabled:opacity-50"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm hover:bg-slate-50"><LogOut size={18} strokeWidth={1.8}/></span><span>{loggingOut ? '…' : t('logout')}</span></button></header>

    <OverbookAlerts compact/>
    <div data-testid="home-summary-grid" className="grid w-full grid-cols-3 gap-2.5 sm:gap-3 lg:w-[calc(50%-0.625rem)]">{cards.map(([label, count, Icon, testName, iconClass]) => <div key={label} data-testid="home-summary-card" className="aspect-square rounded-[1.45rem] border border-[#e5ded3] bg-white p-2.5 shadow-[0_8px_24px_rgba(76,62,45,0.04)] sm:p-3.5"><div className="flex h-full flex-col justify-between"><span data-testid={`home-summary-icon-${testName}`} className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass} sm:h-11 sm:w-11`}><Icon size={19} strokeWidth={1.9}/></span><div><p data-testid={`home-summary-count-${testName}`} style={{fontFamily:'Montserrat, Arial, sans-serif'}} className="text-[3.375rem] font-light leading-none tracking-tight text-slate-900">{count}</p><p className="mt-0.5 text-[9px] font-medium text-slate-500 sm:text-[10px]">{label}</p></div></div></div>)}</div>

    <div data-testid="home-day-grid" className="mt-5 grid gap-4 lg:grid-cols-2 lg:gap-5"><DayPanel label={t('today')} date={dateString(new Date())} summary={summary} properties={properties} testId="home-today-panel" t={t} language={language}/><div className="lg:border-l lg:border-[#e5ded3] lg:pl-5"><DayPanel label={t('tomorrow')} date={tomorrowDate} summary={tomorrowSummary} properties={properties} testId="home-tomorrow-panel" t={t} language={language}/></div></div>
  </section>
}

