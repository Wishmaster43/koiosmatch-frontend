/**
 * WhatsAppWebDevice — presentational card for one linked WhatsApp device.
 * Renders the status, the QR while the scan is pending, and only the actions
 * valid for the current status. All logic lives in useWhatsAppWeb.
 */
import { QRCodeSVG } from 'qrcode.react'
import { MessageCircle, RefreshCw, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { STATUS_META } from './statusMeta'
import type { WhatsAppDevice } from './statusMeta'

// Minimal translate signature — the card only needs key lookups.
type Translate = (key: string) => string

interface WhatsAppWebDeviceProps {
  device: WhatsAppDevice
  busy: boolean
  onConnect: (id: WhatsAppDevice['id']) => void
  onDisconnect: (id: WhatsAppDevice['id']) => void
  onRemove: (id: WhatsAppDevice['id']) => void
  t: Translate
}

// Small coloured status dot.
const dot = (color: string): CSSProperties => ({ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 })

// Shared secondary-button styling (disconnect / remove).
const ghostBtn = (busy: boolean): CSSProperties => ({
  height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  cursor: busy ? 'default' : 'pointer', flexShrink: 0,
})

export default function WhatsAppWebDevice({ device, busy, onConnect, onDisconnect, onRemove, t }: WhatsAppWebDeviceProps) {
  // Resolve the dot colour + label for this status (fallback: disconnected).
  const meta = STATUS_META[device.status] ?? STATUS_META.disconnected
  const showQrBlock = device.status === 'qr_pending' || device.status === 'connecting'

  return (
    <div style={{ padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10 }}>
      {/* Header: status + phone + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={18} color="var(--color-success)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <span style={dot(meta.dot)} /> {t(`profile.whatsappWeb.${meta.labelKey}`)}
          </div>
          {device.phone && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{device.phone}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Link is offered only for a fully disconnected device. */}
          {device.status === 'disconnected' && (
            <button onClick={() => onConnect(device.id)} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 16px',
                       fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', color: 'white',
                       background: 'var(--color-primary)', cursor: busy ? 'default' : 'pointer' }}>
              {busy ? <RefreshCw size={13} className="animate-spin" /> : <MessageCircle size={13} />}
              {t('profile.whatsappWeb.connect')}
            </button>
          )}
          {/* Unlink keeps the device but logs it out. */}
          {device.status === 'connected' && (
            <button onClick={() => onDisconnect(device.id)} disabled={busy} style={ghostBtn(busy)}>
              {t('profile.whatsappWeb.disconnect')}
            </button>
          )}
          {/* Remove (DELETE) is always available — it doubles as "cancel" mid-scan. */}
          <button onClick={() => onRemove(device.id)} disabled={busy} aria-label={t('profile.whatsappWeb.remove')}
            title={t('profile.whatsappWeb.remove')}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
                     color: 'var(--text-muted)', cursor: busy ? 'default' : 'pointer', flexShrink: 0 }}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* QR / connecting body: the QR shows once it has arrived, a spinner until then. */}
      {showQrBlock && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ padding: 12, background: 'white', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0 }}>
            {device.status === 'qr_pending' && device.qr
              ? <QRCodeSVG value={device.qr} size={168} />
              : <div style={{ width: 168, height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={20} className="animate-spin" color="var(--text-muted)" />
                </div>}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              <RefreshCw size={13} className="animate-spin" /> {t(`profile.whatsappWeb.${meta.labelKey}`)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
              {t('profile.whatsappWeb.scanHint')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
