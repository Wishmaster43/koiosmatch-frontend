/**
 * ProfileWhatsAppWeb — personal (per-user) WhatsApp Web device links via QR scan.
 * Distinct from the tenant-wide WhatsApp Business (WABA) in settings: this links
 * the logged-in user's own phone(s).
 *
 * Container only: useWhatsAppWeb drives state + polling, WhatsAppWebDevice renders
 * each device. Handles the four UI states (loading / error / empty / list).
 * A 404 degrades to a calm "unavailable" notice instead of an error.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useWhatsAppWeb } from './whatsappWeb/useWhatsAppWeb'
import WhatsAppWebDevice from './whatsappWeb/WhatsAppWebDevice'

// Shared notice box for the loading / unavailable / error / empty states.
const noticeBox: CSSProperties = {
  padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border)',
  borderRadius: 10, fontSize: 13, color: 'var(--text-muted)',
}

export default function ProfileWhatsAppWeb() {
  const { t } = useTranslation('auth')
  const { devices, phase, busyId, createDevice, connect, disconnect, remove } = useWhatsAppWeb()

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16, lineHeight: 1.6 }}>
        {t('profile.whatsappWeb.desc')}
      </p>

      {/* Loading */}
      {phase === 'loading' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('profile.whatsappWeb.loading')}</p>
      )}

      {/* Backend feature off (404) */}
      {phase === 'unavailable' && <div style={noticeBox}>{t('profile.whatsappWeb.unavailable')}</div>}

      {/* Load failure */}
      {phase === 'error' && <div style={noticeBox}>{t('profile.whatsappWeb.error')}</div>}

      {/* Ready: empty state, the device list, and the "link a device" action */}
      {phase === 'ready' && (
        <>
          {devices.length === 0 && <div style={{ ...noticeBox, marginBottom: 12 }}>{t('profile.whatsappWeb.empty')}</div>}

          {devices.map((d) => (
            <WhatsAppWebDevice
              key={d.id}
              device={d}
              busy={busyId === d.id}
              onConnect={connect}
              onDisconnect={disconnect}
              onRemove={remove}
              t={t}
            />
          ))}

          <button onClick={createDevice} disabled={busyId === 'new'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px',
                     fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', color: 'white',
                     background: 'var(--color-primary)', cursor: busyId === 'new' ? 'default' : 'pointer' }}>
            {busyId === 'new' ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('profile.whatsappWeb.addDevice')}
          </button>
        </>
      )}
    </div>
  )
}
