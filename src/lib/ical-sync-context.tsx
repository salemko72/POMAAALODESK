/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAgency } from './agency-context'

export type Overlap = { property_id: string; property_name: string; a_id: string; b_id: string; a_name: string; b_name: string; a_source: string; b_source: string; overlap_start: string; overlap_end: string; possible: boolean; can_link: boolean; acknowledged: boolean }
export type IcalStatus = { id: string; property_name: string; source: string; sync_status: string; last_synced_at: string | null; sync_error: string | null; event_count: number }
type SyncState = { overlaps: Overlap[]; calendars: IcalStatus[]; busy: boolean; error: string; revision: number; sync: (force?: boolean, calendarId?: string) => Promise<void>; acknowledge: (overlap: Overlap, reopen?: boolean) => Promise<void> }
const empty: SyncState = { overlaps: [], calendars: [], busy: false, error: '', revision: 0, sync: async () => {}, acknowledge: async () => {} }
const Context = createContext<SyncState>(empty)
export const useIcalSync = () => useContext(Context)

export function IcalSyncProvider({ children }: { children: React.ReactNode }) {
  const agency = useAgency()
  const [overlaps, setOverlaps] = useState<Overlap[]>([])
  const [calendars, setCalendars] = useState<IcalStatus[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const inFlight = useRef(false), stamp = useRef(''), lastAttempt = useRef(0), alive = useRef(true)
  const refresh = useCallback(async () => {
    const [alerts, status] = await Promise.all([supabase.rpc('get_booking_overlaps'), supabase.rpc('get_ical_sync_status')])
    if (alerts.error || status.error) throw new Error('Unable to verify calendar sync and overlaps')
    if (!alive.current) return
    setOverlaps(alerts.data ?? []); setCalendars(status.data ?? [])
    const next = JSON.stringify((status.data ?? []).map((c: IcalStatus) => [c.id,c.last_synced_at]))
    if (stamp.current && stamp.current !== next) setRevision(n => n + 1)
    stamp.current = next
  }, [])
  const sync = useCallback(async (force = false, calendarId?: string) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); lastAttempt.current = Date.now()
    try {
      const { data, error: failure } = await supabase.functions.invoke('ical-sync', { body: { force, calendar_id: calendarId } })
      if (failure || data?.error) throw new Error(data?.error || 'Calendar sync unavailable. Try again.')
      await refresh()
      if (data?.results?.some((r: { status: string }) => r.status === 'error')) setError('Some calendars could not be synchronized. Previous data is preserved.')
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Calendar sync unavailable') }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }, [refresh])
  const acknowledge = useCallback(async (overlap: Overlap, reopen = false) => {
    const { error } = await supabase.rpc('confirm_same_stay', { p_a: overlap.a_id, p_b: overlap.b_id, p_reopen: reopen })
    if (error) throw error
    await refresh()
  }, [refresh])
  useEffect(() => {
    alive.current = true
    if (agency.role === 'cleaning') return
    void refresh().catch(() => setError('Unable to verify calendar availability'))
    void sync()
    const wake = () => { if (document.visibilityState === 'visible' && Date.now()-lastAttempt.current>300000) void sync() }
    const timer = window.setInterval(() => { void sync() }, 900000)
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh().catch(() => setError('Unable to verify calendar availability')) }, 60000)
    const changed = () => { void refresh().catch(() => {}); setRevision(n=>n+1) }
    const failed = () => setError('Link saved, but synchronization failed. Try Sync now.')
    window.addEventListener('ical-sync-error', failed)
    window.addEventListener('ical-links-changed', wake); window.addEventListener('booking-data-changed', changed)
    document.addEventListener('visibilitychange', wake)
    return () => { alive.current = false; clearInterval(timer); clearInterval(poll); window.removeEventListener('ical-sync-error', failed); window.removeEventListener('ical-links-changed', wake); window.removeEventListener('booking-data-changed', changed); document.removeEventListener('visibilitychange', wake) }
  }, [agency.id, agency.role, refresh, sync])
  return <Context.Provider value={{ overlaps, calendars, busy, error, revision, sync, acknowledge }}>{children}</Context.Provider>
}
