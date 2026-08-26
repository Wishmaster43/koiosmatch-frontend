/**
 * WhatsAppWebDevice — presentational card for one linked WhatsApp Web device.
 * Renders the status, the QR while the scan is pending, and only the actions
 * valid for the current status. All logic lives in useWhatsAppWeb.
 */
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Trash2 } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import SoftChip from '@/components/ui/SoftChip'
import CalloutBox from '@/components/ui/CalloutBox'
import { Mono, Caption, SectionTitle } from '@/components/ui/typography'
import { STATUS_META, WARMUP_STAGES } from './statusMeta'
import type { WhatsAppDevice } from './statusMeta'

interface WhatsAppWebDeviceProps {
  device: WhatsAppDevice
  busy: boolean
  notEnabled: boolean
  onConnect: (id: WhatsAppDevice['id']) => void
  onDisconnect: (id: WhatsAppDevice['id']) => void
  onRemove: (id: WhatsAppDevice['id']) => void
}

// One WhatsApp Web device row: status dot/label, QR/connecting block, and the connect/disconnect/remove actions.
export default function WhatsAppWebDevice({ device, busy, notEnabled, onConnect, onDisconnect, onRemove }: WhatsAppWebDeviceProps) {
  const { t } = useTranslation('auth')
  const { formatDateTime } = useDateFormat()
  // Resolve the dot colour + label for this status (fallback: disconnected).
  const meta = STATUS_META[device.status] ?? STATUS_META.disconnected
  const showQrBlock = device.status === 'qr_pending' || device.status === 'connecting'
  // The server's warmup object wins; the bare warmup_stage stays as fallback.
  const warmupStage = device.warmup?.stage ?? device.warmup_stage
  const warmup = WARMUP_STAGES.includes(warmupStage as never) ? warmupStage : null

  return (
    <div style={{ padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10 }}>
      {/* Header: status + phone + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--color-primary-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={18} color="var(--color-primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {/* A freshly created device has no label yet: name it, never an anonymous card. */}
            <SectionTitle as="span">{device.label || t('profile.whatsappWeb.newDevice')}</SectionTitle>
            {/* Status is never a raw slug — always the mapped SoftChip label. */}
            <SoftChip label={t(`profile.whatsappWeb.${meta.labelKey}`)} color={meta.dot} dot round />
            {warmup !== null && (
              <SoftChip label={device.warmup?.label ? t(`profile.whatsappWeb.warmup.${warmup}`, { defaultValue: device.warmup.label }) : t(`profile.whatsappWeb.warmup.${warmup}`)} color="var(--color-info)" round />
            )}
            {warmup !== null && device.warmup?.daily_cap != null && (
              <Caption as="span">{t('profile.whatsappWeb.dailyCap', { cap: device.warmup.daily_cap })}</Caption>
            )}
          </div>
          {device.phone_number && <Caption as="span" style={{ marginTop: 4, display: 'block' }}><Mono>{device.phone_number}</Mono></Caption>}
          {device.last_connected_at && (
            <Caption style={{ marginTop: 2, display: 'block' }}>
              {t('profile.whatsappWeb.lastConnected', { when: formatDateTime(device.last_connected_at) })}
            </Caption>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Link is offered only for a fully disconnected device. */}
          {device.status === 'disconnected' && (
            <Button variant="secondary" size="sm" onClick={() => onConnect(device.id)} disabled={busy}>
              {busy ? <Spinner size={13} /> : <MessageCircle size={13} />}
              {t('profile.whatsappWeb.connect')}
            </Button>
          )}
          {/* Unlink keeps the device but logs it out. */}
          {device.status === 'connected' && (
            <Button variant="secondary" size="sm" onClick={() => onDisconnect(device.id)} disabled={busy}>
              {t('profile.whatsappWeb.disconnect')}
            </Button>
          )}
          {/* Remove (DELETE) is always available — it doubles as "cancel" mid-scan. */}
          <Button variant="dangerSoft" size="sm" iconOnly disabled={busy}
            onClick={() => onRemove(device.id)} aria-label={t('profile.whatsappWeb.remove')} title={t('profile.whatsappWeb.remove')}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Gateway not configured on connect() — a platform fact, not a user error,
          so it renders as a calm notice rather than the danger state. */}
      {notEnabled && (
        <div style={{ marginTop: 10 }}>
          <CalloutBox variant="info">{t('profile.whatsappWeb.notEnabled')}</CalloutBox>
        </div>
      )}

      {/* QR / connecting body: the QR shows once it has arrived, a spinner until then. */}
      {showQrBlock && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0 }}>
            {device.status === 'qr_pending' && device.qr
              ? <QRCodeSVG value={device.qr} size={168} marginSize={2} title={t('profile.whatsappWeb.scanHint')} />
              : <div style={{ width: 168, height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size={20} />
                </div>}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <SectionTitle style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Spinner size={13} /> {t(`profile.whatsappWeb.${meta.labelKey}`)}
            </SectionTitle>
            <Caption style={{ lineHeight: 1.7 }}>{t('profile.whatsappWeb.scanHint')}</Caption>
          </div>
        </div>
      )}
    </div>
  )
}
