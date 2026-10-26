export type AddressSuggestion = {
  label: string
  address: string
  city: string
  postcode: string
  country: string
  latitude: number
  longitude: number
}

export type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    locality?: string
    state?: string
    country?: string
  }
}

export function parsePhotonFeature(feature: PhotonFeature): AddressSuggestion | null {
  const coords = feature.geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const p = feature.properties ?? {}
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const city = p.city || p.locality || ''
  const label = [street || p.name, [p.postcode, city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ')
  return {
    label: label || 'Location',
    address: street || p.name || '',
    city,
    postcode: p.postcode || '',
    country: p.country || '',
    latitude: coords[1],
    longitude: coords[0],
  }
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Address search failed (${response.status}).`)
  const payload = await response.json() as { features?: PhotonFeature[] }
  return (payload.features ?? []).map(parsePhotonFeature).filter((item): item is AddressSuggestion => item !== null)
}
