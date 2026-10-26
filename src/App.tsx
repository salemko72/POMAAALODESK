import { useEffect, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { WelcomeScreen } from './components/WelcomeScreen'
import { CalendarPage } from './pages/CalendarPage'
import { BackupPage } from './pages/BackupPage'
import { EditReservationPage } from './pages/EditReservationPage'
import { HomePage } from './pages/HomePage'
import { NewBookingPage } from './pages/NewBookingPage'
import { PeoplePage } from './pages/PeoplePage'
import { PropertiesPage } from './pages/PropertiesPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdministrationPages } from './pages/AdministrationPages'
import { AgencyPage } from './pages/AgencyPage'
import { getCurrentSession, signOut } from './lib/auth-supabase'
import { getProfile } from './lib/profiles-repository'
import { canOpenPage, type UserProfile } from './lib/permissions'
import { CleaningPage } from './pages/CleaningPage'
import { OperationsPage } from './pages/OperationsPage'
import { createAgency, getMyAgencies, type AgencyMembership } from './lib/agency-repository'
import { AgencyProvider } from './lib/agency-context'
import { IcalSyncProvider } from './lib/ical-sync-context'
import { clearActiveAgency, clearPendingAgency, getActiveAgencyId, getPendingAgency, rememberAgencies, setActiveAgencyId } from './lib/agency-session'

function App() {
  const navigate = useNavigate()
  const [checkingSession, setCheckingSession] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [agency, setAgency] = useState<AgencyMembership | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let mounted = true
    let generation = 0
    async function refresh() {
      const current = ++generation
      try {
        const session = await getCurrentSession()
        if (!session?.user?.id) {
          if (mounted && current === generation) { setAuthenticated(false); setProfile(null); setAgency(null); setAccessError(null) }
          return
        }
        let selected: AgencyMembership | null = null
        const pending = getPendingAgency()
        if (pending) {
          selected = await createAgency(pending)
          setActiveAgencyId(selected.id)
          clearPendingAgency()
        }
        const memberships = await getMyAgencies()
        if (!selected) selected = memberships.find((item) => item.id === getActiveAgencyId()) ?? memberships[0] ?? null
        if (!selected) throw new Error('Your account is not connected to an agency.')
        setActiveAgencyId(selected.id)
        rememberAgencies(memberships.map(({ id, name, slug, logo_url }) => ({ id, name, slug, logo_url })))
        const baseProfile = await getProfile(session.user.id)
        const nextProfile: UserProfile = { ...baseProfile, role: selected.role, is_active: selected.is_active }
        if (!nextProfile.is_active) throw new Error('Your agency access is inactive.')
        if (!mounted || current !== generation) return
        setAuthenticated(true); setProfile(nextProfile); setAgency(selected); setAccessError(null)
      } catch (reason) {
        if (mounted && current === generation) { setAuthenticated(true); setProfile(null); setAgency(null); setAccessError(reason instanceof Error ? reason.message : 'Access could not be verified.') }
      } finally { if (mounted && current === generation) setCheckingSession(false) }
    }
    void refresh()
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(onFocus, 30000)
    return () => { mounted = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [revision])

  async function logout() {
    try {
      const result = await signOut()
      if (result?.error) throw result.error
      clearActiveAgency(); setAgency(null); setProfile(null); setAuthenticated(false); setAccessError(null); navigate('/')
    } catch { setAccessError('Sign out failed. Please try again.'); setProfile(null) }
  }

  if (checkingSession) return <main className="flex min-h-screen items-center justify-center bg-[#f6f1e9] text-sm text-slate-500">Loading…</main>
  if (accessError && authenticated) return <main className="flex min-h-screen items-center justify-center bg-[#f6f1e9] p-5"><div role="alert" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"><h1 className="text-2xl font-light">Account access unavailable</h1><p className="mt-3 text-sm text-slate-500">{accessError}</p><button className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => { setCheckingSession(true); setRevision((value) => value + 1) }}>Try again</button><button className="ml-3 p-2 text-sm" onClick={() => void logout()}>Sign out</button></div></main>
  if (!authenticated || !profile || !agency) return <WelcomeScreen onAuthenticated={() => { setCheckingSession(true); setRevision((value) => value + 1); navigate('/') }}/>

  const role = profile.role
  const denied = <section role="alert" className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-light">Access denied</h1><p className="mt-2 text-sm text-slate-500">Your role does not have access to this page.</p></section>
  const guard = (path: string, page: React.ReactNode) => canOpenPage(role, path) ? page : denied
  return <AgencyProvider agency={agency}><IcalSyncProvider key={agency.id}><AppShell role={role} agency={agency} onLogout={() => void logout()}><Routes>
    {(['reservations','guests','tasks','blocks'] as const).map((mode) => <Route key={mode} path={`/${mode}`} element={guard(`/${mode}`, <OperationsPage key={`${mode}-${role}`} mode={mode} role={role}/>)} />)}
    <Route path="/" element={role === 'cleaning' ? <CleaningPage onLogout={() => void logout()}/> : <HomePage onLogout={() => void logout()}/>}/>
    <Route path="/calendar" element={guard('/calendar', <CalendarPage role={role}/>)}/>
    <Route path="/backup" element={guard('/backup', <BackupPage/>)}/>
    <Route path="/edit-reservation/:id" element={guard('/edit-reservation/id', <EditReservationPage role={role}/>)}/>
    <Route path="/properties" element={guard('/properties', <PropertiesPage role={role}/>)}/>
    <Route path="/new-booking" element={guard('/new-booking', <NewBookingPage/>)}/>
    <Route path="/settings" element={<SettingsPage role={role}/>}/>
    <Route path="/agency" element={guard('/agency', <AgencyPage/>)}/>
    <Route path="/people" element={guard('/people', <PeoplePage/>)} />
    <Route path="/calendar-sources" element={guard('/calendar-sources', <AdministrationPages mode="calendar-sources"/>)}/>
    <Route path="/notifications" element={<AdministrationPages mode="notifications"/>}/>
    <Route path="/account" element={<AdministrationPages mode="account"/>}/>
    <Route path="*" element={denied}/>
  </Routes></AppShell></IcalSyncProvider></AgencyProvider>
}

export default App
