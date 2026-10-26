export type ImagePurpose = 'property' | 'agency-logo'

export type ImageProcessingReport = {
  originalWidth: number
  originalHeight: number
  originalBytes: number
  width: number
  height: number
  bytes: number
  mimeType: string
  format: 'webp' | 'jpeg'
  compressionRatio: number
}

export type ProcessedImage = ImageProcessingReport & {
  blob: Blob
  dataUrl: string
}

type ImagePolicy = {
  maxShortEdge: number
  maxLongEdge: number
  targetBytes: number
  hardMaxBytes: number
  qualitySteps: readonly number[]
}

// The largest property photo in the current UI is 398 CSS px wide in the
// property editor. The largest grid crop is about 363 x 275 CSS px. An
// 800-pixel short edge covers both at 2x density without retaining camera-size
// originals; the long-edge cap only affects unusually panoramic images.
export const PROPERTY_IMAGE_POLICY: ImagePolicy = {
  maxShortEdge: 800,
  maxLongEdge: 1600,
  targetBytes: 160 * 1024,
  hardMaxBytes: 240 * 1024,
  qualitySteps: [0.72, 0.64, 0.56, 0.48, 0.4],
}

const AGENCY_LOGO_POLICY: ImagePolicy = {
  maxShortEdge: 384,
  maxLongEdge: 512,
  targetBytes: 55 * 1024,
  hardMaxBytes: 90 * 1024,
  qualitySteps: [0.72, 0.62, 0.52, 0.42],
}

const MAX_SOURCE_BYTES = 30 * 1024 * 1024
const ACCEPTED_EXTENSIONS = /\.(avif|heic|heif|jpe?g|png|webp)$/i

export function validateImageFile(file: File): string | null {
  const imageMime = file.type.startsWith('image/')
  if (!imageMime && !ACCEPTED_EXTENSIONS.test(file.name)) return 'Please choose an image file.'
  if (file.size > MAX_SOURCE_BYTES) return 'The source image is larger than 30 MB.'
  return null
}

export function calculateImageDimensions(
  width: number,
  height: number,
  purpose: ImagePurpose = 'property',
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Could not determine the image size.')
  }
  const policy = purpose === 'agency-logo' ? AGENCY_LOGO_POLICY : PROPERTY_IMAGE_POLICY
  const shortEdge = Math.min(width, height)
  const longEdge = Math.max(width, height)
  const scale = Math.min(1, policy.maxShortEdge / shortEdge, policy.maxLongEdge / longEdge)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

type DecodedImage = {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies EXIF orientation before dimensions and pixels are
      // used. This is especially relevant for photos coming from iOS cameras.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() }
    } catch {
      // Safari 17+ can decode HEIC. Other browsers may fail here, so continue
      // through the native <img> decoder before showing a useful error.
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    throw new Error('This device cannot process images automatically.')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(
        /\.(heic|heif)$/i.test(file.name)
          ? 'This browser cannot decode HEIC. On iPhone choose Most Compatible/JPEG or update Safari.'
          : 'Could not decode the image.',
      ))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      dispose: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('This device cannot process images automatically.')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function draw(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This device cannot process images automatically.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Could not prepare the optimized image.'))
    reader.readAsDataURL(blob)
  })
}

async function encodeBestCandidate(canvas: HTMLCanvasElement, policy: ImagePolicy): Promise<Blob> {
  let smallest: Blob | null = null
  for (const quality of policy.qualitySteps) {
    let candidate = await canvasToBlob(canvas, 'image/webp', quality)
    // Safari versions without WebP encoding may return null or silently return
    // another format. Fall back to JPEG instead of aborting the whole preview.
    if (!candidate || candidate.type !== 'image/webp') candidate = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (!candidate) continue
    if (!smallest || candidate.size < smallest.size) smallest = candidate
    if (candidate.size <= policy.targetBytes) return candidate
  }
  if (smallest && smallest.size <= policy.hardMaxBytes) return smallest
  throw new Error(smallest
    ? 'Image could not be compressed to the application storage limit.'
    : 'This browser could not encode the optimized image.')
}

export async function processImageFile(
  file: File,
  purpose: ImagePurpose = 'property',
): Promise<ProcessedImage> {
  const validationError = validateImageFile(file)
  if (validationError) throw new Error(validationError)

  const policy = purpose === 'agency-logo' ? AGENCY_LOGO_POLICY : PROPERTY_IMAGE_POLICY
  const decoded = await decodeImage(file)
  try {
    let dimensions = calculateImageDimensions(decoded.width, decoded.height, purpose)
    let canvas = draw(decoded.source, dimensions.width, dimensions.height)
    let blob: Blob
    try {
      blob = await encodeBestCandidate(canvas, policy)
    } catch {
      // Highly detailed/noisy photos may not meet the hard size cap at the
      // display-derived dimensions. One controlled reduction is preferable to
      // storing a multi-megabyte image that the UI cannot display.
      dimensions = {
        width: Math.max(1, Math.round(dimensions.width * 0.85)),
        height: Math.max(1, Math.round(dimensions.height * 0.85)),
      }
      canvas = draw(decoded.source, dimensions.width, dimensions.height)
      blob = await encodeBestCandidate(canvas, policy)
    }
    const dataUrl = await blobToDataUrl(blob)
    const format = blob.type === 'image/webp' ? 'webp' : 'jpeg'
    return {
      blob,
      dataUrl,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
      originalBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
      bytes: blob.size,
      mimeType: blob.type,
      format,
      compressionRatio: file.size > 0 ? blob.size / file.size : 0,
    }
  } finally {
    decoded.dispose()
  }
}

// Kept for agency-logo callers and older code. Property uploads use the
// storage abstraction in property-image-storage.ts.
export async function readImageFile(file: File, purpose: ImagePurpose = 'property'): Promise<string> {
  return (await processImageFile(file, purpose)).dataUrl
}
