/**
 * SmTreeNotices — the load-error banner and the page-cap notice shared by the three
 * Shiftmanager tree reports (customers/locations/departments), so a failed or cut-off
 * fetch never reads as a complete, empty report.
 */
import { useTranslation } from 'react-i18next'
import CalloutBox from '@/components/ui/CalloutBox'
import { SmLoadErrorBanner } from './SmLoadErrorBanner'

interface SmTreeNoticesProps {
  // True when the customer-tree fetch failed.
  error: boolean
  // True when the page cap cut the tree off.
  truncated: boolean
  // Retry handler handed to the error banner.
  onRetry: () => unknown
}

// Renders the error banner and/or the truncated notice; nothing while the tree is healthy.
export function SmTreeNotices({ error, truncated, onRetry }: SmTreeNoticesProps) {
  const { t } = useTranslation('shiftmanager')
  return (
    <>
      <SmLoadErrorBanner isError={error} onRetry={onRetry} />
      {truncated && <CalloutBox variant="warning">{t('mirror.truncated')}</CalloutBox>}
    </>
  )
}
