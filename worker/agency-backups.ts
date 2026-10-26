type StoredObject = { body: ReadableStream; size: number; arrayBuffer(): Promise<ArrayBuffer> }
export type BackupEnv = {
  BACKUPS: {
    put(key: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string }; customMetadata: Record<string,string> }): Promise<unknown>
    get(key: string): Promise<StoredObject | null>
    delete(key: string): Promise<void>
  }
  SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; DATABASE_BACKUP_KEY: string; ALLOWED_ORIGINS: string
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function rpc<T>(env: BackupEnv, action: string, agency?: string, run?: string, info: Record<string,unknown> = {}): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/auto_backup_worker`, {
    method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: env.DATABASE_BACKUP_KEY, p_action: action, p_agency: agency ?? null, p_run: run ?? null, p_info: info }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) {
    const error = await response.json() as { message?: string; code?: string }
    if (error.code === '42501') throw new Error('Backup access denied')
    if (error.message?.startsWith('Backup already')) throw new Error(error.message)
    throw new Error('Backup database unavailable')
  }
  return response.json() as Promise<T>
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(hash), x=>x.toString(16).padStart(2,'0')).join('')
}
export async function runBackup(env: BackupEnv, agency: string, userId?: string) {
  const ticket = await rpc<{run_id:string;storage_key:string}|null>(env,userId?'manual':'scheduled',agency,undefined,{user_id:userId})
  if (!ticket) return { skipped: true }
  try {
    const document = await rpc<{format:string;agency:{id:string}}>(env,'snapshot',agency,ticket.run_id)
    if (document.format !== 'pomaaalodesk-agency-backup' || document.agency.id !== agency) throw new Error('Backup scope mismatch')
    const bytes = new TextEncoder().encode(JSON.stringify(document))
    // Fail explicitly before memory/storage limits; never silently truncate data.
    if (bytes.byteLength > 40 * 1024 * 1024) throw new Error('Backup exceeds current 40 MB limit')
    const checksum = await sha256(bytes)
    await env.BACKUPS.put(ticket.storage_key, bytes, { httpMetadata: {contentType:'application/json'},customMetadata:{agency,sha256:checksum} })
    const stored = await env.BACKUPS.get(ticket.storage_key)
    if (!stored || stored.size !== bytes.byteLength || await sha256(new Uint8Array(await stored.arrayBuffer())) !== checksum) throw new Error('Backup verification failed')
    await rpc(env,'complete',agency,ticket.run_id,{file_size:bytes.byteLength,sha256:checksum})
    return { ok:true,run_id:ticket.run_id }
  } catch (error) {
    await rpc(env,'fail',agency,ticket.run_id).catch(()=>{})
    throw error
  }
}
export async function scheduledBackups(env: BackupEnv) {
  // Daily snapshots after 02:00 UTC; 15-minute checks also retry outages.
  if (new Date().getUTCHours() >= 2) {
    const agencies = await rpc<string[]>(env,'due')
    for (const agency of agencies) {
      try { await runBackup(env,agency) } catch { console.error('Scheduled agency backup failed') }
    }
  }
  const expired = await rpc<{id:string;storage_key:string}[]>(env,'expired')
  for (const run of expired) {
    await env.BACKUPS.delete(run.storage_key)
    await rpc(env,'expire',undefined,run.id)
  }
}
export default {
  async scheduled(_event: unknown, env: BackupEnv, ctx: {waitUntil(promise:Promise<unknown>):void}) { ctx.waitUntil(scheduledBackups(env)) },
  async fetch(request: Request, env: BackupEnv): Promise<Response> {
    const origin = request.headers.get('Origin') || ''
    const allowed = env.ALLOWED_ORIGINS.split(',').includes(origin)
    const headers = new Headers({'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'})
    if (allowed) headers.set('Access-Control-Allow-Origin',origin)
    headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Agency-Id')
    headers.set('Access-Control-Allow-Methods','POST, OPTIONS')
    const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers})
    if (origin && !allowed) return json({error:'Origin not allowed'},403)
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers})
    if (request.method!=='POST' || new URL(request.url).pathname!=='/backup') return json({error:'Not found'},404)
    try {
      const authorization=request.headers.get('Authorization')
      const agency=request.headers.get('X-Agency-Id')||''
      if (!authorization?.startsWith('Bearer ') || !uuid.test(agency)) return json({error:'Sign in and select an agency'},401)
      const auth=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:authorization},signal:AbortSignal.timeout(15000)})
      if (!auth.ok) return json({error:'Sign in again'},401)
      const user=await auth.json() as {id:string}
      if (Number(request.headers.get('Content-Length')||0)>2048) return json({error:'Request too large'},413)
      const raw=await request.text()
      if (raw.length>2048) return json({error:'Request too large'},413)
      const body=JSON.parse(raw) as {action:string;enabled?:boolean;run_id?:string}
      if (body.action==='configure') {
        if (typeof body.enabled!=='boolean') return json({error:'Invalid setting'},400)
        return json(await rpc(env,'configure',agency,undefined,{user_id:user.id,enabled:body.enabled}))
      }
      if (body.action==='list') return json(await rpc(env,'list',agency,undefined,{user_id:user.id}))
      if (body.action==='run') return json(await runBackup(env,agency,user.id))
      if (body.action==='download' && uuid.test(body.run_id||'')) {
        const meta=await rpc<{storage_key:string;sha256:string}>(env,'download',agency,body.run_id,{user_id:user.id})
        const file=await env.BACKUPS.get(meta.storage_key)
        if (!file) return json({error:'Backup file unavailable'},404)
        headers.set('Content-Disposition',`attachment; filename="agency-backup-${body.run_id}.json"`)
        return new Response(file.body,{headers})
      }
      return json({error:'Invalid backup action'},400)
    } catch (error) {
      const message=error instanceof Error?error.message:'Backup unavailable'
      return json({error:message},message==='Backup access denied'?403:500)
    }
  },
}
