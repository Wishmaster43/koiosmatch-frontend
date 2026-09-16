/**
 * customKpiCaption — the sub-line under a tenant-defined KPI card (KPI-BUILDER-1):
 * a status word (colour is never the only signal, §6) plus target/warn captions,
 * joined with ' · '. Pure function so useCustomKpiCards can stay a thin wiring hook.
 */
import type { TFunction } from 'i18next'
import type { CustomKpiCard } from '@/types/analytics'

export interface CustomKpiCaptionOpts {
  card: CustomKpiCard
  t: TFunction
  formatValue: (value: number) => string
}

// Builds the caption parts and joins them; `undefined` when there is nothing to say
// (a fresh definition with no target/warn and status 'ok' on a thresholdless card).
export function customKpiCaption({ card, t, formatValue }: CustomKpiCaptionOpts): string | undefined {
  const parts: string[] = []
  // Status word: only meaningful when the definition actually compares against a
  // threshold (comparison !== 'none') — an 'ok' status with no comparison says nothing.
  if (card.status === 'warn' || card.status === 'alert' || (card.status === 'ok' && card.comparison !== 'none')) {
    parts.push(t(`analytics:customKpi.status.${card.status}`))
  }
  if (card.target != null) parts.push(t('analytics:customKpi.target', { value: formatValue(card.target) }))
  if (card.warn != null) parts.push(t('analytics:customKpi.warn', { value: formatValue(card.warn) }))
  return parts.length ? parts.join(' · ') : undefined
}
