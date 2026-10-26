import { useEffect, useState } from 'react'
import { Bell, CalendarDays, KeyRound, Save, Trash2, UserRound } from 'lucide-react'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { getCalendarSourceSettings, getNotificationSettings, saveCalendarSourceSettings, saveNotificationSettings } from '../lib/settings'
import { useT } from '../lib/i18n'
import { getCurrentSession, signOut, updatePassword } from '../lib/auth-supabase'
import { deleteCurrentUser } from '../lib/admin-users'
import { getProfile, updateProfile } from '../lib/profiles-repository'

type NotificationPageProps = { mode: 'notifications' | 'calendar-sources' | 'account' }

function NotificationsSection() {
  const t = useT()
  const [settings, setSettings] = useState(getNotificationSettings)
  const [saved, setSaved] = useState(false)
  const update = (key: keyof typeof settings) => setSettings(current => ({ ...current, [key]: !current[key] }))
  return <section className="mx-auto max-w-3xl p-4 pb-8 md:p-6"><header className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Bell size={19}/></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('administration')}</p><h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{t('notificationsTitle')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{t('notificationsDescription')}</p></div></header><div className="rounded-[1.35rem] bg-white p-4 space-y-2">{([['arrivals',t('arrivals')],['departures',t('departures')],['cleanings',t('cleaningReminders')],['newReservations',t('newReservationAlerts')]] as const).map(([key,label])=><label key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 text-xs font-semibold text-slate-700"><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={()=>update(key)} className="h-4 w-4 accent-violet-600"/></label>)}<div className="flex items-center gap-2 pt-2"><button type="button" onClick={()=>{saveNotificationSettings(settings);setSaved(true)}} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-semibold text-white"><Save size={14}/>{t('saveNotifications')}</button>{saved&&<span role="status" className="text-[11px] text-emerald-600">Saved</span>}</div></div></section>
}

function CalendarSourcesSection() {
  const t = useT()
  const [settings, setSettings] = useState(getCalendarSourceSettings)
  const [saved, setSaved] = useState(false)
  return <section className="mx-auto max-w-3xl p-4 pb-8 md:p-6"><header className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><CalendarDays size={19}/></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('administration')}</p><h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{t('calendarSourcesTitle')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{t('calendarSourcesDescription')}</p></div></header><div className="rounded-[1.35rem] bg-white p-4 space-y-3"><label className="block text-[11px] font-semibold text-slate-600">{t('airbnbIcalUrl')}<input value={settings.airbnbIcalUrl} onChange={e=>setSettings(s=>({...s,airbnbIcalUrl:e.target.value}))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="block text-[11px] font-semibold text-slate-600">{t('bookingIcalUrl')}<input value={settings.bookingIcalUrl} onChange={e=>setSettings(s=>({...s,bookingIcalUrl:e.target.value}))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>{saveCalendarSourceSettings(settings);setSaved(true)}} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-semibold text-white"><Save size={14}/>{t('saveCalendarSources')}</button>{saved&&<span role="status" className="text-[11px] text-emerald-600">Saved</span>}</div><p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">{t('notSyncedYet')}</p></div></section>
}

function AccountSection() {
  const t = useT()
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void getCurrentSession().then(async (session) => {
      if (!mounted || !session?.user?.id) return
      setUserId(session.user.id)
      setEmail(session.user.email ?? '')
      try {
        const profile = await getProfile(session.user.id)
        if (mounted) setFullName(profile.full_name ?? '')
      } catch {
        if (mounted) setError('Unable to load account profile.')
      }
    })
    return () => { mounted = false }
  }, [])

  async function saveProfile() {
    if (!userId) return
    setSavingProfile(true); setError(null); setMessage(null)
    try { await updateProfile(userId, { full_name: fullName.trim() || null }); setMessage('Profile saved.') }
    catch { setError('Unable to save profile.') }
    finally { setSavingProfile(false) }
  }

  async function savePassword() {
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setSavingPassword(true); setError(null); setMessage(null)
    try { await updatePassword(newPassword); setNewPassword(''); setConfirmPassword(''); setMessage('Password updated.') }
    catch { setError('Unable to update password.') }
    finally { setSavingPassword(false) }
  }

  async function removeAccount() {
    if (!window.confirm('Delete your account permanently? This cannot be undone.')) return
    setDeleting(true); setError(null)
    try { await deleteCurrentUser(); await signOut(); window.location.assign('/') }
    catch { setError('Unable to delete account. The last administrator cannot delete their own account.') }
    finally { setDeleting(false) }
  }

  return <section className="mx-auto max-w-3xl p-4 pb-8 md:p-6">
    <header className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><UserRound size={19}/></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('administration')}</p><h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{t('accountTitle')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{t('accountDescription')}</p></div></header>
    {error&&<div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>}
    {message&&<div role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">{message}</div>}
    <div className="space-y-3">
      <section className="rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-violet-500"/>Profile</div><div className="mt-3 space-y-3"><label className="block text-[11px] font-semibold text-slate-600">Name<input aria-label="Account name" value={fullName} onChange={e=>setFullName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="block text-[11px] font-semibold text-slate-600">Email<input aria-label="Account email" value={email} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-500"/></label><button type="button" disabled={savingProfile} onClick={()=>void saveProfile()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Save size={14}/>{savingProfile?'Saving...':'Save profile'}</button></div></section>
      <section className="rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={17} className="text-violet-500"/>Password</div><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-[11px] font-semibold text-slate-600">New password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Confirm password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label></div><button type="button" disabled={savingPassword} onClick={()=>void savePassword()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Update password</button></section>
      <section className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-rose-800"><Trash2 size={17}/>Danger zone</div><p className="mt-1 text-xs text-rose-700">Permanently delete your account. The last administrator is protected from self-deletion.</p><button type="button" disabled={deleting} onClick={()=>void removeAccount()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Trash2 size={14}/>{deleting?'Deleting...':'Delete my account'}</button></section>
    </div>
  </section>
}

export function AdministrationPages({ mode }: NotificationPageProps) {
  if (mode === 'notifications') return <NotificationsSection />
  if (mode === 'calendar-sources') return <CalendarSourcesSection />
  return <AccountSection />
}
