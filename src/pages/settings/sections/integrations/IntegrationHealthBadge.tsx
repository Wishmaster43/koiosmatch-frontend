/**
 * IntegrationHealthBadge: the permanent green/red/grey connection status of a
 * connector, with the last check date and time and, on error, the reason text.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { SectionTitle, Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { useDateFormat } from '@/lib/datetime'
import { normalizeReasonCode } from './reasonCode'
import type { IntegrationHealth } from './useIntegrationHealth'

const TONE = {
  ok: { color: 'var(--color-success-text)', Icon: CheckCircle2 },
  error: { color: 'var(--color-danger-text)', Icon: XCircle },
  unknown: { color: 'var(--text-muted)', Icon: HelpCircle },
} as const

// Icon + text (colour is never the only signal); the error detail sits under it as a Caption.
export default function IntegrationHealthBadge({ health, unavailable = false, onRetry }: {
  health: IntegrationHealth
  /** The health request itself failed: show an honest 'unavailable' line instead of 'not checked yet'. */
  unavailable?: boolean
  onRetry?: () => void
}) {
  const { t, i18n } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const { color, Icon } = TONE[health.state]
  if (unavailable) {
    return (
      <div data-testid="integration-health" style={{ marginBottom: 8 }}>
        <ErrorBanner variant="subtle" onRetry={onRetry}>{t('integrations.health.unavailable')}</ErrorBanner>
      </div>
    )
  }
  // Translated code label when known, else the server text.
  const bareCode = normalizeReasonCode(health.errorCode)
  const codeKey = bareCode ? `integrations.reason.${bareCode}` : ''
  const detail = health.state === 'error'
    ? (codeKey && i18n.exists(codeKey, { ns: 'settings' }) ? t(codeKey) : health.errorMessage)
    : null
  const time = health.checkedAt ? formatDateTime(health.checkedAt) : ''
  return (
    <div data-testid="integration-health" style={{ marginBottom: 8 }} title={health.state === 'error' ? health.errorMessage ?? undefined : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        <Icon size={14} aria-hidden="true" />
        <SectionTitle as="span" style={{ color }}>{t(`integrations.health.${health.state}`)}</SectionTitle>
        {time && <Caption>{t('integrations.health.checkedAt', { time })}</Caption>}
      </div>
      {detail && <Caption as="p" style={{ marginTop: 2 }}>{detail}</Caption>}
    </div>
  )
}
