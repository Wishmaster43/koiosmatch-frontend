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
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

export const DEFAULT_OUTREACH_OUTCOMES: LookupOption[] = [
  { value: 'no_answer',      label: 'Geen gehoor',    color: 'var(--color-warning)' },
  { value: 'callback',       label: 'Terugbellen',    color: 'var(--color-primary)' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  { value: 'not_interested', label: 'Geen interesse', color: 'var(--color-danger)' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  { value: 'interested',     label: 'Interesse',      color: 'var(--color-success)' },
]

// Normalise an API row (id/name/label/value/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapOutreachOutcomes = (res: AxiosResponse): LookupOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toOption) : null
}

export function useOutreachOutcomes() {
  const { t } = useTranslation('outreach')
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: rawOutcomes } = useCachedLookup('/outreach-outcomes', mapOutreachOutcomes, DEFAULT_OUTREACH_OUTCOMES)
  // Translate labels only while still on the SEED fallback (reference-equal to the
  // DEFAULT_OUTREACH_OUTCOMES const) — real tenant-configured API labels pass
  // through untouched; the literal Dutch seed text is the defaultValue.
  const outcomes = rawOutcomes === DEFAULT_OUTREACH_OUTCOMES
    ? rawOutcomes.map(o => ({ ...o, label: t(`lookupSeeds.outcomes.${o.value}`, { defaultValue: o.label }) }))
    : rawOutcomes

  // Resolve a stored slug to its meta (label + colour) — tolerant of label-stored values.
  const metaOf = (v?: string | null): LookupOption | undefined =>
    outcomes.find(o => o.value === v || o.label === v)

  return { outcomes, metaOf }
}
