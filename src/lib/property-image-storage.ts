import { processImageFile, type ImageProcessingReport, type ProcessedImage } from './property-image'
import { supabase } from './supabase'

export type PropertyImageContext = {
  agencyId: string
  propertyId?: string | null
}

export type StoredPropertyImage = ImageProcessingReport & {
  url: string
  provider: 'inline' | 'r2'
  storageKey: string | null
}

export interface PropertyImageStorage {
  store(file: File, context: PropertyImageContext): Promise<StoredPropertyImage>
  remove(image: Pick<StoredPropertyImage, 'storageKey'>, context: Pick<PropertyImageContext, 'agencyId'>): Promise<void>
}

export class InlinePropertyImageStorage implements PropertyImageStorage {
  async store(file: File): Promise<StoredPropertyImage> {
    const processed = await processImageFile(file, 'property')
    return storedResult(processed, processed.dataUrl, 'inline', null)
  }

  async remove(): Promise<void> {}
}

export type R2UploadTicket = {
  uploadUrl: string
  publicUrl: string
  storageKey: string
  headers?: Record<string, string>
}

export type R2UploadTicketIssuer = (
  context: PropertyImageContext,
  image: ImageProcessingReport,
) => Promise<R2UploadTicket>

// Ready for the future Worker/R2 endpoint. The UI uses the same `store`
// contract regardless of whether bytes are temporarily inline or stored in R2.
export class R2PropertyImageStorage implements PropertyImageStorage {
  private readonly issueUploadTicket: R2UploadTicketIssuer

  constructor(issueUploadTicket: R2UploadTicketIssuer) {
    this.issueUploadTicket = issueUploadTicket
  }

  async store(file: File, context: PropertyImageContext): Promise<StoredPropertyImage> {
    const processed = await processImageFile(file, 'property')
    const ticket = await this.issueUploadTicket(context, processed)
    const response = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': processed.mimeType, ...ticket.headers },
      body: processed.blob,
    })
    if (!response.ok) throw new Error(`Image upload failed (${response.status}).`)
    return storedResult(processed, ticket.publicUrl, 'r2', ticket.storageKey)
  }

  async remove(): Promise<void> {
    throw new Error('This R2 adapter does not provide deletion.')
  }
}

type WorkerUploadResponse = { storageKey?: string; url?: string; error?: string }

export class CloudflareR2PropertyImageStorage implements PropertyImageStorage {
  private readonly apiUrl: string

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '')
  }

  async store(file: File, context: PropertyImageContext): Promise<StoredPropertyImage> {
    if (!context.propertyId) throw new Error('Property image could not be assigned to the property.')
    const processed = await processImageFile(file, 'property')
    const accessToken = await currentAccessToken()
    const response = await fetch(`${this.apiUrl}/v1/property-images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': processed.mimeType,
        'X-Agency-Id': context.agencyId,
        'X-Property-Id': context.propertyId,
        'X-Image-Width': String(processed.width),
        'X-Image-Height': String(processed.height),
        'X-Original-Width': String(processed.originalWidth),
        'X-Original-Height': String(processed.originalHeight),
        'X-Original-Bytes': String(processed.originalBytes),
      },
      body: processed.blob,
    })
    const result = await safeJson(response)
    if (!response.ok || !result.storageKey || !result.url) {
      throw new Error(result.error || `Image upload failed (${response.status}).`)
    }
    return storedResult(processed, result.url, 'r2', result.storageKey)
  }

  async remove(image: Pick<StoredPropertyImage, 'storageKey'>, context: Pick<PropertyImageContext, 'agencyId'>): Promise<void> {
    if (!image.storageKey) return
    const accessToken = await currentAccessToken()
    const response = await fetch(`${this.apiUrl}/v1/property-images`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Agency-Id': context.agencyId,
      },
      body: JSON.stringify({ storageKey: image.storageKey }),
    })
    if (!response.ok && response.status !== 404) {
      const result = await safeJson(response)
      throw new Error(result.error || `Image deletion failed (${response.status}).`)
    }
  }
}

async function currentAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Please sign in again before uploading an image.')
  return session.access_token
}

async function safeJson(response: Response): Promise<WorkerUploadResponse> {
  try { return await response.json() as WorkerUploadResponse }
  catch { return {} }
}

function storedResult(
  image: ProcessedImage,
  url: string,
  provider: StoredPropertyImage['provider'],
  storageKey: string | null,
): StoredPropertyImage {
  return {
    url,
    provider,
    storageKey,
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
    originalBytes: image.originalBytes,
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    mimeType: image.mimeType,
    format: image.format,
    compressionRatio: image.compressionRatio,
  }
}

// Existing deployments remain compatible until the Worker URL is configured.
// Once present, every new property image is stored in R2 without UI changes.
const propertyImageApiUrl = String(import.meta.env.VITE_PROPERTY_IMAGE_API_URL ?? '').trim()
export const propertyImageStorage: PropertyImageStorage = propertyImageApiUrl
  ? new CloudflareR2PropertyImageStorage(propertyImageApiUrl)
  : new InlinePropertyImageStorage()
