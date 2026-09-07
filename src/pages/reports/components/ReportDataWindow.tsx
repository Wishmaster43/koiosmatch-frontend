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
  isLeads,
  totalCompare,
}: {
  from?: string
  to?: string
  reportKey: string
  isLeads?: boolean
  totalCompare?: CompareMetric
}) {
  const { t } = useTranslation('analytics')

  if (!from || !to) return null

  const windowKey = isLeads ? `${reportKey}.window` : `${reportKey}.window`
  const dateRange = t(windowKey, { from, to, defaultValue: `${from} – ${to}` })

  return (
    <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {dateRange}
      {totalCompare && <ReportCompareMetric metric={totalCompare} polarity="up-good" />}
    </BodyText>
  )
}
