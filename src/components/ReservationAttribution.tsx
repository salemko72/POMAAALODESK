import type { Reservation } from '../lib/reservations-repository'

export function ReservationAttribution({reservation,hr}:{reservation:Reservation;hr:boolean}) {
  function name(kind:Reservation['created_actor_kind'],value?:string|null) {
    if(kind==='ical') return hr?'Automatski iCal uvoz':'Automatic iCal import'
    if(kind==='system') return hr?'Sistem':'System'
    if(kind==='user') return value || (hr?'Korisnik bez imena':'Unnamed user')
    return hr?'Nije zabilježeno':'Not recorded'
  }
  const modified=reservation.last_modified_actor_kind || reservation.last_modified_at
    ? name(reservation.last_modified_actor_kind,reservation.last_modified_by_name)
    : reservation.created_actor_kind ? (hr?'Još nema izmjena':'No edits yet') : (hr?'Nije zabilježeno':'Not recorded')
  return <dl className="mt-4 grid gap-3 border-t border-slate-200 pt-3 text-[11px] sm:grid-cols-2" aria-label={hr?'Evidencija rezervacije':'Reservation attribution'}>
    <div><dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{hr?'Rezervaciju napravio':'Created by'}</dt><dd className="mt-1 break-words font-medium text-slate-700">{name(reservation.created_actor_kind,reservation.created_by_name)}</dd></div>
    <div><dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{hr?'Zadnje prepravke radio':'Last edited by'}</dt><dd className="mt-1 break-words font-medium text-slate-700">{modified}</dd>{reservation.last_modified_at&&<dd className="mt-0.5 text-[10px] text-slate-500"><time dateTime={reservation.last_modified_at}>{new Date(reservation.last_modified_at).toLocaleString(hr?'hr-HR':'en-GB')}</time></dd>}</div>
  </dl>
}
