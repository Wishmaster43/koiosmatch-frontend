/**
 * SmLoadErrorBanner — the one error state of the Shiftmanager mirror pages (§3, D8):
 * a failed /sm_* fetch says so above the table and offers a retry, never an empty
 * table that looks like success. Shared by contacts, departments and locations so the
 * copy and the retry wiring exist once (DRY ceiling, 13-09).
 */
import { useTranslation } from 'react-i18next'
import ErrorBanner from '@/components/ui/ErrorBanner'

interface SmLoadErrorBannerProps {
  // True when the mirror query failed; nothing renders otherwise.
  isError: boolean
  // The query's refetch; its promise is deliberately dropped (react-query owns the state).
  onRetry: () => unknown
}

// Renders the shared ErrorBanner with the mirror copy, or nothing while the fetch is healthy.
export function SmLoadErrorBanner({ isError, onRetry }: SmLoadErrorBannerProps) {
  const { t } = useTranslation('shiftmanager')
  if (!isError) return null
  return (
    <ErrorBanner onRetry={() => { void onRetry() }} retryLabel={t('mirror.retry')} style={{ marginBottom: 12 }}>
      {t('mirror.loadError')}
    </ErrorBanner>
  )
}
