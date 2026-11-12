/**
 * IntegrationHealthBadge: the permanent green/red/grey connection status of a
 * connector, with the last check time and, on error, the reason text.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { BodyText, Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import type { IntegrationHealth } from './useIntegrationHealth'

const TONE = {
  ok: { color: 'var(--color-success-text)', Icon: CheckCircle2 },
  error: { color: 'var(--color-danger-text)', Icon: XCircle },
  unknown: { color: 'var(--text-muted)', Icon: HelpCircle },
} as const

// Icon + text (colour is never the only signal); the error detail sits under it as a Caption.
export default function IntegrationHealthBadge({ health }: { health: IntegrationHealth }) {
  const { t, i18n } = useTranslation('settings')
  const { formatTime } = useDateFormat()
  const { color, Icon } = TONE[health.state]
  // Translated code label when known, else the server text.
  const codeKey = health.errorCode ? `integrations.reason.${health.errorCode}` : ''
  const detail = health.state === 'error'
    ? (codeKey && i18n.exists(codeKey, { ns: 'settings' }) ? t(codeKey) : health.errorMessage)
    : null
  const time = health.checkedAt ? formatTime(health.checkedAt) : ''
  return (
    <div data-testid="integration-health" style={{ marginBottom: 8 }} title={health.state === 'error' ? health.errorMessage ?? undefined : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        <Icon size={14} aria-hidden="true" />
        <BodyText as="span" style={{ color, fontWeight: 600 }}>{t(`integrations.health.${health.state}`)}</BodyText>
        {time && <Caption>{t('integrations.health.checkedAt', { time })}</Caption>}
      </div>
      {detail && <Caption as="p" style={{ marginTop: 2 }}>{detail}</Caption>}
    </div>
  )
}
