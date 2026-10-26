import { describe, expect, it } from 'vitest'
import {
  canEditProperty, canEditReservation, canManagePropertyAccess,
  canManageUsers, canViewGuestDetails,
} from './lib/permissions'

describe('role permissions', () => {
  it('restricts administration to admins', () => {
    expect(canManageUsers('admin')).toBe(true)
    expect(canManageUsers('manager')).toBe(false)
    expect(canManagePropertyAccess('admin')).toBe(true)
    expect(canManagePropertyAccess('manager')).toBe(false)
  })

  it('allows managers to edit operational data', () => {
    expect(canEditProperty('manager')).toBe(true)
    expect(canEditReservation('manager')).toBe(true)
    expect(canEditProperty('viewer')).toBe(false)
  })

  it('keeps guest details away from cleaning users', () => {
    expect(canViewGuestDetails('cleaning')).toBe(false)
    expect(canViewGuestDetails('viewer')).toBe(true)
  })
})
