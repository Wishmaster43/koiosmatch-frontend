/**
 * useContractTypes — tenant-configurable contract types for a match/placement
 * (Settings → Matches). NBBU/ABU fasen differ per bureau, so it is a tenant lookup,
 * never hardcoded. Fed by GET /contract-types once the backend ships it
 * (MATCH-PLACEMENT-1); a seed fallback drives the dropdown until then.
 *
 * `options` (7.1, MATCH-CONTRACT-DURATION-1) carries each type's
 * `default_duration_days` alongside value/label, feeding the placement form's
 * end-date PROPOSAL (useEndDateProposal). Honest-gated: the backend column
 * doesn't exist yet, so every row's `default_duration_days` is `null` until it
 * ships — the proposal then simply stays a no-op, never a crash. `types`
 * (string[]) stays exactly as before for the existing callers (ContractSection's
 * dropdown, the matches drawer, the vacancy-generation matcher) that only need
 * the label list.
 *
 * `is_default` (Danny 24-07, "voorstel waarde" for Contractsoort) reuses the same
 * singleton flag as phases/appointment-types/-locations/funnel-stages
 * (Settings → Matches → Contractsoort now passes StatusListEditor's
 * `defaultField`) — useMatchPlacementForm preselects whichever type carries it,
 * into an EMPTY field only. Honest-gated the same way as `default_duration_days`
 * above: `/contract-types` was NOT one of the three lookups the backend shipped
 * `is_default` for (LOOKUP-DEFAULT-1 covered appointment_types/-locations/
 * application_stages only), so this reads `false` from every real API row until
 * a backend follow-up adds the column — a no-op, never a crash, same gate.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

// Seed defaults mirror Danny's spec (ABU + ZZP + W&S); labels tenant-facing.
export const DEFAULT_CONTRACT_TYPES = [
  'Fase 1-2 z.u.b. (Works)',
  'Fase 1-2 m.u.b. (Works)',
  'Fase 3 bepaalde tijd (Zorg)',
  'Fase 4 onbepaalde tijd',
  'ZZP Flex',
  'ZZP Project',
  'Werving & Selectie',
]

export interface ContractTypeOption { value: string; label: string; default_duration_days: number | null; is_default: boolean }

// Seed carries no duration/default — nothing to propose from until the backend ships either column.
const DEFAULT_CONTRACT_TYPE_OPTIONS: ContractTypeOption[] =
  DEFAULT_CONTRACT_TYPES.map(name => ({ value: name, label: name, default_duration_days: null, is_default: false }))

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapContractTypeOptions = (res: AxiosResponse): ContractTypeOption[] | null => {
  const rows = (unwrapList(res).rows) as Array<string | { name?: string; label?: string; value?: string; default_duration_days?: number | null; is_default?: boolean }>
  const options = rows
    .map(x => {
      if (typeof x === 'string') return x ? { value: x, label: x, default_duration_days: null, is_default: false } : null
      const label = x.name ?? x.label ?? x.value ?? ''
      return label ? { value: String(x.value ?? label), label, default_duration_days: x.default_duration_days ?? null, is_default: Boolean(x.is_default) } : null
    })
    .filter((o): o is ContractTypeOption => o !== null)
  return options.length ? options : null
}

export function useContractTypes() {
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: options } = useCachedLookup('/contract-types', mapContractTypeOptions, DEFAULT_CONTRACT_TYPE_OPTIONS)
  const types = options.map(o => o.label)
  return { types, options }
}
