/**
 * ReportCompareMetric — renders one {current, previous, delta, delta_pct} pair
 * (ReportComparator's own envelope shape) next to a KPI/figure. Honest by
 * construction: `delta_pct === null` (previous window was zero — "nothing to
 * compare with") always renders the house dash, never "0%" and never a division
 * result. The tone (good/bad/neutral) comes from the figure's own polarity, not
 * the raw sign — see reportComparePolarity.ts.
 */
import { useTranslation } from 'react-i18next'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { useLocale } from '@/lib/datetime'
import type { CompareMetric } from './useReportCompare'
import type { ComparePolarity } from './reportComparePolarity'
import { compareTone } from './reportComparePolarity'

const TONE_COLOR: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'var(--color-success-text)',
  bad: 'var(--color-danger-text)',
  neutral: 'var(--text-muted)',
}

export default function ReportCompareMetric({ metric, polarity = 'neutral' }: {
  metric: CompareMetric
  polarity?: ComparePolarity
}) {
  const { t } = useTranslation('analytics')
  const locale = useLocale()
  const tone = compareTone(metric.delta, polarity)
  const sign = metric.delta > 0 ? '+' : metric.delta < 0 ? '' : '±'
  const deltaLabel = `${sign}${formatNumber(metric.delta, locale)}`
  // A null delta_pct means the previous window's count was zero — "nothing to
  // compare with", never "no change" and never a fabricated percentage. The
  // house dash itself carries no locale-specific wording, so it renders as-is.
  const pctLabel = metric.delta_pct === null ? '—' : `(${formatPercent(metric.delta_pct, locale)})`

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 11, color: TONE_COLOR[tone] }}
      title={t('compare.previousValue', { value: formatNumber(metric.previous, locale) })}>
      <span style={{ fontWeight: 600 }}>{deltaLabel}</span>
      <span>{pctLabel}</span>
    </span>
  )
}
