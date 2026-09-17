/**
 * useCustomKpiCards — maps a report envelope's tenant-defined `custom_kpis[]`
 * (KPI-BUILDER-1) onto the shared `KpiSpec` shape ReportKpiBand's second row
 * renders. Thin wiring hook: all formatting/caption logic stays in the pure
 * `kpiUnitFormat` / `customKpiCaption` helpers so this file only assembles.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { CustomKpiCard } from '@/types/analytics'
import { formatKpiDefinitionValue, kpiDefinitionUnitWordKey } from '../kpiUnitFormat'
import { customKpiCaption } from '../lib/customKpiCaption'

export interface UseCustomKpiCardsOpts {
  cards: CustomKpiCard[]
  activeId?: string | null
  // Receives the card's own composed label and formatted value (never the raw
  // card alone) so the drill drawer title/value never disagree with the card
  // the user just clicked (EENHEID-LES, §14).
  onOpen: (card: CustomKpiCard, label: string, value: string | number) => void
}

// Status → ink colour, the `-text` twins (§4: never the raw semantic token as a
// fill). 'ok' only carries colour when the definition actually compares against
// a threshold — a thresholdless 'ok'/'none' card stays neutral (no colour, §6).
const STATUS_COLOR: Partial<Record<CustomKpiCard['status'], string>> = {
  ok: 'var(--color-success-text)',
  warn: 'var(--color-warning-text)',
  alert: 'var(--color-danger-text)',
}

export function useCustomKpiCards({ cards, activeId, onOpen }: UseCustomKpiCardsOpts): KpiSpec[] {
  const { t } = useTranslation(['analytics', 'settings'])
  const { locale, currency } = useNumberFormat()

  return useMemo(() => cards.map((card): KpiSpec => {
    // Label carries the fan-out dimension value when the definition split by one
    // (e.g. "Nieuwe matches · ZZP"); a plain "all" definition keeps its own label.
    const label = card.dimension_label
      ? t('analytics:customKpi.labelWithDimension', { label: card.label, dimension: card.dimension_label })
      : card.label
    const formatValue = (raw: number) => formatKpiDefinitionValue(raw, card.unit, locale, currency)
    const unitWordKey = kpiDefinitionUnitWordKey(card.unit)
    const value = card.value == null ? '—'
      : unitWordKey
        ? t('analytics:customKpi.valueWithUnit', { value: formatValue(card.value), unit: t(unitWordKey) })
        : formatValue(card.value)
    const sub = customKpiCaption({ card, t, formatValue })
    const color = card.status === 'ok' && card.comparison === 'none' ? undefined : STATUS_COLOR[card.status]
    return {
      key: `custom:${card.id}`,
      label,
      value,
      sub,
      color,
      active: activeId === card.id,
      ...(card.value != null ? { onClick: () => onOpen(card, label, value) } : {}),
    }
  }), [cards, activeId, onOpen, t, locale, currency])
}
