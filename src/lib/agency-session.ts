export type KnownAgency = { id: string; name: string; slug: string; logo_url: string | null }
export type PendingAgency = { name: string; logo_url: string | null; country: string; language: 'hr' | 'en'; currency: string; timezone: string }

// The migrated workspace is intentionally shown on a fresh browser profile as
// well.  The browser cannot carry the previous localStorage entry to a new
// deployment, but the agency itself is already in Supabase and the user can
// sign in to continue using its existing data.
export const DEMO_AGENCY: KnownAgency = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Jolie Agency',
  slug: 'jolie-agency',
  logo_url: null,
}

const ACTIVE_AGENCY_KEY = 'bookweb-active-agency'
const KNOWN_AGENCIES_KEY = 'bookweb-known-agencies'
const PENDING_AGENCY_KEY = 'bookweb-pending-agency'

export function getActiveAgencyId(): string | null { return localStorage.getItem(ACTIVE_AGENCY_KEY) }
export function setActiveAgencyId(id: string): void { localStorage.setItem(ACTIVE_AGENCY_KEY, id) }
export function clearActiveAgency(): void { localStorage.removeItem(ACTIVE_AGENCY_KEY) }

export function getKnownAgencies(): KnownAgency[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KNOWN_AGENCIES_KEY) ?? '[]') as KnownAgency[]
    const byId = new Map<string, KnownAgency>([[DEMO_AGENCY.id, DEMO_AGENCY]])
    stored.forEach((agency) => byId.set(agency.id, agency))
    return [...byId.values()]
  } catch { return [DEMO_AGENCY] }
}

export function rememberAgencies(agencies: KnownAgency[]): void {
  const byId = new Map(getKnownAgencies().map((agency) => [agency.id, agency]))
  agencies.forEach((agency) => byId.set(agency.id, agency))
  localStorage.setItem(KNOWN_AGENCIES_KEY, JSON.stringify([...byId.values()]))
}

export function getPendingAgency(): PendingAgency | null {
  try { return JSON.parse(localStorage.getItem(PENDING_AGENCY_KEY) ?? 'null') as PendingAgency | null }
  catch { return null }
}
export function setPendingAgency(agency: PendingAgency): void { localStorage.setItem(PENDING_AGENCY_KEY, JSON.stringify(agency)) }
export function clearPendingAgency(): void { localStorage.removeItem(PENDING_AGENCY_KEY) }
