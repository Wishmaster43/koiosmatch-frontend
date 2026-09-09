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
 *
 * LICENSE-KEYS-1 (2026-09-08): each row now carries a stable read-only `key`
 * (HasLookupKey — set once at creation from the code, e.g. "BE"→"be", never
 * rewritten on a later rename). The FE mirrors this in candidate preferences:
 * `license_category_keys` is a NEW additive array column dual-written alongside
 * the legacy `license_categories` code array on every write path. A code that
 * resolves to a driver_licenses row contributes its key; a code matching none is
 * left out of the keys array (not an error — the legacy array is unaffected).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { unwrapList } from '@/lib/api'

export interface DriverLicenseItem {
  value: string
  label: string
  icon?: string | null
  key?: string | null
}

const SEED_NAMES = ['AM', 'A', 'B', 'BE', 'C', 'C1', 'CE', 'D', 'D1', 'DE', 'T']
const DEFAULT_DRIVER_LICENSES: DriverLicenseItem[] = SEED_NAMES.map(name => ({ value: name, label: name, icon: null, key: null }))

type Named = { name?: string; label?: string; value?: string; icon?: string; key?: string }

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapDriverLicenses = (res: AxiosResponse): DriverLicenseItem[] | null => {
  const raw = (unwrapList(res).rows) as unknown[]
  const items: DriverLicenseItem[] = []
  for (const x of raw) {
    if (typeof x === 'string') {
      items.push({ value: x, label: x, icon: null, key: null })
    } else {
      const n = x as Named
      const name = n.name ?? n.label ?? n.value
      if (name) {
        items.push({ value: name, label: name, icon: n.icon ?? null, key: n.key ?? null })
      }
    }
  }
  return items.length ? items : null
}

// Cached tenant driver-licence lookup (see the module doc above for why each item carries its own optional icon rather than collapsing to a plain name).
export function useDriverLicenses() {
  const { t } = useTranslation('common')
  const { data: rawLicenses } = useCachedLookup('/driver-licenses?active=1', mapDriverLicenses, DEFAULT_DRIVER_LICENSES)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const licenses = useMemo(() => translateSeedList(t, 'driverLicenses', rawLicenses), [rawLicenses, t])
  return { licenses }
}
