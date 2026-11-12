/**
 * ReportCompareStatus — the one honest state line for an explicitly requested
 * comparison (§3A four states): loading, error with retry, or a hint that a
 * custom range is still incomplete. Renders nothing while compare is off or fine.
 */
import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'
import type { ReportCompareMode } from '../reportCompareMode'

// Picks the single state to show; an incomplete custom range fires no request, so it has no loading/error of its own.
export function ReportCompareStatus({ compare, loading = false, error = false, onRetry }: {
  compare: ReportCompareMode
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}) {
  const { t } = useTranslation('analytics')
  if (compare.kind === 'off') return null

  const incomplete = compare.kind === 'custom' && (!compare.from || !compare.to)
  let content = null
  if (incomplete) content = <Caption style={{ display: 'inline-flex' }}>{t('compare.customRangeIncomplete')}</Caption>
  else if (loading) content = <Caption style={{ display: 'inline-flex' }}>{t('compare.compareLoading')}</Caption>
  else if (error) content = <ErrorBanner variant="subtle" onRetry={onRetry} style={{ padding: 0 }}>{t('compare.compareError')}</ErrorBanner>
  if (!content) return null

  return <div style={{ marginTop: -8, marginBottom: 12 }}>{content}</div>
}
