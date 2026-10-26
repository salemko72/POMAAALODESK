import { useOptionalAgency } from '../lib/agency-context'

export function AgencyTitleMark() {
  const agency = useOptionalAgency()
  if (!agency) return null
  const initials = agency.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'A'

  return <span className="agency-title-mark" aria-hidden="true" title={agency.name}>
    {agency.logo_url
      ? <img src={agency.logo_url} alt="" />
      : <span className="agency-title-initials">{initials}</span>}
  </span>
}
