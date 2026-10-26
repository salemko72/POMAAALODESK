type R2StoredObject = {
  body: ReadableStream
  etag: string
  httpMetadata?: { contentType?: string; cacheControl?: string }
  writeHttpMetadata(headers: Headers): void
}

type PropertyImageBucket = {
  put(key: string, value: ArrayBuffer, options: {
    httpMetadata: { contentType: string; cacheControl: string }
    customMetadata: Record<string, string>
  }): Promise<unknown>
  get(key: string): Promise<R2StoredObject | null>
  delete(key: string): Promise<void>
}

type Env = {
  PROPERTY_IMAGES: PropertyImageBucket
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  ALLOWED_ORIGINS: string
}

type Member = { role?: string; is_active?: boolean }
type AuthenticatedUser = { id?: string }

const MAX_IMAGE_BYTES = 240 * 1024
// PostgreSQL's uuid type accepts the canonical hexadecimal shape without
// requiring RFC version/variant bits. Jolie Agency was migrated with the
// reserved UUID 00000000-0000-0000-0000-000000000001, so applying an RFC-only
// validator here incorrectly rejected valid database identifiers.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WRITE_ROLES = new Set(['owner', 'admin', 'manager'])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') return preflight(origin, env)

    if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
      return serveImage(url.pathname.slice('/images/'.length), env)
    }

    if (!originAllowed(origin, env)) return json({ error: 'Origin is not allowed.' }, 403, origin, env)

    if (request.method === 'POST' && url.pathname === '/v1/property-images') {
      return uploadImage(request, url, origin, env)
    }

    if (request.method === 'DELETE' && url.pathname === '/v1/property-images') {
      return deleteImage(request, origin, env)
    }

    return json({ error: 'Not found.' }, 404, origin, env)
  },
}

async function uploadImage(request: Request, requestUrl: URL, origin: string | null, env: Env): Promise<Response> {
  const agencyId = request.headers.get('X-Agency-Id')?.trim() ?? ''
  const propertyId = request.headers.get('X-Property-Id')?.trim() ?? ''
  if (!UUID_PATTERN.test(agencyId) || !UUID_PATTERN.test(propertyId)) {
    return json({ error: 'A valid agency and property are required.' }, 400, origin, env)
  }

  const auth = await authorizeWrite(request, agencyId, env)
  if ('error' in auth) return json({ error: auth.error }, auth.status, origin, env)

  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'image/webp' && contentType !== 'image/jpeg') {
    return json({ error: 'Only optimized WebP or JPEG images are accepted.' }, 415, origin, env)
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0)
  if (declaredLength > MAX_IMAGE_BYTES) return json({ error: 'Image is larger than 240 KB.' }, 413, origin, env)

  const bytes = await request.arrayBuffer()
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: 'Image is empty or larger than 240 KB.' }, 413, origin, env)
  }
  if (!matchesImageSignature(bytes, contentType)) {
    return json({ error: 'Image content does not match its format.' }, 415, origin, env)
  }

  const width = boundedInteger(request.headers.get('X-Image-Width'), 1, 1600)
  const height = boundedInteger(request.headers.get('X-Image-Height'), 1, 1600)
  const originalWidth = boundedInteger(request.headers.get('X-Original-Width'), 1, 20000)
  const originalHeight = boundedInteger(request.headers.get('X-Original-Height'), 1, 20000)
  const originalBytes = boundedInteger(request.headers.get('X-Original-Bytes'), 1, 30 * 1024 * 1024)
  if (!width || !height || !originalWidth || !originalHeight || !originalBytes) {
    return json({ error: 'Image metadata is invalid.' }, 400, origin, env)
  }

  const extension = contentType === 'image/webp' ? 'webp' : 'jpg'
  const key = `agencies/${agencyId}/properties/${propertyId}/${crypto.randomUUID()}.${extension}`
  await env.PROPERTY_IMAGES.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: {
      agencyId,
      propertyId,
      uploadedBy: auth.userId,
      width: String(width),
      height: String(height),
      originalWidth: String(originalWidth),
      originalHeight: String(originalHeight),
      originalBytes: String(originalBytes),
    },
  })

  return json({
    storageKey: key,
    url: `${requestUrl.origin}/images/${key}`,
  }, 201, origin, env)
}

async function deleteImage(request: Request, origin: string | null, env: Env): Promise<Response> {
  const agencyId = request.headers.get('X-Agency-Id')?.trim() ?? ''
  if (!UUID_PATTERN.test(agencyId)) return json({ error: 'A valid agency is required.' }, 400, origin, env)
  const auth = await authorizeWrite(request, agencyId, env)
  if ('error' in auth) return json({ error: auth.error }, auth.status, origin, env)

  let storageKey = ''
  try {
    const body = await request.json() as { storageKey?: unknown }
    storageKey = typeof body.storageKey === 'string' ? body.storageKey : ''
  } catch {
    return json({ error: 'Invalid request.' }, 400, origin, env)
  }
  if (!storageKey.startsWith(`agencies/${agencyId}/properties/`) || storageKey.includes('..')) {
    return json({ error: 'Image does not belong to this agency.' }, 403, origin, env)
  }
  await env.PROPERTY_IMAGES.delete(storageKey)
  return new Response(null, { status: 204, headers: corsHeaders(origin, env) })
}

async function serveImage(rawKey: string, env: Env): Promise<Response> {
  let key = ''
  try { key = decodeURIComponent(rawKey) } catch { return new Response('Invalid image key.', { status: 400 }) }
  if (!key.startsWith('agencies/') || key.includes('..')) return new Response('Invalid image key.', { status: 400 })
  const object = await env.PROPERTY_IMAGES.get(key)
  if (!object) return new Response('Image not found.', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.etag)
  headers.set('Cache-Control', object.httpMetadata?.cacheControl ?? 'public, max-age=31536000, immutable')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(object.body, { headers })
}

async function authorizeWrite(request: Request, agencyId: string, env: Env): Promise<
  { userId: string; role: string } | { error: string; status: number }
> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return { error: 'Authentication required.', status: 401 }

  const authHeaders = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: authorization,
  }
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders })
  if (!userResponse.ok) return { error: 'Session is invalid or expired.', status: 401 }
  const user = await userResponse.json() as AuthenticatedUser
  if (!user.id) return { error: 'Session is invalid.', status: 401 }

  const membershipUrl = new URL(`${env.SUPABASE_URL}/rest/v1/agency_memberships`)
  membershipUrl.searchParams.set('select', 'role,is_active')
  membershipUrl.searchParams.set('agency_id', `eq.${agencyId}`)
  membershipUrl.searchParams.set('user_id', `eq.${user.id}`)
  membershipUrl.searchParams.set('is_active', 'eq.true')
  membershipUrl.searchParams.set('limit', '1')
  const membershipResponse = await fetch(membershipUrl, {
    headers: { ...authHeaders, 'X-Agency-Id': agencyId },
  })
  if (!membershipResponse.ok) return { error: 'Agency membership could not be verified.', status: 403 }
  const members = await membershipResponse.json() as Member[]
  const role = members[0]?.role ?? ''
  if (!WRITE_ROLES.has(role)) return { error: 'Image management access is required.', status: 403 }
  return { userId: user.id, role }
}

function matchesImageSignature(bytes: ArrayBuffer, contentType: string): boolean {
  const view = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 12))
  if (contentType === 'image/jpeg') return view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff
  return view.length >= 12
    && String.fromCharCode(...view.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...view.slice(8, 12)) === 'WEBP'
}

function boundedInteger(value: string | null, minimum: number, maximum: number): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null
}

function originAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return true
  return env.ALLOWED_ORIGINS.split(',').map(value => value.trim()).includes(origin)
}

function preflight(origin: string | null, env: Env): Response {
  if (!originAllowed(origin, env)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: corsHeaders(origin, env) })
}

function corsHeaders(origin: string | null, env: Env): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Agency-Id, X-Property-Id, X-Image-Width, X-Image-Height, X-Original-Width, X-Original-Height, X-Original-Bytes',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  })
  if (origin && originAllowed(origin, env)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

function json(body: unknown, status: number, origin: string | null, env: Env): Response {
  const headers = corsHeaders(origin, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('X-Content-Type-Options', 'nosniff')
  return Response.json(body, { status, headers })
}
