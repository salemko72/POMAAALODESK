import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DatabaseBackup, Download, RefreshCw } from 'lucide-react'
import { useAgency } from '../lib/agency-context'
import { useAppLanguage } from '../lib/i18n'
import { backupRequest, notifyBackupChanged, useAutoBackupStatus, type BackupRun } from '../lib/auto-backup'

export function AutoBackupStatusBar() {
  const {status,error}=useAutoBackupStatus()
  const agency=useAgency(), hr=useAppLanguage()==='hr'
  const date=status?.last_success_at ? new Date(status.last_success_at).toLocaleDateString(hr?'hr-HR':'en-GB') : '—'
  const warning=error||Boolean(status?.last_error)
  const label=`AutoBackup ${error?'?':status ? (status.enabled?'ON':'OFF'):'…'} · ${date}${status?.running?' · …':''}${warning?' ⚠':''}`
  const title=error ? (hr?'Status backupa nije dostupan':'Backup status unavailable') : status?.last_error || (hr?'Zadnja uspješna kopija: ':'Last successful backup: ')+(status?.last_success_at?new Date(status.last_success_at).toLocaleString(): '—')
  const className=`min-w-0 px-2 py-1 text-[9px] leading-tight ${warning?'text-amber-700':'text-slate-600'}`
  return agency.role==='owner'||agency.role==='admin' ? <Link to="/backup" title={title} className={className}>{label}</Link> : <span title={title} className={className}>{label}</span>
}

export function AutoBackupSettings() {
  const agency=useAgency(), hr=useAppLanguage()==='hr'
  const {status,error:statusError}=useAutoBackupStatus()
  const [runs,setRuns]=useState<BackupRun[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  useEffect(()=>{
    let alive=true
    const load=()=>void backupRequest(agency.id,'list').then(r=>r.json()).then(data=>{if(alive)setRuns(data)}).catch(()=>{if(alive)setError(hr?'Historija kopija nije dostupna.':'Backup history unavailable.')})
    load();const timer=window.setInterval(load,60000)
    window.addEventListener('auto-backup-changed',load)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('auto-backup-changed',load)}
  },[agency.id,hr])
  async function act(action:string,extra:Record<string,unknown>={}) {
    setBusy(true);setError('');setMessage('')
    try {
      const response=await backupRequest(agency.id,action,extra)
      if(action==='download') {
        const url=URL.createObjectURL(await response.blob()),a=document.createElement('a')
        a.href=url;a.download=`${agency.slug}-backup-${extra.run_id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
      } else {
        notifyBackupChanged()
        if(action==='configure' && extra.enabled) {
          setMessage(hr?'Uključeno. Pravim prvu kopiju…':'Enabled. Creating the first backup…')
          await backupRequest(agency.id,'run');notifyBackupChanged()
        }
        setMessage(hr?'Sačuvano.':'Saved.')
      }
    } catch(reason) {setError(reason instanceof Error?reason.message:'Backup unavailable');notifyBackupChanged()}
    finally {setBusy(false)}
  }
  return <section className="mt-5 rounded-3xl bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><DatabaseBackup size={19} className="text-violet-600"/>Automatic data backup</h2>
      <label className="flex items-center gap-2 text-xs font-semibold">AutoBackup {status?.enabled?'ON':'OFF'}<input type="checkbox" role="switch" aria-label="Automatic data backup" checked={status?.enabled??false} disabled={busy||!status||statusError} onChange={e=>void act('configure',{enabled:e.target.checked})} className="h-5 w-5 accent-violet-600"/></label></div>
    <p className="mt-3 text-xs text-slate-600">{hr?'Privatni Cloudflare R2 prostor vaše agencije. Svaki dan nakon 02:00 UTC, čak i kada aplikacija nije otvorena. Kopije se čuvaju 30 dana.':'Your agency’s private Cloudflare R2 storage. Daily after 02:00 UTC, even with the app closed. Backups are kept for 30 days.'}</p>
    <p className="mt-2 break-all text-[10px] text-slate-500">Cloudflare R2 · agencies/{agency.id}/</p>
    <p className="mt-2 text-[11px] text-slate-500">{hr?'Uključuje podatke i veze/metapodatke slika. Ne uključuje datoteke fotografija, lozinke niti korisničke račune za prijavu.':'Includes data and image links/metadata. Photo files, passwords and sign-in accounts are not included.'}</p>
    <p className="mt-3 text-xs">{hr?'Zadnja uspješna kopija: ':'Last successful backup: '}{status?.last_success_at?new Date(status.last_success_at).toLocaleString(hr?'hr-HR':'en-GB'):'—'}</p>
    {(error||status?.last_error||statusError)&&<p role="alert" className="mt-3 text-xs text-rose-700">{error||status?.last_error||(hr?'Status backupa nije dostupan.':'Backup status unavailable.')}</p>}
    {message&&<p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}
    <button disabled={busy||status?.running} onClick={()=>void act('run')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw size={14} className={busy?'animate-spin':''}/>{busy?(hr?'Radim…':'Working…'):(hr?'Napravi backup sada':'Backup now')}</button>
    <div className="mt-4 space-y-2">{runs.map(run=><div key={run.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-[11px]"><span>{new Date(run.started_at).toLocaleString(hr?'hr-HR':'en-GB')} · {run.status}{run.file_size?` · ${Math.ceil(run.file_size/1024)} KB`:''}</span>{run.status==='success'&&<button aria-label={hr?'Preuzmi kopiju':'Download backup'} disabled={busy} onClick={()=>void act('download',{run_id:run.id})} className="rounded-lg p-2 text-violet-600"><Download size={16}/></button>}</div>)}</div>
  </section>
}
