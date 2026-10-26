import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAgency } from './agency-context'

export type AutoBackupStatus = { enabled:boolean; last_success_at:string|null; last_error:string|null; running:boolean }
export type BackupRun = {id:string;status:string;started_at:string;finished_at:string|null;file_size:number|null;expires_at:string;error:string|null;sha256:string|null}
const endpoint = 'https://pomaaalodesk-backups.salemko.workers.dev/backup'

export async function backupRequest(agencyId:string, action:string, extra:Record<string,unknown>={}) {
  const {data:{session}}=await supabase.auth.getSession()
  if (!session) throw new Error('Sign in again')
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'X-Agency-Id':agencyId,'Content-Type':'application/json'},body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(120000)})
  if (!response.ok) { const body=await response.json().catch(()=>({})); throw new Error(body.error||'Backup unavailable') }
  return response
}
export function notifyBackupChanged() { window.dispatchEvent(new Event('auto-backup-changed')) }
export function useAutoBackupStatus() {
  const {id}=useAgency()
  const [status,setStatus]=useState<AutoBackupStatus|null>(null)
  const [error,setError]=useState(false)
  const refresh=useCallback(async()=>{
    const result=await supabase.rpc('get_auto_backup_status')
    if(result.error) throw result.error
    return result.data as AutoBackupStatus
  },[])
  useEffect(()=>{
    let alive=true
    const update=()=>void refresh().then(value=>{if(alive){setStatus(value);setError(false)}}).catch(()=>{if(alive)setError(true)})
    setStatus(null);update()
    const timer=window.setInterval(update,60000)
    window.addEventListener('auto-backup-changed',update)
    window.addEventListener('focus',update)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('auto-backup-changed',update);window.removeEventListener('focus',update)}
  },[id,refresh])
  return {status,error}
}
