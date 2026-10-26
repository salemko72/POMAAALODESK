import { useEffect, useState } from 'react'
import { getReservations, type Reservation } from '../lib/reservations-repository'
import { listBlocks, overlapsBlock } from '../lib/operations'
import { hasReservationConflict } from '../lib/reservation-rules'
import { useIcalSync } from '../lib/ical-sync-context'
import { useAppLanguage } from '../lib/i18n'
import type { Property } from '../lib/properties-repository'
import { PropertyTimeline } from './PropertyTimeline'

export function BookingAvailability({ property, start, end, exclude }: { property: Property; start: string; end: string; exclude?: string }) {
  const { revision } = useIcalSync(), hr = useAppLanguage()==='hr'
  const [items,setItems]=useState<Reservation[]>([]),[status,setStatus]=useState('')
  useEffect(()=>{
    let alive=true;setStatus('loading')
    if(!start || !end)return
    const last = new Date(`${start}T12:00:00Z`);last.setUTCDate(last.getUTCDate()+30)
    const until=last.toISOString().slice(0,10)>end?last.toISOString().slice(0,10):end
    Promise.all([getReservations(`${start}T00:00:00`,`${until}T23:59:59`),listBlocks()]).then(([reservations,blocks])=>{
      if(!alive)return
      setItems(reservations)
      setStatus(hasReservationConflict(reservations,property.id,start,end,exclude)||blocks.some(b=>overlapsBlock(b,property.id,start,end))?'occupied':'')
    }).catch(()=>{if(alive)setStatus('error')})
    return()=>{alive=false}
  },[property.id,start,end,exclude,revision])
  return <>{status && <p role={status==='loading'?'status':'alert'} className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{status==='loading'?(hr?'Provjeravam zauzetost…':'Checking availability…'):status==='error'?(hr?'Nije moguće provjeriti zauzetost. Pokušaj ponovno.':'Could not verify availability. Try again.'):(hr?'Odabrana noćenja se preklapaju s rezervacijom ili blokadom.':'These nights overlap a reservation or blocked dates.')}</p>}<PropertyTimeline property={property} reservations={items} startDate={start}/></>
}
