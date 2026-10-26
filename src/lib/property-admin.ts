import type { Property } from './properties-repository'

export type PropertyFormValues = {
  name: string
  address: string
  city: string
  country: string
  color: string
  latitude: number | null
  longitude: number | null
  capacity: number
  rooms: number
  area_m2: number | null
  image_url: string | null
  notes: string
  check_in_time: string
  check_out_time: string
  parking: boolean
  wifi: boolean
  keybox: boolean
  air_conditioning: boolean
  cleaning_duration_minutes: number
  nightly_rate?: number | null
  currency?: string
  is_active: boolean
}

export function validateProperty(values: PropertyFormValues): string | null {
  if (!values.name.trim()) return 'Enter a property name.'
  if (!Number.isInteger(values.capacity) || values.capacity < 1) return 'Capacity must be at least 1.'
  if (!Number.isInteger(values.rooms) || values.rooms < 1) return 'Rooms must be at least 1.'
  if (values.area_m2 !== null && values.area_m2 < 0) return 'Area cannot be negative.'
  if (values.nightly_rate != null && (!Number.isFinite(values.nightly_rate) || values.nightly_rate < 0)) return 'Nightly price cannot be negative.'
  if (!values.check_in_time) return 'Select a check-in time.'
  if (!values.check_out_time) return 'Select a check-out time.'
  if (!Number.isInteger(values.cleaning_duration_minutes) || values.cleaning_duration_minutes < 0) return 'Cleaning duration cannot be negative.'
  if (!/^#[0-9A-Fa-f]{6}$/.test(values.color)) return 'Choose a valid property color.'
  return null
}

export function propertyToFormValues(property: Property): PropertyFormValues {
  return {
    name: property.name,
    address: property.address ?? '',
    city: property.city ?? '',
    country: property.country ?? '',
    color: property.color ?? '#7C5CFC',
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    capacity: property.capacity,
    rooms: property.rooms,
    area_m2: property.area_m2,
    image_url: property.image_url ?? null,
    notes: property.notes ?? '',
    check_in_time: property.check_in_time.slice(0, 5),
    check_out_time: property.check_out_time.slice(0, 5),
    parking: property.parking ?? false,
    wifi: property.wifi,
    keybox: property.keybox ?? false,
    air_conditioning: property.air_conditioning,
    cleaning_duration_minutes: property.cleaning_duration_minutes,
    nightly_rate: property.nightly_rate ?? null,
    currency: property.currency ?? 'EUR',
    is_active: property.is_active,
  }
}
