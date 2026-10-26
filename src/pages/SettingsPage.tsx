import { canOpenPage, type UserRole } from '../lib/permissions'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Building2, CalendarDays, Languages, Moon, Ruler, Save, SlidersHorizontal, Sun, UserRound, UsersRound } from 'lucide-react'
import { getSettings, saveSettings, type AppSettings, type AppLanguage, type Appearance, type DateFormat, type MeasurementUnits } from '../lib/settings'
import { useT } from '../lib/i18n'
import { AgencyTitleMark } from '../components/AgencyTitleMark'

const adminItems = [
  { path: '/agency', key: 'agency' as const, hint: 'agencyHint' as const, icon: Building2 },
  { path: '/properties', key: 'properties' as const, hint: 'propertiesHint' as const, icon: Building2 },
  { path: '/people', key: 'people' as const, hint: 'peopleHint' as const, icon: UsersRound },
  { path: '/calendar-sources', key: 'calendarSources' as const, hint: 'calendarSourcesHint' as const, icon: CalendarDays },
  { path: '/notifications', key: 'notifications' as const, hint: 'notificationsHint' as const, icon: Bell },
  { path: '/account', key: 'account' as const, hint: 'accountHint' as const, icon: UserRound },
  { path: '/backup', key: 'backupData' as const, hint: 'backupDescription' as const, icon: Save },
]

export function SettingsPage({ role = 'viewer' }: { role?: UserRole } = {}) {
  const navigate = useNavigate(); const t = useT(); const [settings, setSettings] = useState<AppSettings>(getSettings)
  useEffect(() => { saveSettings(settings) }, [settings])
  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) { setSettings((current) => ({ ...current, [key]: value })) }
  return <section className="mx-auto max-w-4xl p-3 pb-8 md:p-5">
    <header className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('preferences')}</p><h1 className="mt-1 text-[2.938rem] font-light leading-[.95] sm:text-[3.7rem] tracking-tight">{t('settings')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{t('settingsDescription')}</p></header>
    <div className="space-y-3">
      <section className="rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-3"><SlidersHorizontal size={18} className="text-violet-500"/><div><h2 className="text-sm font-semibold">{t('appearance')}</h2><p className="text-[11px] text-slate-500">{t('chooseLooks')}</p></div></div><div className="mt-3 grid grid-cols-3 gap-1.5">{([['light',Sun],['dark',Moon],['system',SlidersHorizontal]] as const).map(([value,Icon]) => <button key={value} type="button" onClick={() => update('appearance', value as Appearance)} className={['flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition',settings.appearance===value?'bg-violet-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'].join(' ')}><Icon size={14}/>{t(value as 'light'|'dark'|'system')}</button>)}</div></section>
      <section className="rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-3"><Ruler size={18} className="text-violet-500"/><div><h2 className="text-sm font-semibold">{t('regionalMeasurement')}</h2><p className="text-[11px] text-slate-500">{t('formattingIndependent')}</p></div></div><div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-[11px] font-semibold text-slate-600">{t('language')}<span className="relative mt-1.5 block"><Languages size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><select aria-label={t('language')} value={settings.language} onChange={(e)=>update('language', e.target.value as AppLanguage)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-normal outline-none focus:border-violet-400"><option value="en">{t('english')}</option><option value="hr">{t('croatian')}</option></select></span></label>
        <label className="text-[11px] font-semibold text-slate-600">{t('measurementUnits')}<select aria-label={t('measurementUnits')} value={settings.measurementUnits} onChange={(e)=>update('measurementUnits', e.target.value as MeasurementUnits)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400"><option value="metric">{t('metric')}</option><option value="imperial">{t('imperial')}</option></select></label>
        <label className="text-[11px] font-semibold text-slate-600">{t('dateFormat')}<select aria-label={t('dateFormat')} value={settings.dateFormat} onChange={(e)=>update('dateFormat',e.target.value as DateFormat)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400"><option value="DD.MM.YYYY">{t('europeanDateFormat')}</option><option value="MM/DD/YYYY">{t('americanDateFormat')}</option></select></label>
      </div></section>
      <section className="rounded-[1.35rem] bg-white p-4"><div className="flex items-center gap-3"><UsersRound size={18} className="text-violet-500"/><div><h2 className="text-sm font-semibold">{t('administration')}</h2><p className="text-[11px] text-slate-500">Open a section to manage the workspace.</p></div></div><div className="mt-3 grid gap-2 md:grid-cols-2">{adminItems.filter(item => canOpenPage(role, item.path)).map(({path,key,hint,icon:Icon}) => <button key={path} type="button" onClick={()=>navigate(path)} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition hover:bg-violet-50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-violet-600"><Icon size={15}/></span><span><span className="block text-xs font-semibold text-slate-800">{t(key)}</span><span className="block text-[10px] text-slate-500">{t(hint)}</span></span></button>)}</div></section>
    </div>
  </section>
}
