import { AutoBackupStatusBar } from './AutoBackup'
import { IcalSyncStatus } from './OverbookAlerts'
import { canOpenPage, type UserRole } from '../lib/permissions'
import { NavLink } from 'react-router-dom'
import { CalendarDays, Grid2X2, Home, List, LogOut, Plus, Settings } from 'lucide-react'
import { useT } from '../lib/i18n'
import type { AgencyMembership } from '../lib/agency-repository'
import { useEffect, useState } from 'react'

type AppShellProps = { children: React.ReactNode; role?: UserRole; agency?: AgencyMembership; onLogout?: () => void }

export function AppShell({ children, role = 'viewer', agency = { id:'legacy', name:'Jolie Agency', slug:'jolie-agency', logo_url:null, country:'', language:'hr', currency:'EUR', timezone:'Europe/Sarajevo', role, is_active:true }, onLogout = () => {} }: AppShellProps) {
  const t = useT()
  const [desktop, setDesktop] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => { if(typeof window.matchMedia!=='function')return;const query=window.matchMedia('(min-width: 1024px)');const sync=()=>setDesktop(query.matches);query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync) },[])
  const navItems = [
    { to: '/', label: t('home'), icon: Home },
    { to: '/reservations', label: t('list'), icon: List },
    { to: '/calendar', label: t('calendar'), icon: CalendarDays },
    { to: '/properties', label: t('properties'), icon: Grid2X2 },
    { to: '/new-booking', label: t('reservation'), icon: Plus, primary: true },
    { to: '/settings', label: t('settings'), icon: Settings },
  ].filter((item) => canOpenPage(role, item.to))
  return <div className="app-shell min-h-screen text-slate-900">
    <div className="app-background-layer" aria-hidden="true" />
    {desktop&&<aside className="app-side-nav fixed top-0 bottom-8 left-0 z-40 flex w-[218px] flex-col border-r border-[#ded8cf] bg-[#fffdfa]/95 px-3 py-5 backdrop-blur">
      <div className="px-3"><p className="text-[9px] font-semibold tracking-[0.16em] text-violet-500">PomaaaloDesk</p><p className="mt-1 truncate text-sm font-semibold text-[#18304f]">{agency.name}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">{role}</p></div>
      <nav className="mt-8 space-y-1">{navItems.map(({to,label,icon:Icon,primary})=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>['flex items-center gap-3 rounded-2xl px-3 py-3 text-xs font-semibold transition',primary?'mt-3 bg-violet-600 text-white shadow-md shadow-violet-100':isActive?'bg-violet-100 text-violet-700':'text-slate-500 hover:bg-slate-100 hover:text-slate-800'].join(' ')}><Icon size={primary?20:18} strokeWidth={primary?2.7:1.8}/><span>{label}</span></NavLink>)}</nav>
      <button onClick={onLogout} className="mt-auto flex items-center gap-3 rounded-2xl px-3 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-100"><LogOut size={18}/>{t('logout')}</button>
    </aside>}

    <main className="app-content relative z-10 min-h-screen pb-36 lg:ml-[218px] lg:pb-12">
      {children}
    </main>

    <div className="fixed bottom-0 left-0 right-0 z-40" style={{paddingBottom: 'env(safe-area-inset-bottom, 0px)'}}>
    {!desktop&&<nav className="app-bottom-nav border-t border-[#ddd6ca]/80 bg-[#fffdfa]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-1 px-2 py-1.5 sm:justify-around sm:px-3">{navItems.map(({to,label,icon:Icon,primary})=><NavLink key={to} to={to} end={to==='/' } title={label} className={({isActive})=>['flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-[9px] font-semibold transition sm:max-w-28 sm:px-3 sm:py-2 sm:text-[10px]',primary?'border-violet-700 bg-violet-600 text-white':isActive?'border-violet-200 bg-violet-100 text-violet-700':'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white'].join(' ')}><Icon size={primary?22:18} strokeWidth={primary?2.8:1.8}/><span className="max-w-full truncate">{label}</span></NavLink>)}</div>
    </nav>}<footer aria-label="Application status" className="app-bottom-nav flex min-h-8 w-full items-center justify-between border-t border-[#ddd6ca]/80 bg-[#fffdfa]/95 backdrop-blur"><AutoBackupStatusBar/><IcalSyncStatus compact/></footer></div>
  </div>
}
