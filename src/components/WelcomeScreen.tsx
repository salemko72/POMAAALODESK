import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, Building2, ImagePlus, KeyRound, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { signInWithPassword, signUpOwner } from '../lib/auth-supabase'
import { clearPendingAgency, getKnownAgencies, setActiveAgencyId, setPendingAgency, type PendingAgency } from '../lib/agency-session'
import { getSettings, saveSettings, type AppLanguage } from '../lib/settings'
import { readImageFile } from '../lib/property-image'
import { LoginForm } from './LoginForm'
import { WelcomeIllustration } from './WelcomeIllustration'

type Mode = 'welcome' | 'signin' | 'agency' | 'owner' | 'invitation'

const copy = {
  hr: {
    eyebrow: 'PomaaaloDesk', title: 'Jednostavno upravljanje vašim smještajem.', body: 'Nekretnine, rezervacije, gosti i dnevni poslovi ostaju uredno odvojeni za svaki tim.',
    welcome: 'Dobro došli', welcomeHint: 'Odaberite kako želite početi.', create: 'Kreiraj novu agenciju', createHint: 'Postavite naziv, profilnu sliku i Owner račun.', signin: 'Prijavi se', signinHint: 'Nastavite u agenciju kojoj već pripadate.', invite: 'Imam pozivnicu', inviteHint: 'Prijavite se e-mailom na koji je stigla pozivnica.',
    known: 'Vaše agencije', back: 'Nazad', agencyTitle: 'Nova agencija', agencyBody: 'Ovo postaje odvojeni prostor za vaše nekretnine, rezervacije i tim.', agencyName: 'Naziv agencije', country: 'Država', language: 'Jezik', currency: 'Valuta', logo: 'Profilna slika agencije', optional: 'Neobavezno · velika slika se automatski optimizira', continue: 'Nastavi na Owner račun',
    ownerTitle: 'Kreirajte Owner račun', ownerBody: 'Prva osoba automatski dobiva sva prava u ovoj agenciji.', ownerWorkspace: 'Vlasnik agencije', fullName: 'Ime i prezime', password: 'Lozinka', createWorkspace: 'Kreiraj agenciju', creating: 'Kreiranje…', existing: 'Već imate PomaaaloDesk račun?', existingAction: 'Prijavi se i kreiraj ovu agenciju', existingDetected: 'Ovaj e-mail već ima PomaaaloDesk račun. Prijavite se postojećom lozinkom i agencija će se automatski kreirati.', verify: 'Poslali smo link za potvrdu. Provjerite Inbox i Spam; nakon potvrde otvorite ovu stranicu i agencija će se automatski kreirati.',
    secure: 'Podaci svake agencije ostaju odvojeni', automatic: 'Nakon prijave ulazite direktno na Home', invitationTitle: 'Prihvatite pozivnicu', invitationBody: 'Otvorite link iz e-maila, postavite lozinku ako se to traži, pa se prijavite ovdje.',
  },
  en: {
    eyebrow: 'PomaaaloDesk', title: 'Simple management for your rental.', body: 'Properties, bookings, guests and daily operations stay clearly separated for every team.',
    welcome: 'Welcome', welcomeHint: 'Choose how you want to begin.', create: 'Create a new agency', createHint: 'Set the name, profile image and Owner account.', signin: 'Sign in', signinHint: 'Continue to an agency you already belong to.', invite: 'I have an invitation', inviteHint: 'Sign in with the email address that received the invitation.',
    known: 'Your agencies', back: 'Back', agencyTitle: 'New agency', agencyBody: 'This becomes a separate workspace for your properties, bookings and team.', agencyName: 'Agency name', country: 'Country', language: 'Language', currency: 'Currency', logo: 'Agency profile image', optional: 'Optional · large images are optimized automatically', continue: 'Continue to Owner account',
    ownerTitle: 'Create the Owner account', ownerBody: 'The first person automatically receives full rights in this agency.', ownerWorkspace: 'Agency owner', fullName: 'Full name', password: 'Password', createWorkspace: 'Create agency', creating: 'Creating…', existing: 'Already have a PomaaaloDesk account?', existingAction: 'Sign in and create this agency', existingDetected: 'This email already has a PomaaaloDesk account. Sign in with its existing password and the agency will be created automatically.', verify: 'We sent a confirmation link. Check your Inbox and Spam; after confirming, reopen this page and the agency will be created automatically.',
    secure: 'Each agency’s data stays separate', automatic: 'After sign-in you go directly to Home', invitationTitle: 'Accept your invitation', invitationBody: 'Open the link from the email, set a password if requested, then sign in here.',
  },
} as const

export function WelcomeScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [language, setLanguage] = useState<AppLanguage>(() => getSettings().language)
  const [mode, setMode] = useState<Mode>('welcome')
  const [agency, setAgency] = useState<PendingAgency>({ name: '', logo_url: null, country: 'Croatia', language, currency: 'EUR', timezone: 'Europe/Sarajevo' })
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signInCreatesAgency, setSignInCreatesAgency] = useState(false)
  const knownAgencies = useMemo(() => getKnownAgencies(), [])
  const c = copy[language]

  function changeLanguage(next: AppLanguage) {
    setLanguage(next)
    setAgency((current) => ({ ...current, language: next }))
    saveSettings({ ...getSettings(), language: next })
  }
  function go(next: Mode) { setError(null); setMessage(null); setMode(next) }
  function chooseAgency(id: string) { clearPendingAgency(); setSignInCreatesAgency(false); setActiveAgencyId(id); go('signin') }
  async function selectLogo(file?: File) {
    if (!file) return
    try { const logo_url = await readImageFile(file, 'agency-logo'); setAgency((current) => ({ ...current, logo_url })); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to read image.') }
  }
  function continueAgency(event: FormEvent) {
    event.preventDefault()
    if (agency.name.trim().length < 2) { setError(language === 'hr' ? 'Unesite naziv agencije.' : 'Enter the agency name.'); return }
    const pending = { ...agency, name: agency.name.trim() }
    setAgency(pending); setPendingAgency(pending); go('owner')
  }
  async function createOwner(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null)
    if (!fullName.trim() || !email.trim() || password.length < 8) { setError(language === 'hr' ? 'Unesite ime, ispravan e-mail i lozinku od najmanje 8 znakova.' : 'Enter a name, valid email and a password of at least 8 characters.'); return }
    setSubmitting(true)
    const normalizedEmail = email.trim()
    const { data, error: authError } = await signUpOwner(normalizedEmail, password, fullName.trim())
    if (authError) { setSubmitting(false); setError(authError.message); return }
    if (data.session) { setSubmitting(false); onAuthenticated(); return }

    // Hosted Supabase deliberately returns an obfuscated user with no identities
    // when signUp is called for an already-confirmed email. Try the supplied
    // credentials so an existing owner can create the pending agency immediately.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      const { data: signInData } = await signInWithPassword(normalizedEmail, password)
      setSubmitting(false)
      if (signInData.session) { onAuthenticated(); return }
      setSignInCreatesAgency(true)
      setMode('signin')
      setMessage(c.existingDetected)
      return
    }

    setSubmitting(false)
    setMessage(c.verify)
  }

  const card = mode === 'welcome' ? <>
    <div className="text-left"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-500">{c.eyebrow}</p><h2 className="mt-2 text-[2.8125rem] font-light leading-none tracking-tight text-[#17243d]">{c.welcome}</h2><p className="mt-1 text-sm text-slate-500">{c.welcomeHint}</p></div>
    {knownAgencies.length > 0 && <div className="mt-5"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{c.known}</p><div className="flex gap-2 overflow-x-auto pb-1">{knownAgencies.map((item) => <button key={item.id} onClick={() => chooseAgency(item.id)} className="flex min-w-[150px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 text-left hover:border-violet-300"><AgencyAvatar name={item.name} image={item.logo_url}/><span className="min-w-0 truncate text-xs font-semibold">{item.name}</span></button>)}</div></div>}
    <div className="mt-5 grid gap-2.5"><WelcomeAction icon={Building2} title={c.create} body={c.createHint} primary onClick={() => {clearPendingAgency();setSignInCreatesAgency(false);go('agency')}}/><WelcomeAction icon={KeyRound} title={c.signin} body={c.signinHint} onClick={() => {clearPendingAgency();setSignInCreatesAgency(false);go('signin')}}/><WelcomeAction icon={Mail} title={c.invite} body={c.inviteHint} onClick={() => {clearPendingAgency();setSignInCreatesAgency(false);go('invitation')}}/></div>
  </> : mode === 'signin' ? <Panel title={c.signin} body={c.signinHint} back={() => go(signInCreatesAgency?'owner':'welcome')} c={c}><LoginForm onAuthenticated={onAuthenticated} initialEmail={signInCreatesAgency ? email.trim() : ''}/></Panel>
    : mode === 'invitation' ? <Panel title={c.invitationTitle} body={c.invitationBody} back={() => go('welcome')} c={c}><LoginForm onAuthenticated={onAuthenticated}/></Panel>
      : mode === 'agency' ? <Panel title={c.agencyTitle} body={c.agencyBody} back={() => {clearPendingAgency();go('welcome')}} c={c}><form onSubmit={continueAgency} className="space-y-3.5">
        <label className="block text-xs font-semibold text-slate-600">{c.logo}<span className="mt-1.5 flex items-center gap-3"><AgencyAvatar name={agency.name || 'A'} image={agency.logo_url} large/><span className="flex-1"><span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700"><ImagePlus size={15}/>{c.logo}<input type="file" accept="image/*" className="sr-only" onChange={(event) => void selectLogo(event.target.files?.[0])}/></span><span className="mt-1 block text-[10px] font-normal text-slate-400">{c.optional}</span></span></span></label>
        <Field label={c.agencyName}><input autoFocus value={agency.name} onChange={(e) => setAgency({...agency,name:e.target.value})} className="welcome-input"/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label={c.country}><input value={agency.country} onChange={(e) => setAgency({...agency,country:e.target.value})} className="welcome-input"/></Field><Field label={c.currency}><select value={agency.currency} onChange={(e) => setAgency({...agency,currency:e.target.value})} className="welcome-input"><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option><option>BAM</option></select></Field></div>
        <button className="welcome-primary" type="submit">{c.continue}<span>→</span></button>
      </form></Panel>
        : <Panel title={c.ownerTitle} body={c.ownerBody} back={() => go('agency')} c={c}><form onSubmit={(event) => void createOwner(event)} className="space-y-3.5">
          <div className="flex items-center gap-3 rounded-2xl bg-violet-50 p-3"><AgencyAvatar name={agency.name} image={agency.logo_url}/><div><p className="text-xs font-semibold text-violet-900">{agency.name}</p><p className="text-[10px] text-violet-500">{c.ownerWorkspace}</p></div></div>
          <Field label={c.fullName}><div className="relative"><UserRound className="welcome-field-icon" size={16}/><input value={fullName} onChange={(e)=>setFullName(e.target.value)} className="welcome-input pl-10" autoComplete="name"/></div></Field>
          <Field label="E-mail"><div className="relative"><Mail className="welcome-field-icon" size={16}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="welcome-input pl-10" autoComplete="email"/></div></Field>
          <Field label={c.password}><div className="relative"><KeyRound className="welcome-field-icon" size={16}/><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="welcome-input pl-10" autoComplete="new-password"/></div></Field>
          <button disabled={submitting} className="welcome-primary" type="submit">{submitting ? c.creating : c.createWorkspace}<span>→</span></button>
          <button type="button" onClick={()=>{setSignInCreatesAgency(true);go('signin')}} className="w-full text-center text-xs text-slate-500"><span>{c.existing}</span> <strong className="text-violet-600">{c.existingAction}</strong></button>
        </form></Panel>

  return <main className="min-h-[100svh] bg-[#f5f0e8] text-[#17243d]">
    <div className="absolute right-4 top-4 z-10 flex rounded-full border border-white/70 bg-white/75 p-1 text-[10px] font-semibold shadow-sm backdrop-blur"><button onClick={()=>changeLanguage('hr')} className={`rounded-full px-2.5 py-1 ${language==='hr'?'bg-violet-600 text-white':'text-slate-500'}`}>HR</button><button onClick={()=>changeLanguage('en')} className={`rounded-full px-2.5 py-1 ${language==='en'?'bg-violet-600 text-white':'text-slate-500'}`}>EN</button></div>
    <div className="mx-auto grid min-h-[100svh] w-full min-w-0 max-w-[1180px] items-stretch gap-0 overflow-hidden p-0 md:grid-cols-[1.08fr_.92fr] md:items-center md:gap-6 md:p-6">
      <section className="relative flex min-h-[38svh] min-w-0 overflow-hidden bg-[#ddecf3] p-6 md:min-h-[calc(100svh-3rem)] md:rounded-[2.2rem] md:p-9"><div className="absolute inset-0"><WelcomeIllustration/></div><div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-[#dcebf1]/35"/><div className="relative z-[1] min-w-0 max-w-lg"><p className="text-[10px] font-semibold tracking-[0.18em] text-[#567aa9]">{c.eyebrow}</p><h1 className="mt-4 text-[2.25rem] font-light leading-[1.05] tracking-tight text-[#183a69] sm:text-5xl md:text-[3.35rem]">{c.title}</h1><p className="mt-4 max-w-md text-sm leading-6 text-[#45658b]">{c.body}</p><div className="mt-5 hidden gap-2 text-[11px] text-[#45658b] sm:flex"><span className="rounded-full bg-white/65 px-3 py-2 shadow-sm"><ShieldCheck className="mr-1 inline" size={14}/>{c.secure}</span><span className="rounded-full bg-white/65 px-3 py-2 shadow-sm"><Sparkles className="mr-1 inline" size={14}/>{c.automatic}</span></div></div></section>
      <section className="relative z-[2] -mt-5 flex w-full min-w-0 items-start justify-center rounded-t-[2rem] bg-[#f5f0e8] px-4 pb-8 pt-5 md:mt-0 md:bg-transparent md:p-0"><div className="w-full min-w-0 max-w-[455px] rounded-[1.8rem] border border-white/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(50,70,95,.13)] sm:p-7"><WelcomeSteps language={language} active={mode === 'signin' || mode === 'invitation' || mode === 'owner' ? 2 : 1}/>{card}{error&&<p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}{message&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p>}</div></section>
    </div>
  </main>
}

function AgencyAvatar({name,image,large=false}:{name:string;image:string|null;large?:boolean}) { return <span className={`${large?'h-16 w-16':'h-10 w-10'} flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-violet-500 to-sky-400 font-semibold text-white shadow-sm`}>{image?<img src={image} alt="" className="h-full w-full object-cover"/>:(name.trim()[0]||'A').toUpperCase()}</span> }
function WelcomeSteps({language,active}:{language:AppLanguage;active:1|2}) { const labels=language==='hr'?['Agencija','Prijava']:['Agency','Login']; return <div aria-label={language==='hr'?'Koraci prijave':'Sign-in steps'} className="mb-6 flex items-start justify-start"><div className="flex flex-col items-center gap-1.5"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${active===1?'bg-violet-600 text-white shadow-md shadow-violet-200':'bg-slate-200 text-slate-600'}`}>1</span><span className={`text-[10px] font-semibold ${active===1?'text-violet-700':'text-slate-400'}`}>{labels[0]}</span></div><span aria-hidden className={`mt-4 h-px w-20 ${active===2?'bg-violet-300':'bg-slate-200'}`}/><div className="flex flex-col items-center gap-1.5"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${active===2?'bg-violet-600 text-white shadow-md shadow-violet-200':'bg-slate-200 text-slate-600'}`}>2</span><span className={`text-[10px] font-semibold ${active===2?'text-violet-700':'text-slate-400'}`}>{labels[1]}</span></div></div> }
function WelcomeAction({icon:Icon,title,body,primary=false,onClick}:{icon:typeof Building2;title:string;body:string;primary?:boolean;onClick:()=>void}) { return <button type="button" onClick={onClick} className={`group flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3.5 text-left transition ${primary?'border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200':'border-slate-200 bg-slate-50/60 hover:border-violet-300'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${primary?'bg-white/15':'bg-white text-violet-600'}`}><Icon size={19}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className={`mt-0.5 block text-[10px] leading-4 ${primary?'text-violet-100':'text-slate-500'}`}>{body}</span></span><span className="shrink-0 transition group-hover:translate-x-0.5">→</span></button> }
function Panel({title,body,back,c,children}:{title:string;body:string;back:()=>void;c:typeof copy.hr|typeof copy.en;children:React.ReactNode}) { return <><button type="button" onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ArrowLeft size={15}/>{c.back}</button><div className="mb-5"><h2 className="text-2xl font-light tracking-tight text-[#17243d]">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></div>{children}</> }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block text-[11px] font-semibold text-slate-600">{label}<span className="mt-1.5 block">{children}</span></label> }
