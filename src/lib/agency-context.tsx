/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import type { AgencyMembership } from './agency-repository'

const AgencyContext = createContext<AgencyMembership | null>(null)

export function AgencyProvider({ agency, children }: { agency: AgencyMembership; children: React.ReactNode }) {
  return <AgencyContext.Provider value={agency}>{children}</AgencyContext.Provider>
}

export function useAgency(): AgencyMembership {
  const agency = useContext(AgencyContext)
  if (!agency) throw new Error('Agency context is unavailable.')
  return agency
}

export function useOptionalAgency(): AgencyMembership | null {
  return useContext(AgencyContext)
}
