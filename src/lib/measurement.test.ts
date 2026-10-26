import { describe, expect, it } from 'vitest'
import { areaForDisplay, areaToSquareMeters, formatArea } from './measurement'

describe('area measurement conversion', () => {
  it('converts stored square metres to square feet for imperial display', () => {
    expect(areaForDisplay(61, 'imperial')).toBe(656.6)
    expect(formatArea(61, 'imperial')).toBe('656.6 ft²')
  })

  it('converts edited square feet back to square metres for storage', () => {
    expect(areaToSquareMeters(656.6, 'imperial')).toBe(61)
    expect(formatArea(61, 'metric')).toBe('61 m²')
  })
})
