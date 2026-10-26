import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { parseIcal, validateFeedUrl } from './parser.ts'

const url = Deno.env.get('SUPABASE_URL')!
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, key, { auth: { persistSession: false } })
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-agency-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405)
  try {
    const body = await req.json()
    let ids: string[] = []
    if (typeof body.job_token === 'string') {
      // Single-use, short-lived cron capability. Only the DB scheduler can mint it.
      const { data, error } = await admin.rpc('consume_ical_job', { p_token: body.job_token })
      if (error || !data) return reply({ error: 'Invalid scheduled job' }, 401)
      ids = [data]
    } else {
      const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
      if (!token) return reply({ error: 'Sign in required' }, 401)
      const { data: auth, error } = await admin.auth.getUser(token)
      if (error || !auth.user) return reply({ error: 'Sign in required' }, 401)
      const agency = req.headers.get('x-agency-id')
      if (!agency) return reply({ error: 'Agency required' }, 400)
      // The caller's RLS limits property access; service access below is scoped to these IDs.
      const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}`, 'x-agency-id': agency } }, auth: { persistSession: false } })
      const { data: properties, error: propertyError } = await caller.from('properties').select('id').eq('agency_id', agency)
      if (propertyError || !properties?.length) return reply({ results: [] })
      const { data: calendars, error: calendarError } = await admin.from('external_calendars').select('id').in('property_id', properties.map(p => p.id)).eq('is_active', true)
      if (calendarError) throw calendarError
      ids = (calendars ?? []).filter(c => !body.calendar_id || c.id === body.calendar_id).map(c => c.id)
    }
    const results: unknown[] = []
    // Bounded concurrency protects the providers; each cron invocation handles one calendar.
    for (let i = 0; i < ids.length; i += 4) {
      results.push(...await Promise.all(ids.slice(i, i + 4).map(async id => {
        const { data: lease, error: claimError } = await admin.rpc('claim_ical_sync', { p_calendar: id, p_force: body.force === true })
        if (claimError) return { id, status: 'error', error: 'Unable to start sync' }
        if (!lease) return { id, status: 'skipped' }
        try {
          const response = await fetch(validateFeedUrl(lease.feed_url), { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Accept: 'text/calendar' } })
          if (!response.ok) throw new Error(`Calendar provider returned HTTP ${response.status}`)
          const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0
          while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); throw new Error('Calendar exceeds 2 MB limit') }; chunks.push(value) }
          const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
          const events = parseIcal(new TextDecoder().decode(bytes))
          if (events.length > 5000) throw new Error('Calendar exceeds 5000 events')
          const { data, error } = await admin.rpc('apply_ical_snapshot', { p_calendar: id, p_lease: lease.lease, p_events: events })
          if (error) throw new Error('Calendar could not be saved; existing data preserved')
          return { id, status: 'success', events: data }
        } catch (err) {
          const message = err instanceof Error && !/fetch|network|url|https|request/i.test(err.message) ? err.message : 'Unable to download calendar; check the link and try again'
          await admin.rpc('fail_ical_sync', { p_calendar: id, p_lease: lease.lease, p_error: message })
          return { id, status: 'error', error: message }
        }
      })))
    }
    return reply({ results })
  } catch { return reply({ error: 'Calendar sync unavailable. Try again.' }, 500) }
})
