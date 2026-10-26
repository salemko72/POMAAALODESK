import { useState } from 'react'
import { ImagePlus, Save } from 'lucide-react'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { useAgency } from '../lib/agency-context'
import { updateAgency } from '../lib/agency-repository'
import { rememberAgencies } from '../lib/agency-session'
import { readImageFile } from '../lib/property-image'
import { useAppLanguage } from '../lib/i18n'

export function AgencyPage() {
  const agency = useAgency()
  const language = useAppLanguage()
  const hr = language === 'hr'
  const [form, setForm] = useState({ name: agency.name, logo_url: agency.logo_url, country: agency.country, language: agency.language, currency: agency.currency, timezone: agency.timezone })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const initials = form.name.split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]).join('').toUpperCase() || 'A'
  async function pickLogo(file?: File) { if (!file) return; try { const logo_url=await readImageFile(file,'agency-logo'); setForm((current)=>({...current,logo_url})); setError('') } catch(reason) { setError(reason instanceof Error?reason.message:'Unable to read image.') } }
  async function save() {
    if (form.name.trim().length < 2) { setError(hr?'Unesite naziv agencije.':'Enter the agency name.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      await updateAgency(agency.id, {...form,name:form.name.trim()})
      rememberAgencies([{id:agency.id,name:form.name.trim(),slug:agency.slug,logo_url:form.logo_url}])
      setMessage(hr?'Podaci agencije su spremljeni.':'Agency details saved.')
      window.setTimeout(()=>window.location.reload(),500)
    } catch(reason) { setError(reason instanceof Error?reason.message:(hr?'Spremanje nije uspjelo.':'Unable to save.')) }
    finally { setSaving(false) }
  }
  return <section className="mx-auto max-w-3xl p-4 pb-8 md:p-6"><header className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-500">{hr?'ADMINISTRACIJA':'ADMINISTRATION'}</p><h1 className="mt-1 text-[2.938rem] font-light leading-[.95] tracking-tight sm:text-[3.7rem]">{hr?'Agencija':'Agency'}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{hr?'Identitet i regionalne postavke trenutne agencije.':'Identity and regional defaults for the current agency.'}</p></header>
    {error&&<p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}{message&&<p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p>}
    <div className="rounded-[1.5rem] bg-white p-5"><div className="flex items-center gap-4"><span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-violet-500 to-sky-400 text-xl font-semibold text-white shadow-lg">{form.logo_url?<img src={form.logo_url} alt="" className="h-full w-full object-cover"/>:initials}</span><div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700"><ImagePlus size={15}/>{hr?'Promijeni sliku':'Change image'}<input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e)=>void pickLogo(e.target.files?.[0])}/></label><p className="mt-1.5 text-[10px] text-slate-400">{hr?'Velike slike se automatski optimiziraju':'Large images are optimized automatically'}</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><AgencyField label={hr?'Naziv agencije':'Agency name'} wide><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="welcome-input"/></AgencyField><AgencyField label={hr?'Država':'Country'}><input value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})} className="welcome-input"/></AgencyField><AgencyField label={hr?'Jezik':'Language'}><select value={form.language} onChange={(e)=>setForm({...form,language:e.target.value as 'hr'|'en'})} className="welcome-input"><option value="hr">Hrvatski</option><option value="en">English</option></select></AgencyField><AgencyField label={hr?'Valuta':'Currency'}><select value={form.currency} onChange={(e)=>setForm({...form,currency:e.target.value})} className="welcome-input"><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option><option>BAM</option></select></AgencyField><AgencyField label={hr?'Vremenska zona':'Timezone'}><input value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})} className="welcome-input"/></AgencyField></div>
      <button disabled={saving} onClick={()=>void save()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"><Save size={15}/>{saving?(hr?'Spremanje…':'Saving…'):(hr?'Spremi agenciju':'Save agency')}</button>
    </div>
  </section>
}

function AgencyField({label,wide=false,children}:{label:string;wide?:boolean;children:React.ReactNode}) { return <label className={`${wide?'sm:col-span-2':''} text-[11px] font-semibold text-slate-600`}>{label}<span className="mt-1.5 block">{children}</span></label> }
