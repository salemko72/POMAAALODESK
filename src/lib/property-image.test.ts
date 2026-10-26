import { describe, expect, it } from 'vitest'
import { calculateImageDimensions, PROPERTY_IMAGE_POLICY, validateImageFile } from './property-image'

describe('property image validation', () => {
  it('accepts normal images and iPhone HEIC files', () => {
    expect(validateImageFile(new File(['image'], 'house.jpg', { type: 'image/jpeg' }))).toBeNull()
    expect(validateImageFile(new File(['image'], 'IMG_1042.HEIC', { type: '' }))).toBeNull()
  })

  it('rejects non-images and protects the browser from extremely large sources', () => {
    expect(validateImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe('Please choose an image file.')
    const tooLarge = new File([new Uint8Array(30 * 1024 * 1024 + 1)], 'camera.jpg', { type: 'image/jpeg' })
    expect(validateImageFile(tooLarge)).toBe('The source image is larger than 30 MB.')
  })
})

describe('display-derived property dimensions', () => {
  it('reduces a typical landscape phone photo using an 800px short edge', () => {
    expect(calculateImageDimensions(4032, 3024)).toEqual({ width: 1067, height: 800 })
  })

  it('keeps enough horizontal pixels for a portrait photo used in object-cover cards', () => {
    expect(calculateImageDimensions(3024, 4032)).toEqual({ width: 800, height: 1067 })
  })

  it('caps panoramic images without distorting their aspect ratio', () => {
    expect(calculateImageDimensions(8000, 2000)).toEqual({ width: 1600, height: 400 })
  })

  it('never upscales a smaller image', () => {
    expect(calculateImageDimensions(640, 480)).toEqual({ width: 640, height: 480 })
  })

  it('uses the measured file-size budget instead of a generic 2 MB target', () => {
    expect(PROPERTY_IMAGE_POLICY.targetBytes).toBe(160 * 1024)
    expect(PROPERTY_IMAGE_POLICY.hardMaxBytes).toBe(240 * 1024)
  })
})
