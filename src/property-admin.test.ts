import { describe, expect, it } from 'vitest'
import { propertyToFormValues, validateProperty } from './lib/property-admin'

describe('property administration', () => {
  const valid = {
    name: 'Priko',
    address: '',
    city: '',
    country: '',
    color: '#7C5CFC',
    latitude: null,
    longitude: null,
    capacity: 6,
    rooms: 3,
    area_m2: 61,
    image_url: null,
    notes: '',
    check_in_time: '14:00',
    check_out_time: '10:00',
    parking: false,
    wifi: true,
    keybox: false,
    air_conditioning: true,
    cleaning_duration_minutes: 120,
    nightly_rate: null,
    currency: 'EUR',
    is_active: true,
  }

  it('rejects invalid property values', () => {
    expect(validateProperty({ ...valid, name: '' })).toBe('Enter a property name.')
    expect(validateProperty({ ...valid, capacity: 0 })).toBe('Capacity must be at least 1.')
    expect(validateProperty({ ...valid, rooms: 0 })).toBe('Rooms must be at least 1.')
  })

  it('maps database times to form values', () => {
    expect(propertyToFormValues({
      id: '1', ...valid, check_in_time: '14:00:00', check_out_time: '10:00:00',
    })).toEqual(valid)
  })
})
