import { DatePicker } from './DatePicker'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { blockReasons, saveBlock } from '../lib/operations'
import type { Property } from '../lib/properties-repository'
import { translateValue, useAppLanguage, useT } from '../lib/i18n'

export function BlockDatesDialog({ properties, propertyId, start, end, onClose }: { properties: Property[]; propertyId: string; start: string; end: string; onClose: () => void }) {
 const t = useT(), language = useAppLanguage()
 const dialog = useRef<HTMLDialogElement>(null)
 const [property,setProperty]=useState(propertyId), [from,setFrom]=useState(start), [until,setUntil]=useState(end), [reason,setReason]=useState<string>(blockReasons[0]), [notes,setNotes]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false), [saved,setSaved]=useState(false)
 useEffect(()=>{dialog.current?.showModal()},[])
 return <dialog ref={dialog} onCancel={e=>{if(busy)e.preventDefault();else onClose()}} className="m-auto w-[min(95vw,480px)] rounded-3xl p-5 backdrop:bg-slate-950/30"><h2 className="text-2xl font-semibold">{t('blockDates')}</h2>{saved ? <div role="status" className="space-y-4 py-4"><p>{t('datesBlocked')}</p><Link to="/blocks">{t('viewBlocks')}</Link><button onClick={onClose} className="ml-4 rounded-xl bg-violet-600 p-2 text-white">{t('done')}</button></div> : <form className="mt-4 grid gap-3" onSubmit={async e=>{e.preventDefault();setError('');if(until<=from){setError(t('endAfterStart'));return}setBusy(true);try{await saveBlock({property_id:property,start_date:from,end_date:until,reason,notes});setSaved(true)}catch{setError(t('unableBlockDates'))}finally{setBusy(false)}}}>
 <label>{t('properties')}<select required value={property} onChange={e=>setProperty(e.target.value)} className="block w-full rounded-xl border p-2">{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <div>{t('from')}<DatePicker label={t('from')} value={from} onChange={setFrom}/></div>
 <div>{t('availableAgain')}<DatePicker label={t('availableAgain')} value={until} onChange={setUntil}/></div>
 <label>{t('reason')}<select value={reason} onChange={e=>setReason(e.target.value)} className="block w-full rounded-xl border p-2">{blockReasons.map(r=><option key={r} value={r}>{translateValue(language,r)}</option>)}</select></label>
 <label>{t('notes')}<textarea value={notes} onChange={e=>setNotes(e.target.value)} className="block w-full rounded-xl border p-2"/></label>
 <p className="text-sm text-slate-500">{t('blockDatesHint')}</p>{error&&<p role="alert" className="text-rose-700">{error}</p>}
 <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2 text-white">{busy?t('saving'):t('blockDates')}</button></div>
 </form>}</dialog>
}
