// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './property-images'

const agencyId = '00000000-0000-4000-8000-000000000001'
const propertyId = '00000000-0000-4000-8000-000000000002'

class MemoryBucket {
  objects = new Map<string, { bytes: ArrayBuffer; options: unknown }>()

  async put(key: string, bytes: ArrayBuffer, options: unknown) {
    this.objects.set(key, { bytes, options })
  }

  async get(key: string) {
    const stored = this.objects.get(key)
    if (!stored) return null
    return {
      body: new Blob([stored.bytes]).stream(),
      etag: 'test-etag',
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
      writeHttpMetadata(headers: Headers) { headers.set('Content-Type', 'image/webp') },
    }
  }

  async delete(key: string) { this.objects.delete(key) }
}

function env(bucket = new MemoryBucket()) {
  return {
    PROPERTY_IMAGES: bucket,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    ALLOWED_ORIGINS: 'https://bookweb.pages.dev,http://127.0.0.1:4173',
  }
}

function validWebp() {
  return new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50,1,2,3,4])
}

function uploadRequest(
  body: Uint8Array,
  origin = 'https://bookweb.pages.dev',
  selectedAgencyId = agencyId,
  selectedPropertyId = propertyId,
) {
  return new Request('https://pomaaalodesk-images.workers.dev/v1/property-images', {
    method: 'POST',
    headers: {
      Origin: origin,
      Authorization: 'Bearer valid-token',
      'Content-Type': 'image/webp',
      'X-Agency-Id': selectedAgencyId,
      'X-Property-Id': selectedPropertyId,
      'X-Image-Width': '1067',
      'X-Image-Height': '800',
      'X-Original-Width': '4032',
      'X-Original-Height': '3024',
      'X-Original-Bytes': '5000000',
    },
    body,
  })
}

function mockSupabaseAccess() {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ id: '00000000-0000-4000-8000-000000000003' }))
    .mockResolvedValueOnce(Response.json([{ role: 'owner', is_active: true }])))
}

afterEach(() => vi.unstubAllGlobals())

describe('property image Worker', () => {
  it('stores only authenticated optimized images in an agency-scoped key', async () => {
    mockSupabaseAccess()
    const bucket = new MemoryBucket()
    const response = await worker.fetch(uploadRequest(validWebp()), env(bucket))
    const result = await response.json() as { storageKey: string; url: string }
    expect(response.status).toBe(201)
    expect(result.storageKey).toMatch(new RegExp(`^agencies/${agencyId}/properties/${propertyId}/.+\\.webp$`))
    expect(result.url).toContain(`/images/${result.storageKey}`)
    expect(bucket.objects.has(result.storageKey)).toBe(true)
  })

  it('accepts the reserved PostgreSQL UUID used by the migrated Jolie Agency', async () => {
    mockSupabaseAccess()
    const bucket = new MemoryBucket()
    const legacyAgencyId = '00000000-0000-0000-0000-000000000001'
    const response = await worker.fetch(
      uploadRequest(validWebp(), 'https://bookweb.pages.dev', legacyAgencyId),
      env(bucket),
    )
    const result = await response.json() as { storageKey: string }

    expect(response.status).toBe(201)
    expect(result.storageKey).toMatch(new RegExp(`^agencies/${legacyAgencyId}/properties/${propertyId}/`))
  })

  it('rejects a file whose bytes do not match its declared format', async () => {
    mockSupabaseAccess()
    const response = await worker.fetch(uploadRequest(new Uint8Array([1,2,3,4])), env())
    expect(response.status).toBe(415)
  })

  it('rejects requests from an unknown web origin', async () => {
    const response = await worker.fetch(uploadRequest(validWebp(), 'https://attacker.example'), env())
    expect(response.status).toBe(403)
  })

  it('will not delete an image outside the selected agency prefix', async () => {
    mockSupabaseAccess()
    const request = new Request('https://pomaaalodesk-images.workers.dev/v1/property-images', {
      method: 'DELETE',
      headers: { Origin: 'https://bookweb.pages.dev', Authorization: 'Bearer valid-token', 'Content-Type': 'application/json', 'X-Agency-Id': agencyId },
      body: JSON.stringify({ storageKey: 'agencies/00000000-0000-4000-8000-000000000099/properties/x/photo.webp' }),
    })
    const response = await worker.fetch(request, env())
    expect(response.status).toBe(403)
  })
})
