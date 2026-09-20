/**
 * ReportDataWindow — display the report's time window (from/to) with optional
 * compare metric beside it. Adopted on six report pages (Applications/Matches/
 * Tasks/Vacancies/Candidates/Customers).
 */
import { BodyText } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import type { CompareMetric } from '../useReportCompare'
import ReportCompareMetric from '../ReportCompareMetric'

export function ReportDataWindow({
  from,
  to,
  reportKey,
  totalCompare,
}: {
  from?: string
  to?: string
  reportKey: string
  // Kept for caller compatibility (CandidatesReport still passes it) — the
  // window label already varies via `reportKey` ('leads' vs 'candidates'
  // resolve to their own i18n keys), so this flag drives no branch here.
  isLeads?: boolean
  totalCompare?: CompareMetric
}) {
  const { t } = useTranslation('analytics')

  if (!from || !to) return null

  const windowKey = `${reportKey}.window`
  const dateRange = t(windowKey, { from, to, defaultValue: `${from} – ${to}` })

  return (
    <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {dateRange}
      {totalCompare && <ReportCompareMetric metric={totalCompare} polarity="up-good" />}
    </BodyText>
  )
}
