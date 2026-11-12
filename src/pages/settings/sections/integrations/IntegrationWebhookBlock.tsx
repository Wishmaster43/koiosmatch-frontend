/**
 * IntegrationWebhookBlock (HF-WEBHOOK-1 prep): one status line for the connector's
 * inbound webhook. Renders nothing until the BE sends a webhook object on the row.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react'
import { BodyText, Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import type { IntegrationSummary } from './integrationsApi'

const TONE = {
  registered: { color: 'var(--color-success-text)', Icon: CheckCircle2 },
  paused: { color: 'var(--color-warning-text)', Icon: AlertTriangle },
  notRegistered: { color: 'var(--text-muted)', Icon: CircleDashed },
} as const

// Icon + text in the health-badge idiom; paused wins over registered.
export default function IntegrationWebhookBlock({ webhook }: { webhook: IntegrationSummary['webhook'] }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  if (!webhook || typeof webhook !== 'object') return null
  const state = webhook.paused ? 'paused' : webhook.registered ? 'registered' : 'notRegistered'
  const { color, Icon } = TONE[state]
  // Last-received detail only for a registered, running webhook.
  const detail = state === 'registered'
    ? (webhook.last_received_at
      ? t('integrations.webhook.lastReceived', { date: formatDateTime(webhook.last_received_at) })
      : t('integrations.webhook.nothingReceived'))
    : null
  return (
    <div data-testid="integration-webhook" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color }}>
      <Icon size={14} aria-hidden="true" />
      <BodyText as="span" style={{ color, fontWeight: 600 }}>{t(`integrations.webhook.${state}`)}</BodyText>
      {detail && <Caption>{detail}</Caption>}
    </div>
  )
}
