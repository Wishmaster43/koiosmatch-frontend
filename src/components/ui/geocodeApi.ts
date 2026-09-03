/**
 * geocodeApi — the one API call behind GeocodeButton (audit architecture-2: components/ui
 * stays presentational; the axios call and the response coercion live here, mirroring
 * components/ui/richtext/richTextAssistApi.ts). Coordinates arrive as Laravel decimal
 * STRINGS (§10), hence toCoord; an explicit `geocoded: false` means the address did not
 * resolve; no coordinates at all means the job was queued.
 */
import api, { unwrap } from '@/lib/api'
import { toCoord } from '@/lib/coords'

export interface GeocodeOutcome {
  lat: number | null
  lng: number | null
  /** false when the backend answered that the address could not be resolved. */
  notFound: boolean
}

// POSTs the entity's geocode route and normalises the three possible answers.
export async function postGeocode(endpoint: string): Promise<GeocodeOutcome> {
  const res = await api.post(endpoint)
  const body = unwrap<{ lat?: unknown; lng?: unknown; geocoded?: boolean }>(res) ?? {}
  return { lat: toCoord(body.lat), lng: toCoord(body.lng), notFound: body.geocoded === false }
}
