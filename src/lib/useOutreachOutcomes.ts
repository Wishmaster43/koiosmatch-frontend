/**
 * useOutreachOutcomes — tenant-configurable call-list outcome lookup (OUTREACH-2).
 *
 * Fed by the API (GET /outreach-outcomes → {value/name,label,color}) with a seed
 * default as fallback until the endpoint lands. VALUES are the API slugs (§3B —
 * never Dutch labels as values); labels are display-only defaults. Colours are
 * semantic tokens so the soft-chips follow the tenant theme (§4).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { toLookupOption } from './lookupOption'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

export const DEFAULT_OUTREACH_OUTCOMES: LookupOption[] = [
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  { value: 'no_answer',      label: 'Geen gehoor',    color: 'var(--color-warning)' },
  { value: 'callback',       label: 'Terugbellen',    color: 'var(--color-primary)' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  { value: 'not_interested', label: 'Geen interesse', color: 'var(--color-danger)' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  { value: 'interested',     label: 'Interesse',      color: 'var(--color-success)' },
]

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapOutreachOutcomes = (res: AxiosResponse): LookupOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(r => toLookupOption(r)) : null
}

// The outreach-outcome tenant lookup, translating seeded defaults into the user language while a tenant's own value stays exactly as typed.
export function useOutreachOutcomes() {
  const { t } = useTranslation('common')
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: rawOutcomes } = useCachedLookup('/outreach-outcomes', mapOutreachOutcomes, DEFAULT_OUTREACH_OUTCOMES)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const outcomes = useMemo(() => translateSeedList(t, 'outcomes', rawOutcomes), [rawOutcomes, t])

  // Resolve a stored slug to its meta (label + colour) — tolerant of label-stored values.
  const metaOf = (v?: string | null): LookupOption | undefined =>
    outcomes.find(o => o.value === v || o.label === v)

  return { outcomes, metaOf }
}
