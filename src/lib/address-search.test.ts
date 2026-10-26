import { describe, expect, it } from 'vitest'
import { parsePhotonFeature } from './address-search'

describe('address search', () => {
  it('maps a Photon feature into a property-friendly address', () => {
    const result = parsePhotonFeature({
      geometry: { coordinates: [16.592, 43.184] },
      properties: { street: 'Kralja Tomislava', housenumber: '27', postcode: '21460', city: 'Stari Grad', country: 'Croatia' },
    })
    expect(result).toMatchObject({ address: 'Kralja Tomislava 27', city: 'Stari Grad', latitude: 43.184, longitude: 16.592 })
  })
  it('returns null without coordinates', () => {
    expect(parsePhotonFeature({ properties: { street: 'Test' } })).toBeNull()
  })
})
