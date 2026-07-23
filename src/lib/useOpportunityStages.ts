/**
 * useOpportunityStages — the tenant-configurable opportunity (Kans) pipeline stages.
 *
 * Fed by the API (GET /opportunity-stages) with the seed below as fallback while the
 * list is empty/loading. Managed in Settings → Kansen. Each item carries the stable
 * `value` slug the rows key off, plus the editable label/colour and (from the API)
 * the `id` used when writing `opportunity_stage_id`. Mirrors useFunctions/useGenders.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { normalizeOptions } from './lookupUtils'
import type { LookupOption } from '@/types/common'
import { unwrap } from '@/lib/api'

// Seed shipped for new tenants + fallback before the backend responds (worklist C-28).
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_OPPORTUNITY_STAGES: LookupOption[] = [
  { value: 'lead',        label: 'Lead',           color: '#94A3B8' },
  { value: 'qualified',   label: 'Gekwalificeerd', color: '#6FA8C4' },
  { value: 'proposal',    label: 'Voorstel',       color: '#6E8FD6' },
  { value: 'negotiation', label: 'Onderhandeling', color: '#DDA071' },
  { value: 'won',         label: 'Gewonnen',       color: '#79B58E', isWon: true },
  { value: 'lost',        label: 'Verloren',       color: '#D98A8A', isLost: true },
]
/* eslint-enable no-restricted-syntax */

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapOpportunityStages = (res: AxiosResponse): LookupOption[] | null => normalizeOptions(unwrap(res))

export function useOpportunityStages() {
  const { data: stages } = useCachedLookup('/opportunity-stages', mapOpportunityStages, DEFAULT_OPPORTUNITY_STAGES)

  // value(slug) → item, with a neutral fallback so the UI never crashes.
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
  const stageMeta = (v?: string | null): LookupOption => stages.find(s => s.value === v) ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF' }
  return { stages, stageMeta }
}
