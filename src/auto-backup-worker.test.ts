// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { runBackup, type BackupEnv } from '../worker/agency-backups'

const agency='00000000-0000-0000-0000-000000000001'
function setup(failStorage=false, corrupt=false) {
  const actions:string[]=[]
  let saved=new Uint8Array()
  const env:BackupEnv={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',DATABASE_BACKUP_KEY:'server-only',ALLOWED_ORIGINS:'https://bookweb.pages.dev',BACKUPS:{
    put:vi.fn(async(_key,bytes)=>{if(failStorage)throw new Error('storage outage');saved=bytes;return {}}),
    get:vi.fn(async()=>({size:saved.byteLength,body:new ReadableStream(),arrayBuffer:async()=>corrupt?new Uint8Array(saved.length).buffer:saved.buffer as ArrayBuffer})),
    delete:vi.fn(async()=>{}),
  }}
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
    const body=JSON.parse(init.body);actions.push(body.p_action)
    if(body.p_action==='manual'||body.p_action==='scheduled')return Response.json({run_id:'run-1',storage_key:`agencies/${agency}/test.json`})
    if(body.p_action==='snapshot')return Response.json({format:'pomaaalodesk-agency-backup',agency:{id:agency},data:{reservations:[]}})
    return Response.json({ok:true})
  }))
  return {env,actions}
}
afterEach(()=>vi.unstubAllGlobals())
describe('automatic backup storage guarantees',()=>{
  it('marks success only after an R2 read-back matches the snapshot',async()=>{
    const {env,actions}=setup();await runBackup(env,agency,'owner')
    expect(actions).toEqual(['manual','snapshot','complete'])
    expect(env.BACKUPS.put).toHaveBeenCalledOnce();expect(env.BACKUPS.get).toHaveBeenCalledOnce()
  })
  it('records failure and never advances success when R2 fails',async()=>{
    const {env,actions}=setup(true);await expect(runBackup(env,agency,'owner')).rejects.toThrow('storage outage')
    expect(actions).toEqual(['manual','snapshot','fail'])
  })
  it('rejects a corrupted stored copy',async()=>{
    const {env,actions}=setup(false,true);await expect(runBackup(env,agency,'owner')).rejects.toThrow('verification')
    expect(actions).not.toContain('complete');expect(actions).toContain('fail')
  })
  it('does not expose objects to an unauthenticated request',async()=>{
    const {env}=setup()
    const response=await worker.fetch(new Request('https://worker/backup',{method:'POST',body:'{"action":"download"}'}),env)
    expect(response.status).toBe(401);expect(env.BACKUPS.get).not.toHaveBeenCalled()
  })
  it('rejects unapproved origins before authorization or storage',async()=>{
    const {env}=setup()
    const response=await worker.fetch(new Request('https://worker/backup',{method:'POST',headers:{Origin:'https://untrusted.example'}}),env)
    expect(response.status).toBe(403);expect(fetch).not.toHaveBeenCalled()
  })
})
