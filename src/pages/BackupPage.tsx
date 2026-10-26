import { AutoBackupSettings } from '../components/AutoBackup'
import { useState } from 'react'
import { CheckCircle2, DatabaseBackup, Download, Upload } from 'lucide-react'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { supabase } from '../lib/supabase'
import { useAppLanguage } from '../lib/i18n'
import { useAgency } from '../lib/agency-context'

type Row = Record<string, unknown>
const options = [
  ['properties','Properties','Nekretnine'], ['guests','Guests','Gosti'], ['reservations','Reservations','Rezervacije'],
  ['availability_blocks','Blocked dates','Blokirani datumi'], ['property_tasks','Tasks','Zadaci'], ['cleaning_tasks','Cleaning tasks','Čišćenja'],
  ['external_calendars','Calendar sources','Izvori kalendara'], ['booking_conflicts','Booking conflicts','Sukobi rezervacija'],
  ['agency_memberships','People & roles','Ljudi i uloge'], ['profiles','User profiles','Korisnički profili'], ['property_access','Property permissions','Prava na nekretnine'],
] as const
const operationalOrder = ['properties','guests','external_calendars','reservations','availability_blocks','property_tasks','cleaning_tasks','booking_conflicts'] as const

export function BackupPage() {
  const agency = useAgency(); const hr = useAppLanguage()==='hr'
  const [selected,setSelected]=useState<string[]>(options.map(([key])=>key))
  const [message,setMessage]=useState(''); const [error,setError]=useState(''); const [working,setWorking]=useState(false)

  async function readAll(table:string):Promise<Row[]> {
    const rows:Row[]=[]
    for(let from=0;;from+=500){const {data,error}=await supabase.from(table).select('*').range(from,from+499);if(error)throw error;rows.push(...((data??[]) as Row[]));if(!data||data.length<500)break}
    return rows
  }
  async function exportData(){
    setWorking(true);setError('');setMessage('')
    try {
      const data:Record<string,Row[]>={}
      for(const table of selected)data[table]=await readAll(table)
      const backupDocument={format:'pomaaalodesk-agency-backup',version:2,exportedAt:new Date().toISOString(),agency:{id:agency.id,name:agency.name,slug:agency.slug,logo_url:agency.logo_url,country:agency.country,language:agency.language,currency:agency.currency,timezone:agency.timezone},data}
      const url=URL.createObjectURL(new Blob([JSON.stringify(backupDocument,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${agency.slug}-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
      setMessage(hr?'Sigurnosna kopija je preuzeta.':'Backup downloaded.')
    } catch(reason){setError(reason instanceof Error?reason.message:(hr?'Izvoz nije uspio.':'Export failed.'))}finally{setWorking(false)}
  }
  async function upsert(table:string,rows:Row[]){if(!rows.length)return;for(let start=0;start<rows.length;start+=200){const {error}=await supabase.from(table).upsert(rows.slice(start,start+200));if(error)throw new Error(`${table}: ${error.message}`)}}
  async function importData(file?:File){
    if(!file)return
    setWorking(true);setError('');setMessage('')
    try{
      const parsed=JSON.parse(await file.text()) as {format?:string;agency?:{id?:string};data?:Record<string,Row[]>}
      if(!parsed.data||typeof parsed.data!=='object')throw new Error(hr?'Datoteka nema ispravan format.':'Invalid backup format.')
      const original=parsed.data
      const propertyRows=Array.isArray(original.properties)?original.properties:[]
      const propertyIds=propertyRows.map((row)=>String(row.id??'')).filter(Boolean)
      let sameAgency=parsed.agency?.id===agency.id
      if(!parsed.agency?.id&&propertyIds.length){const {data}=await supabase.from('properties').select('id').in('id',propertyIds.slice(0,100));sameAgency=Boolean(data?.length)}
      const maps={property:new Map<string,string>(),guest:new Map<string,string>(),calendar:new Map<string,string>(),reservation:new Map<string,string>(),block:new Map<string,string>(),task:new Map<string,string>(),cleaning:new Map<string,string>(),conflict:new Map<string,string>()}
      const mapId=(map:Map<string,string>,value:unknown)=>{const old=String(value??'');if(!old)return old;if(sameAgency)return old;if(!map.has(old))map.set(old,crypto.randomUUID());return map.get(old)!}
      const remapped:Record<string,Row[]>={}
      for(const table of operationalOrder){
        const rows=Array.isArray(original[table])?original[table]:[]
        remapped[table]=rows.map((source)=>{
          const row={...source}
          if(table==='properties'){row.id=mapId(maps.property,row.id);row.agency_id=agency.id}
          if(table==='guests'){row.id=mapId(maps.guest,row.id);row.agency_id=agency.id}
          if(table==='external_calendars'){row.id=mapId(maps.calendar,row.id);row.property_id=mapId(maps.property,row.property_id)}
          if(table==='reservations'){row.id=mapId(maps.reservation,row.id);row.property_id=mapId(maps.property,row.property_id);if(row.guest_id)row.guest_id=mapId(maps.guest,row.guest_id);if(row.external_calendar_id)row.external_calendar_id=mapId(maps.calendar,row.external_calendar_id)}
          if(table==='availability_blocks'){row.id=mapId(maps.block,row.id);row.property_id=mapId(maps.property,row.property_id)}
          if(table==='property_tasks'){row.id=mapId(maps.task,row.id);row.property_id=mapId(maps.property,row.property_id)}
          if(table==='cleaning_tasks'){row.id=mapId(maps.cleaning,row.id);row.property_id=mapId(maps.property,row.property_id);row.reservation_id=mapId(maps.reservation,row.reservation_id)}
          if(table==='booking_conflicts'){row.id=mapId(maps.conflict,row.id);row.property_id=mapId(maps.property,row.property_id);row.reservation_a_id=mapId(maps.reservation,row.reservation_a_id);row.reservation_b_id=mapId(maps.reservation,row.reservation_b_id);row.resolved_by=null}
          return row
        })
      }
      for(const table of operationalOrder)await upsert(table,remapped[table])
      const sourceAccess=Array.isArray(original.property_access)?original.property_access:[]
      if(sourceAccess.length){
        const {data:members}=await supabase.from('agency_memberships').select('user_id')
        const memberIds=new Set((members??[]).map((row)=>String(row.user_id)))
        const accessRows=sourceAccess.filter((row)=>memberIds.has(String(row.user_id??''))).map((row)=>({...row,property_id:mapId(maps.property,row.property_id)}))
        await upsert('property_access',accessRows)
      }
      setMessage(sameAgency?(hr?'Podaci su obnovljeni u trenutnoj agenciji.':'Current agency restored.'):(hr?'Podaci su kopirani u trenutnu agenciju s novim sigurnim identifikatorima.':'Data copied into the current agency with new safe identifiers.'))
    }catch(reason){setError(reason instanceof Error?reason.message:(hr?'Uvoz nije uspio.':'Import failed.'))}finally{setWorking(false)}
  }
  return <section className="mx-auto max-w-4xl p-4 pb-8 md:p-6"><header><p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">{hr?'ADMINISTRACIJA':'ADMINISTRATION'}</p><h1 className="mt-1 text-[2.938rem] font-light leading-[.95] tracking-tight sm:text-[3.7rem]">{hr?'Sigurnosna kopija':'Data backup'}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{hr?`Izvezite ili obnovite sve podatke agencije ${agency.name}.`:`Export or restore all data for ${agency.name}.`}</p></header>
    <AutoBackupSettings />
    {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}{message&&<p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700"><CheckCircle2 size={16}/>{message}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-2"><section className="rounded-3xl bg-white p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><DatabaseBackup size={19}/></span><div><h2 className="text-sm font-semibold">{hr?'Izvoz':'Export'}</h2><p className="text-[10px] text-slate-500">{hr?'Odaberite šta ulazi u kopiju.':'Choose what is included.'}</p></div></div><div className="mt-4 grid gap-2">{options.map(([key,en,hrLabel])=><label key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs"><span>{hr?hrLabel:en}</span><input type="checkbox" checked={selected.includes(key)} onChange={(e)=>setSelected((current)=>e.target.checked?[...current,key]:current.filter((item)=>item!==key))} className="h-4 w-4 accent-violet-600"/></label>)}</div><button disabled={working||!selected.length} onClick={()=>void exportData()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"><Download size={15}/>{hr?'Preuzmi kopiju':'Download backup'}</button></section>
      <section className="self-start rounded-3xl bg-white p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Upload size={19}/></span><div><h2 className="text-sm font-semibold">{hr?'Uvoz':'Import'}</h2><p className="text-[10px] text-slate-500">{hr?'Obnovite istu agenciju ili kopirajte podatke u novu.':'Restore this agency or copy data into a new one.'}</p></div></div><p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">{hr?'Ako uvozite kopiju u drugu agenciju, aplikacija automatski stvara nove identifikatore i čuva veze između nekretnina, gostiju, rezervacija i zadataka. Korisnički računi se iz sigurnosnih razloga ponovo pozivaju kroz People.':'When importing into another agency, new identifiers are created while all property, guest, booking and task links are preserved. User accounts must be invited again through People.'}</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold hover:border-violet-300"><Upload size={15}/>{working?(hr?'Obrada…':'Working…'):(hr?'Odaberi backup datoteku':'Choose backup file')}<input disabled={working} type="file" accept="application/json" className="sr-only" onChange={(e)=>void importData(e.target.files?.[0])}/></label></section></div>
  </section>
}
