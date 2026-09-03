/**
 * useOpportunityLostReasons — the tenant-configurable lost-reason lookup for
 * opportunities (OPP-LOST-FE-1). Mirrors useApplicationSources' shape (cached
 * fetch, empty seed, never demo data) but without a free-entry toggle — a
 * lost reason is always picked from the list, never typed (RejectionModal's
 * reason field is the same idiom). Managed in Settings → Kansen → Verliesredenen
 * (`/opportunity-lost-reasons`, the rejection-reasons contract: {id, name,
 * color, in_use}).
 *
 * An EMPTY list is a real, meaningful state (the tenant has not curated any
 * reasons yet): the stage-change guard in useOpportunitiesData reads
 * `reasons.length === 0` to skip the confirm modal entirely, so this hook
 * must resolve to `[]` (not the loading fallback forever) once the backend
 * confirms the list is genuinely empty — see mapReasons below.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

// A picker option: `value`/`label` are the reason NAME (posted as `lost_reason`
// verbatim, the backend contract has no separate id/name split on write).
export interface OpportunityLostReasonOption { value: string; label: string; color?: string }

interface RawLostReason { id?: Id; name?: string; color?: string }

// No demo seed on purpose (backend contract: "the agency curates first").
const FALLBACK: OpportunityLostReasonOption[] = []

// Maps the raw response to option rows; an empty-but-successful response maps
// to `[]` (not null) so it CACHES as genuinely empty rather than retrying
// forever — a failed/malformed response falls through to the catch and keeps
// the fallback (also `[]`), which is the correct "no gate" behaviour either way.
const mapReasons = (res: AxiosResponse): OpportunityLostReasonOption[] =>
  unwrapList<RawLostReason>(res).rows
    .filter((r): r is RawLostReason & { name: string } => Boolean(r.name))
    .map(r => ({ value: r.name, label: r.name, color: r.color }))

// Tenant opportunity lost-reason lookup (see file docblock above).
export function useOpportunityLostReasons() {
  const { t } = useTranslation('common')
  const { data, loading, invalidate } = useCachedLookup('/opportunity-lost-reasons', mapReasons, FALLBACK)
  // Seeded defaults would render translated (LOOKUP-I18N-1); there is no seed
  // here, so this only translates a tenant value if it happens to match a
  // known seed key elsewhere — harmless no-op for the common case (tenant-typed names).
  const reasons = useMemo(() => translateSeedList(t, 'opportunityLostReasons', data), [data, t])
  return { reasons, loading, invalidate }
}
