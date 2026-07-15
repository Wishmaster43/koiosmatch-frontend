/**
 * useLastContactTypes — tenant-configurable last-contact channel lookup.
 *
 * Fed by the API (GET /last-contact-types → {value,label,...}) with a seed default
 * (Email / Phone / WhatsApp) as fallback while the endpoint is empty/unavailable.
 * Managed in Settings → Kandidaatlijsten → Contacttype (C-21 backend).
 *
 * `labelOf(value)` resolves a stored slug ("phone") to its label ("Telefonisch"),
 * matching on value OR label so it works whichever the candidate stores.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import { useCallback } from 'react'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// Seed defaults (slugs English/stable; labels per-tenant, normally from the API).
export const DEFAULT_LAST_CONTACT_TYPES: LookupOption[] = [
  { value: 'email',    label: 'Email' },
  { value: 'phone',    label: 'Telefonisch' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapLastContactTypes = (res: AxiosResponse): LookupOption[] | null => {
  const d = ((unwrapList(res).rows) as LookupOption[]).filter(Boolean)
  return d.length ? d : null
}

export function useLastContactTypes() {
  const { data: types } = useCachedLookup('/last-contact-types', mapLastContactTypes, DEFAULT_LAST_CONTACT_TYPES)

  // Resolve a stored value/slug to its label. NEVER prefix `icon` as text: the
  // backend sends lucide icon NAMES ("building"), which rendered as literal words
  // in the drawer footer ("building Afspraak") — same bug class as the intake
  // modal (2026-07-08). Icons render as components where a surface wants them.
  // useCallback: CandidatesTable hangs both of these in its columns useMemo deps
  // (audit item 7) — they must only change identity when `types` actually changes.
  const labelOf = useCallback((value?: string | null): string => {
    const v = norm(value)
    if (!v) return ''
    const hit = types.find(x => norm(x.value) === v || norm(x.label) === v)
    return hit?.label ?? value ?? ''
  }, [types])

  // The Settings-managed icon slug/emoji for a value — render via <LookupIcon>.
  const iconOf = useCallback((value?: string | null): string | undefined => {
    const v = norm(value)
    if (!v) return undefined
    const hit = types.find(x => norm(x.value) === v || norm(x.label) === v) as (LookupOption & { icon?: string }) | undefined
    return hit?.icon || undefined
  }, [types])

  return { types, labelOf, iconOf }
}
