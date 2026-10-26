import type { MeasurementUnits } from './settings'

const SQUARE_METERS_TO_SQUARE_FEET = 10.7639104167

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function areaUnit(units: MeasurementUnits): 'm²' | 'ft²' {
  return units === 'imperial' ? 'ft²' : 'm²'
}

export function areaForDisplay(squareMeters: number | null, units: MeasurementUnits): number | null {
  if (squareMeters === null) return null
  return units === 'imperial' ? round(squareMeters * SQUARE_METERS_TO_SQUARE_FEET, 1) : squareMeters
}

export function areaToSquareMeters(value: number, units: MeasurementUnits): number {
  return units === 'imperial' ? round(value / SQUARE_METERS_TO_SQUARE_FEET, 2) : value
}

export function formatArea(squareMeters: number | null, units: MeasurementUnits): string {
  const value = areaForDisplay(squareMeters, units)
  return value === null ? `— ${areaUnit(units)}` : `${value} ${areaUnit(units)}`
}
