/**
 * IntegrationWebhookBlock (HF-WEBHOOK-1 / HF-WEBHOOK-FE-1): status line for the connector's
 * inbound webhook plus register / rotate / unregister actions (HelloFlex only).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react'
import { SectionTitle, Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import type { ConnectorId, IntegrationSummary } from './integrationsApi'
import { useHelloflexWebhook } from './useHelloflexWebhook'

const TONE = {
  registered: { color: 'var(--color-success-text)', Icon: CheckCircle2 },
  paused: { color: 'var(--color-warning-text)', Icon: AlertTriangle },
  notRegistered: { color: 'var(--text-muted)', Icon: CircleDashed },
} as const

interface Props {
  webhook: IntegrationSummary['webhook']
  connector?: ConnectorId
  onChanged?: () => void
}

// Icon + text in the health-badge idiom; paused wins over registered. The live status wins over the row.
export default function IntegrationWebhookBlock({ webhook, connector, onChanged }: Props) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const auth = useAuth()
  const hook = useHelloflexWebhook(connector, onChanged)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const live = hook.status
  const row = live ?? webhook
  if (!row || typeof row !== 'object') return null
  const paused = (webhook?.paused ?? false)
  const state = paused ? 'paused' : row.registered ? 'registered' : 'notRegistered'
  const { color, Icon } = TONE[state]
  const verifiedAt = live?.verified_at ?? null
  // Last-received detail only for a registered, running webhook.
  const detail = state === 'registered'
    ? (row.last_received_at
      ? t('integrations.webhook.lastReceived', { date: formatDateTime(row.last_received_at) })
      : t('integrations.webhook.nothingReceived'))
    : null
  const canAct = connector === 'helloflex' && (auth?.hasPermission('settings.update') ?? false)
  return (
    <div data-testid="integration-webhook" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        <Icon size={14} aria-hidden="true" />
        <SectionTitle as="span" style={{ color }}>{t(`integrations.webhook.${state}`)}</SectionTitle>
        {detail && <Caption>{detail}</Caption>}
      </div>
      {row.registered && live && (
        <Caption as="p" style={{ marginTop: 2 }}>
          {verifiedAt
            ? t('integrations.webhook.verifiedAt', { date: formatDateTime(verifiedAt) })
            : t('integrations.webhook.notVerified')}
        </Caption>
      )}
      {canAct && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {row.registered ? (
            <>
              <Button variant="secondary" disabled={hook.busy} onClick={() => hook.register({ rotate: true })}>{t('integrations.webhook.rotate')}</Button>
              <Button variant="danger" disabled={hook.busy} onClick={() => setConfirmOpen(true)}>{t('integrations.webhook.unregister')}</Button>
            </>
          ) : (
            <Button variant="secondary" disabled={hook.busy} onClick={() => hook.register({ rotate: false })}>{t('integrations.webhook.register')}</Button>
          )}
        </div>
      )}
      <ConfirmDialog open={confirmOpen} danger
        title={t('integrations.webhook.confirmUnregisterTitle')}
        message={t('integrations.webhook.confirmUnregisterBody')}
        confirmLabel={t('integrations.webhook.unregister')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); hook.unregister() }} />
    </div>
  )
}
