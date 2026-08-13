/**
 * useDriverLicenses — tenant-configurable driving-licence categories.
 *
 * Fed by the API (GET /driver-licenses) with the Dutch categories as a fallback
 * while the API is empty/unavailable. Managed in Settings → Candidate → Driving
 * licences.
 *
 * LOOKUP-ICON-1 (batch 12, P22-30): the backend now carries an optional `icon`
 * per row (lucide slug or emoji, same convention as last-contact-types). This
 * hook used to collapse rows to plain name strings — that dropped the icon on
 * the floor before any consumer could render it. It now returns full
 * `{ value, label, icon }` objects; `value`/`label` are both the item's name
 * (driver licences have no separate id/label split), mirroring how
 * useLastContactTypes already exposes icon-bearing items. Consumers that only
 * need the name list read `.label` (or `.value` — identical here).
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

export interface DriverLicenseItem {
  value: string
  label: string
  icon?: string | null
}

const SEED_NAMES = ['AM', 'A', 'B', 'BE', 'C', 'C1', 'CE', 'D', 'D1', 'DE', 'T']
export const DEFAULT_DRIVER_LICENSES: DriverLicenseItem[] = SEED_NAMES.map(name => ({ value: name, label: name, icon: null }))

type Named = { name?: string; label?: string; value?: string; icon?: string }

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapDriverLicenses = (res: AxiosResponse): DriverLicenseItem[] | null => {
  const raw = (unwrapList(res).rows) as unknown[]
  const items = raw
    .map(x => {
      if (typeof x === 'string') return { value: x, label: x, icon: null as string | null }
      const n = x as Named
      const name = n.name ?? n.label ?? n.value
      return name ? { value: name, label: name, icon: n.icon ?? null } : null
    })
    .filter((v): v is { value: string; label: string; icon: string | null } => Boolean(v))
  return items.length ? items : null
}

export function useDriverLicenses() {
  const { data: licenses } = useCachedLookup('/driver-licenses', mapDriverLicenses, DEFAULT_DRIVER_LICENSES)
  return { licenses }
}
