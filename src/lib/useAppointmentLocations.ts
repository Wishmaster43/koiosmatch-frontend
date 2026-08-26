/**
 * useAppointmentLocations — tenant-configurable WHERE an appointment is held
 * (LOOKUP-DEFAULT-1: Kantoor/Online/Telefonisch/Bij klant — Office/Online/
 * Phone/At the customer's), replacing the old hardcoded "Kantoor" ("Office")
 * preset in PlanIntakeModal. Fed by GET /appointment-locations (seeded
 * defaults, CRUD in Settings); `is_default` marks the one pre-selected when
 * planning a new appointment (seed: Kantoor/Office). The stored value is the
 * slug, sent to the API as `appointment_location`.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (mirrors useGenders/useAppointmentTypes)
 * — one GET per session, shared across every mounted consumer.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { unwrapList } from '@/lib/api'

export interface AppointmentLocation {
  value: string
  label: string
  color?: string
  icon?: string
  is_default: boolean
}

// Seed defaults — mirror the backend seed (CandidateLookupSeeder) 1:1.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_APPOINTMENT_LOCATIONS: AppointmentLocation[] = [
  { value: 'kantoor',     label: 'Kantoor',      color: '#6E8FD6', icon: 'building-2', is_default: true },
  { value: 'online',      label: 'Online',       color: '#79B58E', icon: 'video',      is_default: false },
  { value: 'telefonisch', label: 'Telefonisch',  color: '#DDA071', icon: 'phone',      is_default: false },
  { value: 'bij_klant',   label: 'Bij klant',    color: '#8C86D9', icon: 'map-pin',    is_default: false },
]
/* eslint-enable no-restricted-syntax */

// Normalise an API row to the UI shape (defensive about field names + defaults).
const toLocation = (r: Record<string, unknown>): AppointmentLocation => ({
  value: String(r.value ?? r.slug ?? r.id ?? ''),
  label: String(r.label ?? r.name ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
  icon: (r.icon as string) ?? undefined,
  is_default: Boolean(r.is_default),
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapLocations = (res: AxiosResponse): AppointmentLocation[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toLocation) : null
}

// The tenant's appointment-location lookup, translated for seeded defaults,
// plus the tenant's default location and a slug/label-tolerant meta resolver.
export function useAppointmentLocations() {
  const { t } = useTranslation('common')
  const { data: rawLocations } = useCachedLookup('/appointment-locations', mapLocations, DEFAULT_APPOINTMENT_LOCATIONS)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const locations = useMemo(() => translateSeedList(t, 'appointmentLocations', rawLocations), [rawLocations, t])

  // The tenant's chosen modal default, falling back to the first entry.
  const defaultLocation = locations.find(x => x.is_default) ?? locations[0]
  // Resolve a stored slug to its meta; tolerant of label-stored values.
  const metaOf = (v?: string | null): AppointmentLocation | undefined =>
    locations.find(x => x.value === v || x.label === v)

  return { locations, defaultLocation, metaOf }
}
