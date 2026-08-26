/**
 * useCao — tenant-configurable CAO (collective labour agreement) lookup, used to
 * scope a customer's price agreements (Settings → Klanten → CAO). Fed by GET /cao
 * ({ value, label, color, sort_order, in_use }, delivered 2026-07-08); a seed
 * fallback drives the picker until the endpoint responds (mirrors useNoteTypes /
 * useDocumentTypes — same SlugLookup shape as /contract-types).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 *
 * Row mapping goes through the shared toLookupOption (lane D audit item 5):
 * this hook's own copy used to check `label ?? name`, the reverse of the
 * name-first order every other lookup hook uses — reconciled to name-first
 * here (see toLookupOption's own doc for why).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { toLookupOption } from './lookupOption'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// Seed defaults mirror the backend seed (healthcare CAOs); labels are tenant-facing.
export const DEFAULT_CAO: LookupOption[] = [
  { value: 'vvt', label: 'VVT' },
  { value: 'ziekenhuizen', label: 'Ziekenhuizen' },
  { value: 'ggz', label: 'GGZ' },
  { value: 'gehandicaptenzorg', label: 'Gehandicaptenzorg' },
  { value: 'jeugdzorg', label: 'Jeugdzorg' },
  { value: 'huisartsenzorg', label: 'Huisartsenzorg' },
]

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapCao = (res: AxiosResponse): LookupOption[] | null => {
  const raw = (unwrapList(res).rows) as Record<string, unknown>[]
  const d = raw.filter(Boolean).map(r => toLookupOption(r))
  return d.length ? d : null
}

// Tenant CAO lookup with an i18n'd seed fallback; a tenant-created value stays exactly as typed.
export function useCao() {
  const { t } = useTranslation('common')
  const { data: rawTypes } = useCachedLookup('/cao', mapCao, DEFAULT_CAO)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const types = useMemo(() => translateSeedList(t, 'cao', rawTypes), [rawTypes, t])

  // Resolve a stored value/slug to its label/colour; fall back to the raw value.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string | undefined => find(value)?.color

  return { types, labelOf, colorOf }
}
