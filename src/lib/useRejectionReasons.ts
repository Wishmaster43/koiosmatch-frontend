/**
 * useRejectionReasons — the tenant-configurable candidate rejection reasons
 * (`GET /candidate-rejection-reasons`, same endpoint RejectionModal.tsx already
 * calls directly — see pages/applications/drawer/RejectionModal.tsx:85). Hoisted
 * here (WAVE 1c, RAPPORT-FILTERS report panel) so the applications report's
 * `rejection_reason[]` panel filter and RejectionModal share one cached fetch
 * instead of two independent GETs.
 *
 * Fetch/cache/dedupe via the shared useCachedLookup (one GET per session, deduped
 * across mounts). No seed fallback — an unknown reason set is rendered empty,
 * never faked (mirrors useMatchStopReasons, a brand-new tenant vocabulary).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { translateSeedList } from '@/lib/lookupSeedI18n'
import { unwrapList } from '@/lib/api'
import type { LookupOption } from '@/types/common'

// No seed — see the module doc comment above for why.
const NO_REJECTION_REASONS: LookupOption[] = []

// Normalise an API row (id/name/label) to the UI LookupOption shape — the panel
// filter and RejectionModal both send the raw uuid `id` back to the server.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.id ?? ''),
  label: String(r.name ?? r.label ?? ''),
})

// null = nothing usable in this response — useCachedLookup keeps the empty
// fallback and retries on the next mount.
const mapRejectionReasons = (res: AxiosResponse): LookupOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toOption) : null
}

export function useRejectionReasons() {
  const { t } = useTranslation('common')
  const { data: rawReasons, loading } = useCachedLookup('/candidate-rejection-reasons', mapRejectionReasons, NO_REJECTION_REASONS)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const reasons = useMemo(() => translateSeedList(t, 'rejectionReasons', rawReasons), [rawReasons, t])
  return { reasons, loading }
}
