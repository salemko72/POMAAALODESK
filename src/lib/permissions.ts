export type UserRole = 'owner' | 'admin' | 'manager' | 'viewer' | 'cleaning'

export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canEditProperty(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export function canEditReservation(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export function canViewGuestDetails(role: UserRole): boolean {
  return role !== 'cleaning'
}

export function canManagePropertyAccess(role: UserRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canOpenPage(role: UserRole, path: string): boolean {
  if (role === 'cleaning') return path === '/' || path === '/account' || path === '/tasks'
  if (['/reservations','/guests','/tasks','/blocks'].includes(path)) return true
  if (['/', '/settings', '/account', '/notifications'].includes(path)) return true
  if (path === '/people' || path === '/calendar-sources' || path === '/backup' || path === '/agency') return role === 'owner' || role === 'admin'
  if (path === '/new-booking') return canEditReservation(role)
  return path === '/calendar' || path === '/properties' || path.startsWith('/edit-reservation/')
}
