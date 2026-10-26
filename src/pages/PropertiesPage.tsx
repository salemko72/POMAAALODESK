
import { canEditProperty, type UserRole } from '../lib/permissions'
import { useEffect, useState } from 'react'
import { Building2, Check, ImagePlus, Link2, MapPin, Palette, Pencil, Plus, Ruler, Save, Trash2, UsersRound, Wifi, Wind, X } from 'lucide-react'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import { PropertyTimeline } from '../components/PropertyTimeline'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { createProperty, deleteProperty, deactivateProperty, getAllProperties, updateProperty, type Property } from '../lib/properties-repository'
import { propertyToFormValues, validateProperty, type PropertyFormValues } from '../lib/property-admin'
import { propertyImageStorage, type StoredPropertyImage } from '../lib/property-image-storage'
import { deletePropertyImageRecord, getPropertyImageRecord, savePropertyImageRecord, type PropertyImageRecord } from '../lib/property-images-repository'
import { getActiveAgencyId } from '../lib/agency-session'
import { getReservations, type Reservation } from '../lib/reservations-repository'
import { createExternalCalendar, deleteExternalCalendar, getExternalCalendars, updateExternalCalendar, type ExternalCalendarRecord } from '../lib/ical-repository'
import { useT } from '../lib/i18n'
import { getSettings, type MeasurementUnits } from '../lib/settings'
import { areaForDisplay, areaToSquareMeters, areaUnit, formatArea } from '../lib/measurement'

const fallbackImages: Record<string, string> = {
  Priko: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=700&fit=crop',
  Nelly: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&h=700&fit=crop',
  Pjaca: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=700&fit=crop',
}
const emptyForm: PropertyFormValues = { name: '', address: '', city: '', country: '', color: '#7C5CFC', latitude: null, longitude: null, capacity: 1, rooms: 1, area_m2: null, image_url: null, notes: '', check_in_time: '14:00', check_out_time: '10:00', parking: false, wifi: true, keybox: false, air_conditioning: true, cleaning_duration_minutes: 120, nightly_rate: null, currency: 'EUR', is_active: true }
const featureItems = [['wifi','Wi-Fi',Wifi],['air_conditioning','AC',Wind],['parking','Parking',Building2],['keybox','Keybox',Check]] as const
const linkSourceOptions = [['airbnb_ical', 'Airbnb'], ['booking_ical', 'Booking.com'], ['other_ical', 'Other']] as const
type CalendarLinkDraft = { source: ExternalCalendarRecord['source']; feed_url: string }

function mapEmbedUrl(latitude: number, longitude: number) { const d = 0.004; return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-d}%2C${latitude-d}%2C${longitude+d}%2C${latitude+d}&layer=mapnik&marker=${latitude}%2C${longitude}` }
function sourceName(source: ExternalCalendarRecord['source']) { return source === 'airbnb_ical' ? 'Airbnb' : source === 'booking_ical' ? 'Booking.com' : 'Other' }
function saveErrorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message
  if (reason && typeof reason === 'object') {
    const value = reason as Record<string, unknown>
    return [value.code && `[${String(value.code)}]`, value.message, value.details, value.hint]
      .filter(Boolean).map(String).join(' · ')
  }
  return String(reason || '')
}

export function PropertiesPage({ role = 'viewer' }: { role?: UserRole } = {}) {
  const t = useT()
  const [measurementUnits,setMeasurementUnits]=useState<MeasurementUnits>(()=>getSettings().measurementUnits)
  const [properties,setProperties]=useState<Property[]>([])
  const [form,setForm]=useState<PropertyFormValues>(emptyForm)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [editorOpen,setEditorOpen]=useState(false)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [imageBusy,setImageBusy]=useState(false)
  const [imageReport,setImageReport]=useState<StoredPropertyImage|null>(null)
  const [imagePreviewUrl,setImagePreviewUrl]=useState<string|null>(null)
  const [draftPropertyId,setDraftPropertyId]=useState<string|null>(null)
  const [persistedImage,setPersistedImage]=useState<PropertyImageRecord|null>(null)
  const [propertyReservations,setPropertyReservations]=useState<Reservation[]>([])
  const [calendarLinks,setCalendarLinks]=useState<ExternalCalendarRecord[]>([])
  const [draftLinks,setDraftLinks]=useState<CalendarLinkDraft[]>([])
  const [linksLoading,setLinksLoading]=useState(false)
  const [linksOpen,setLinksOpen]=useState(true)
  const [newLinkSource,setNewLinkSource]=useState<ExternalCalendarRecord['source']>('airbnb_ical')
  const [newLinkUrl,setNewLinkUrl]=useState('')
  const [linkSavingId,setLinkSavingId]=useState<string|null>(null)

  async function load(){setLoading(true);try{setProperties(await getAllProperties());setError(null)}catch{setError('Unable to load properties.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  useEffect(()=>{const sync=()=>setMeasurementUnits(getSettings().measurementUnits);window.addEventListener('booking-manager-settings-change',sync);return()=>window.removeEventListener('booking-manager-settings-change',sync)},[])
  useEffect(()=>()=>{
    if(imagePreviewUrl&&typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(imagePreviewUrl)
  },[imagePreviewUrl])

  function clearImagePreview(){setImagePreviewUrl(null)}

  function showImagePreview(file:File){
    clearImagePreview()
    if(typeof URL.createObjectURL!=='function')return
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  async function loadLinks(propertyId: string){setLinksLoading(true);try{setCalendarLinks(await getExternalCalendars(propertyId))}catch{setCalendarLinks([]);setError('Unable to load calendar links.')}finally{setLinksLoading(false)}}

  async function loadPersistedImage(propertyId:string){
    try{setPersistedImage(await getPropertyImageRecord(propertyId))}
    catch{setPersistedImage(null)}
  }

  function cancelImageWork(){clearImagePreview();setImageBusy(false)}
  function discardStagedImage(){
    const agencyId=getActiveAgencyId()
    if(imageReport?.provider==='r2'&&imageReport.storageKey&&agencyId){
      void propertyImageStorage.remove(imageReport,{agencyId}).catch(()=>undefined)
    }
  }
  function resetEditor(discardPendingImage:boolean){
    if(discardPendingImage)discardStagedImage()
    cancelImageWork();setEditorOpen(false);setEditingId(null);setDraftPropertyId(null);setForm({...emptyForm});setImageReport(null);setPersistedImage(null);setCalendarLinks([]);setDraftLinks([]);setLinksOpen(true);setNewLinkUrl('')
  }
  function startCreate(){if(!['owner','admin'].includes(role))return;discardStagedImage();cancelImageWork();setEditingId(null);setDraftPropertyId(crypto.randomUUID());setEditorOpen(true);setForm({...emptyForm});setImageReport(null);setPersistedImage(null);setPropertyReservations([]);setCalendarLinks([]);setDraftLinks([]);setLinksOpen(true);setNewLinkUrl('');setMessage(null);setError(null)}
  async function startEdit(property:Property){discardStagedImage();cancelImageWork();setEditingId(property.id);setDraftPropertyId(null);setEditorOpen(true);setForm(propertyToFormValues(property));setImageReport(null);setPersistedImage(null);setDraftLinks([]);setMessage(null);setError(null);setLinksOpen(false);setNewLinkUrl('');if(canEditProperty(role)){void loadLinks(property.id);void loadPersistedImage(property.id)}try{setPropertyReservations(await getReservations('2000-01-01T00:00:00','2100-01-01T00:00:00'))}catch{setPropertyReservations([])}}
  function closeEditor(){resetEditor(true)}
  function set<K extends keyof PropertyFormValues>(key:K,value:PropertyFormValues[K]){setForm(current=>({...current,[key]:value}))}
  async function handleImageChange(file?:File){
    if(!file)return
    const agencyId=getActiveAgencyId()
    const propertyId=editingId||draftPropertyId
    if(!agencyId||!propertyId){setError('Choose an agency before adding a property image.');return}
    const previousStaged=imageReport
    showImagePreview(file);setImageBusy(true);setImageReport(null);setError(null)
    try{
      const stored=await propertyImageStorage.store(file,{agencyId,propertyId})
      set('image_url',stored.url);setImageReport(stored);clearImagePreview()
      if(previousStaged?.provider==='r2'&&previousStaged.storageKey&&previousStaged.storageKey!==stored.storageKey){
        void propertyImageStorage.remove(previousStaged,{agencyId}).catch(()=>undefined)
      }
    }catch(err){
      clearImagePreview();setError(err instanceof Error?err.message:'Unable to read image.')
    }finally{
      setImageBusy(false)
    }
  }

  function addDraftCalendarLink(){if(!newLinkUrl.trim())return;setDraftLinks(current=>[...current,{source:newLinkSource,feed_url:newLinkUrl.trim()}]);setNewLinkUrl('')}
  function removeDraftCalendarLink(index:number){setDraftLinks(current=>current.filter((_,itemIndex)=>itemIndex!==index))}

  async function persistPropertyImage(propertyId:string){
    const agencyId=getActiveAgencyId()
    if(!agencyId)return
    if(imageReport?.provider==='r2'&&imageReport.storageKey){
      await savePropertyImageRecord(propertyId,imageReport)
      if(persistedImage?.storage_key&&persistedImage.storage_key!==imageReport.storageKey){
        await propertyImageStorage.remove({storageKey:persistedImage.storage_key},{agencyId})
      }
      return
    }
    if(persistedImage&&(imageReport?.provider==='inline'||!form.image_url)){
      await deletePropertyImageRecord(propertyId)
      await propertyImageStorage.remove({storageKey:persistedImage.storage_key},{agencyId})
    }
  }

  async function save(){
    if(!canEditProperty(role))return;
    const validationError=validateProperty(form);if(validationError){setError(validationError);return}
    setSaving(true);setError(null);setMessage(null)
    try{
      let propertyId=editingId
      const creating=!propertyId
      if(propertyId)await updateProperty(propertyId,form)
      else{
        const created=await createProperty(form,draftPropertyId||undefined)
        propertyId=created.id
        setEditingId(created.id)
      }
      await persistPropertyImage(propertyId)
      for(const link of draftLinks){await createExternalCalendar({property_id:propertyId,source:link.source,feed_url:link.feed_url,is_active:true,last_synced_at:null,sync_status:'idle'})}
      setDraftLinks([]);setCalendarLinks(calendarLinks);await load();resetEditor(false);setMessage(creating?'Property created.':'Property updated.')
    }catch(reason){
      const message = saveErrorMessage(reason)
      const detail = message ? ` ${message}` : ''
      setError(`Unable to save property.${detail}`)
    }finally{setSaving(false)}
  }

  async function reactivate(){if(!editingId)return;setSaving(true);try{await updateProperty(editingId,{is_active:true});closeEditor();await load()}catch{setError(t('propertyActionFailed'))}finally{setSaving(false)}}
  async function reactivateProperty(id:string){try{await updateProperty(id,{is_active:true});await load()}catch{setError(t('propertyActionFailed'))}}
  async function removeProperty(){if(!editingId||!['owner','admin'].includes(role)||!window.confirm(t('confirmDeleteProperty')))return;setSaving(true);try{const agencyId=getActiveAgencyId();const storageKey=persistedImage?.storage_key;await deleteProperty(editingId);if(agencyId&&storageKey)await propertyImageStorage.remove({storageKey},{agencyId});resetEditor(true);await load()}catch{setError(t('propertyActionFailed'))}finally{setSaving(false)}}
  async function deactivate(){if(!editingId)return;setSaving(true);setError(null);try{await deactivateProperty(editingId);closeEditor();setMessage('Property deactivated.');await load()}catch{setError('Unable to deactivate property.')}finally{setSaving(false)}}
  async function addCalendarLink(){if(!editingId||!newLinkUrl.trim())return;setLinkSavingId('new');setError(null);try{const created=await createExternalCalendar({property_id:editingId,source:newLinkSource,feed_url:newLinkUrl.trim(),is_active:true,last_synced_at:null,sync_status:'idle'});setCalendarLinks(current=>[...current,created]);setNewLinkUrl('');setMessage('Calendar link added.')}catch{setError('Unable to add calendar link.')}finally{setLinkSavingId(null)}}
  async function saveCalendarLink(link:ExternalCalendarRecord){setLinkSavingId(link.id);setError(null);try{const updated=await updateExternalCalendar(link.id,{source:link.source,feed_url:link.feed_url,is_active:link.is_active});setCalendarLinks(current=>current.map(item=>item.id===updated.id?updated:item));setMessage('Calendar link updated.')}catch{setError('Unable to update calendar link.')}finally{setLinkSavingId(null)}}
  async function removeCalendarLink(id:string){setLinkSavingId(id);setError(null);try{await deleteExternalCalendar(id);setCalendarLinks(current=>current.filter(item=>item.id!==id));setMessage('Calendar link removed.')}catch{setError('Unable to remove calendar link.')}finally{setLinkSavingId(null)}}
  const activeProperties = properties.filter(property => property.is_active)
  const inactiveProperties = properties.filter(property => !property.is_active)
  const visibleImageUrl = imagePreviewUrl || form.image_url

  return <section className="mx-auto w-full min-w-0 max-w-6xl p-3 pb-8 md:p-5">
    <style>{`section:has(button[aria-label="Close property editor"]) label:has(input[step="0.01"]) { display: none; }`}</style>
    <header className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">{t('portfolio')}</p><h1 className="mt-1 text-[2.938rem] font-light leading-[.95] tracking-tight sm:text-[3.7rem]">{t('properties')}<AgencyTitleMark /></h1><p className="mt-1 text-xs text-slate-500">{t('homesDetailsAvailability')}</p></div>{['owner','admin'].includes(role)&&<button type="button" onClick={startCreate} className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-violet-700"><Plus size={16}/><span className="hidden sm:inline">{t('newProperty')}</span></button>}</header>
    {error&&<div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">{error}</div>}{message&&<div role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">{message}</div>}
    <div className={`${editorOpen ? 'flex min-w-0 flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_430px]' : 'block'} items-start`}>
      <div data-testid="properties-grid" className={`grid items-start grid-cols-2 gap-3 md:grid-cols-3 ${editorOpen ? '' : 'properties-grid-wide'}`}>
        {loading?<p className="col-span-2 text-xs text-slate-500 md:col-span-3">Loading properties...</p>:properties.length===0?<div className="col-span-2 rounded-[1.35rem] bg-white p-7 text-center md:col-span-3"><p className="text-base font-semibold">No properties yet</p><p className="mt-1 text-xs text-slate-500">Create your first property to start managing availability.</p></div>:[...activeProperties,...(inactiveProperties.length?[{id:'inactive-divider',name:'Inactive properties',is_active:false} as Property]:[]),...inactiveProperties].map(property=>{
          if(property.id==='inactive-divider') return <div key={property.id} className="col-span-full border-t border-slate-300 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Inactive properties</div>
          const image=property.image_url||fallbackImages[property.name]
          return <article key={property.id} data-testid="property-card" className="relative aspect-square self-start overflow-hidden rounded-[1.5rem] border border-[#e5ded3] bg-white shadow-[0_8px_24px_rgba(76,62,45,0.04)]">
            <button type="button" onClick={()=>void startEdit(property)} aria-label={`${canEditProperty(role) ? 'Edit' : 'View'} ${property.name}`} className="flex h-full w-full flex-col text-left transition hover:bg-[#fffdfa]"><div className="relative min-h-0 flex-1 bg-slate-100">{image?<img src={image} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-violet-500"><Building2 size={32}/></div>}<span className="absolute left-2.5 top-2.5 h-2 w-8 rounded-full" style={{backgroundColor:property.color||'#7C5CFC'}}/><span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-1.5 py-1 text-[9px] font-semibold text-slate-600">{property.is_active?t('active'):t('inactive')}</span></div><div className="p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{property.name}</h2><p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-500"><MapPin size={10}/>{property.city||property.address||'No address'}</p></div><Pencil size={14} className="shrink-0 text-slate-300"/></div><div className="mt-2 flex gap-1.5 text-[10px] text-slate-500"><span aria-label={`${property.capacity} guests`} className="flex items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-1"><UsersRound size={10}/>{property.capacity}</span><span className="flex items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-1"><Ruler size={10}/>{formatArea(property.area_m2,measurementUnits)}</span>{property.air_conditioning&&<span className="flex items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-1"><Wind size={10}/>AC</span>}</div></div></button>
            {!property.is_active && <button type="button" onClick={()=>void reactivateProperty(property.id)} className="absolute bottom-2 right-2 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">{t('reactivateProperty')}</button>}
          </article>
        })}
      </div>

      {editorOpen&&!canEditProperty(role)&&<section className="order-first w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-white p-5"><button onClick={closeEditor} className="float-right p-2">Close</button><h2 className="text-xl font-semibold">{form.name}</h2><p className="mt-3">{[form.address,form.city,form.country].filter(Boolean).join(', ')}</p><p className="mt-2">{form.capacity} guests · {form.rooms} rooms · {formatArea(form.area_m2,measurementUnits)}</p><p className="mt-2">Check-in {form.check_in_time} · Check-out {form.check_out_time}</p><p className="mt-2 whitespace-pre-wrap">{form.notes}</p>{editingId&&<PropertyTimeline property={properties.find(p=>p.id===editingId)!} reservations={propertyReservations}/>}</section>}
      {editorOpen&&canEditProperty(role)&&<section className="order-first w-full min-w-0 max-w-full overflow-hidden rounded-[1.35rem] border border-[#e5ded3] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-500">{editingId?t('editProperty'):t('newProperty')}</p><h2 className="mt-1 text-lg font-semibold tracking-tight">{editingId?form.name||'Property':t('propertyDetails')}</h2></div><button type="button" onClick={closeEditor} aria-label="Close property editor" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16}/></button></div>
        <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-1.5"><input aria-label="Property image" type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={e=>void handleImageChange(e.target.files?.[0])}/>{visibleImageUrl?<div className="relative h-36 overflow-hidden rounded-lg"><img src={visibleImageUrl} alt="Property preview" className="h-full w-full object-cover"/><span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">{imageBusy?t('optimizingImage'):t('changeImage')}</span></div>:<div className="flex h-36 flex-col items-center justify-center rounded-lg bg-white text-center"><ImagePlus size={22} className="text-violet-500"/><p className="mt-1.5 text-xs font-semibold">{t('addPropertyImage')}</p><p className="mt-0.5 text-[10px] text-slate-500">{t('imageHint')}</p></div>}</label>
        {imageBusy&&<p className="mt-1.5 text-[10px] font-medium text-violet-600">{t('optimizingImage')}</p>}
        {imageReport&&<p data-testid="property-image-report" className="mt-1.5 text-[10px] text-slate-500">{imageReport.originalWidth}×{imageReport.originalHeight} · {formatImageBytes(imageReport.originalBytes)} → {imageReport.width}×{imageReport.height} · {formatImageBytes(imageReport.bytes)} {imageReport.format.toUpperCase()}</p>}
        {visibleImageUrl&&<button type="button" onClick={()=>{discardStagedImage();cancelImageWork();set('image_url',null);setImageReport(null)}} className="mt-1.5 text-[10px] font-semibold text-slate-500 hover:text-rose-600">{t('removeImage')}</button>}
        <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-[11px] font-semibold text-slate-600 md:col-span-2">{t('name')}<input aria-label="Name" value={form.name} onChange={e=>set('name',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400"/></label><div className="md:col-span-2"><AddressAutocomplete value={{address:form.address,city:form.city,country:form.country,latitude:form.latitude,longitude:form.longitude}} onChange={v=>{set('address',v.address);set('city',v.city);set('country',v.country);set('latitude',v.latitude);set('longitude',v.longitude)}}/></div><label className="text-[11px] font-semibold text-slate-600">{t('city')}<input aria-label={t('city')} value={form.city} onChange={e=>set('city',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('country')}<input aria-label={t('country')} value={form.country} onChange={e=>set('country',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('guests')}<input type="number" min={1} value={form.capacity} onChange={e=>set('capacity',Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('rooms')}<input type="number" min={1} value={form.rooms} onChange={e=>set('rooms',Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('area')} ({areaUnit(measurementUnits)})<input type="number" min={0} step="0.1" value={areaForDisplay(form.area_m2,measurementUnits)??''} onChange={e=>set('area_m2',e.target.value?areaToSquareMeters(Number(e.target.value),measurementUnits):null)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('pricePerNight')}<input type="number" min={0} step="0.01" value={form.nightly_rate ?? ""} onChange={e=>set('nightly_rate',e.target.value===""?null:Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('cleaning')} (min)<input type="number" min={0} value={form.cleaning_duration_minutes} onChange={e=>set('cleaning_duration_minutes',Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('checkIn')}<input type="time" value={form.check_in_time} onChange={e=>set('check_in_time',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">{t('checkOut')}<input type="time" value={form.check_out_time} onChange={e=>set('check_out_time',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label></div>
        <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-600"><Palette size={14} className="text-slate-400"/>{t('color')}<input aria-label={t('color')} type="color" value={form.color} onChange={e=>set('color',e.target.value)} className="ml-auto h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"/></label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">{featureItems.map(([key,label,Icon])=><label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={Boolean(form[key])} onChange={e=>set(key,e.target.checked as PropertyFormValues[typeof key])} className="h-3.5 w-3.5 accent-violet-600"/><Icon size={13} className="text-slate-400"/>{label}</label>)}</div>
        <label className="mt-2 block text-[11px] font-semibold text-slate-600">{t('notes')}<textarea rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label>

        <section className="mt-3 rounded-2xl border border-[#e5ded3] bg-[#fffdfa] p-3">
          <button type="button" onClick={()=>setLinksOpen(current=>!current)} className="flex w-full items-center justify-between text-left">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Link2 size={15} className="text-violet-500"/>Calendar links<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500">{editingId?calendarLinks.length:draftLinks.length}</span></span>
            <span className="text-[10px] font-semibold text-violet-600">{linksOpen?'Hide':'Open'}</span>
          </button>
          {linksOpen && <div className="mt-3 space-y-2">
            {editingId ? (
              linksLoading ? <p className="text-[10px] text-slate-500">Loading links…</p> : calendarLinks.map(link => (
                <div key={link.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[115px_1fr_auto]">
                    <select aria-label={`Source for ${link.id}`} value={link.source} onChange={e=>setCalendarLinks(current=>current.map(item=>item.id===link.id?{...item,source:e.target.value as ExternalCalendarRecord['source']}:item))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px]">{linkSourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
                    <input aria-label={`URL for ${link.id}`} type="url" value={link.feed_url} onChange={e=>setCalendarLinks(current=>current.map(item=>item.id===link.id?{...item,feed_url:e.target.value}:item))} className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px]"/>
                    <div className="flex gap-1.5"><button type="button" aria-label={`Save ${sourceName(link.source)} link`} disabled={linkSavingId===link.id} onClick={()=>void saveCalendarLink(link)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white"><Save size={13}/></button><button type="button" aria-label={`Delete ${sourceName(link.source)} link`} disabled={linkSavingId===link.id} onClick={()=>void removeCalendarLink(link.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13}/></button></div>
                  </div>
                </div>
              ))
            ) : draftLinks.map((link,index) => (
              <div key={`${link.source}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-[115px_1fr_auto]">
                <select aria-label={`Draft source ${index+1}`} value={link.source} onChange={e=>setDraftLinks(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,source:e.target.value as ExternalCalendarRecord['source']}:item))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px]">{linkSourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
                <input aria-label={`Draft URL ${index+1}`} type="url" value={link.feed_url} onChange={e=>setDraftLinks(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,feed_url:e.target.value}:item))} className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px]"/>
                <button type="button" aria-label={`Remove draft link ${index+1}`} onClick={()=>removeDraftCalendarLink(index)} className="flex h-8 items-center justify-center rounded-lg bg-slate-100 px-3 text-[10px] font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13}/></button>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-2.5">
              <p className="text-[10px] font-semibold text-slate-700">Add calendar link</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[115px_1fr_auto]">
                <select aria-label="New calendar source" value={newLinkSource} onChange={e=>setNewLinkSource(e.target.value as ExternalCalendarRecord['source'])} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px]">{linkSourceOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
                <input aria-label="New calendar link" type="url" placeholder="https://…/calendar.ics" value={newLinkUrl} onChange={e=>setNewLinkUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(editingId)void addCalendarLink();else addDraftCalendarLink()}}} className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px]"/>
                <button type="button" aria-label="Add calendar link" disabled={!newLinkUrl.trim()||linkSavingId==='new'} onClick={()=>editingId?void addCalendarLink():addDraftCalendarLink()} className="flex h-8 items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 text-[10px] font-semibold text-white disabled:opacity-50"><Plus size={12}/>Add</button>
              </div>
            </div>
          </div>}
        </section>

        {form.latitude!=null&&form.longitude!=null&&<div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-600"><MapPin size={13} className="text-violet-500"/>{t('mapPreview')}</div><iframe title={t('mapPreview')} src={mapEmbedUrl(form.latitude,form.longitude)} className="h-36 w-full border-0" loading="lazy"/></div>}
        <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-3">
          <p className="text-sm font-bold text-slate-900">{t('pricePerNight')}</p>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_110px] gap-2">
            <input aria-label={t('pricePerNight')} type="number" min={0} step="0.01" value={form.nightly_rate ?? ''} onChange={e=>set('nightly_rate',e.target.value===''?null:Number(e.target.value))} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-base font-bold outline-none focus:border-violet-500"/>
            <label className="block text-[10px] font-bold text-slate-600">{t('currency')}<select aria-label={t('currency')} value={form.currency ?? 'EUR'} onChange={e=>set('currency',e.target.value)} className="mt-1 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold"><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option><option>BAM</option></select></label>
          </div>
        </div>
        <div className="mt-3 flex gap-2"><button type="button" disabled={saving||imageBusy} onClick={()=>void save()} className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving?'Saving…':editingId?t('saveChanges'):t('createProperty')}</button>{editingId&&<button type="button" disabled={saving} onClick={()=>void (form.is_active ? deactivate() : reactivate())} className="rounded-xl bg-slate-100 px-3 py-2.5 text-[10px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">{form.is_active?t('deactivate'):t('reactivateProperty')}</button>}</div>
        {editingId&&<PropertyTimeline property={properties.find(p=>p.id===editingId)!} reservations={propertyReservations}/>} 
        {editingId&&['owner','admin'].includes(role)&&<button type="button" disabled={saving} onClick={()=>void removeProperty()} className="mt-5 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50">{t('deleteProperty')}</button>}</section>}
    </div>
  </section>
}

function formatImageBytes(bytes:number){return bytes>=1024*1024?`${(bytes/(1024*1024)).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`}

