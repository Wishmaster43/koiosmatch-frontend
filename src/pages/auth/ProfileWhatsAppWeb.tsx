/**
 * ProfileWhatsAppWeb — personal (per-user) WhatsApp Web device links via QR scan
 * (K-193 fase 1). Distinct from the tenant-wide WhatsApp Business (WABA) in
 * settings: this links the logged-in user's own phone(s).
 *
 * Container only: useWhatsAppWeb drives state + polling, WhatsAppWebDevice renders
 * each device. Handles the four UI states (loading / error / empty / list) plus
 * the honest 'unavailable' state (module/permission off).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useWhatsAppWeb } from '@/components/whatsappWeb/useWhatsAppWeb'
import WhatsAppWebDevice from '@/components/whatsappWeb/WhatsAppWebDevice'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import { BodyText, Caption } from '@/components/ui/typography'

export default function ProfileWhatsAppWeb() {
  const { t } = useTranslation('auth')
  const { devices, phase, busyId, notEnabledId, createDevice, connect, disconnect, remove } = useWhatsAppWeb()
  // A failed create/disconnect/remove says so (the hook resolves false instead of throwing).
  const [actionFailed, setActionFailed] = useState(false)
  const guarded = async (p: Promise<boolean>) => { setActionFailed(!(await p)) }

  return (
    <div>
      <BodyText style={{ color: 'var(--text-muted)', marginTop: -6, marginBottom: 16, lineHeight: 1.6 }}>
        {t('profile.whatsappWeb.desc')}
      </BodyText>

      {/* Loading */}
      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner size={14} /> <Caption>{t('profile.whatsappWeb.loading')}</Caption>
        </div>
      )}

      {/* Backend module/permission off (403/404) — calm notice, not an error. */}
      {phase === 'unavailable' && (
        <CalloutBox variant="info">{t('profile.whatsappWeb.unavailable')}</CalloutBox>
      )}

      {/* Load failure */}
      {phase === 'error' && (
        <CalloutBox variant="danger">{t('profile.whatsappWeb.error')}</CalloutBox>
      )}

      {/* Ready: empty state, the device list, and the "link a device" action */}
      {phase === 'ready' && (
        <>
        {actionFailed && <div style={{ marginBottom: 12 }}><CalloutBox variant="danger">{t('profile.whatsappWeb.actionError')}</CalloutBox></div>}
        <>
          {devices.length === 0 && (
            <div style={{ marginBottom: 12 }}><CalloutBox variant="info">{t('profile.whatsappWeb.empty')}</CalloutBox></div>
          )}

          {devices.map((d) => (
            <WhatsAppWebDevice
              key={d.id}
              device={d}
              busy={busyId === d.id}
              notEnabled={notEnabledId === d.id}
              onConnect={connect}
              onDisconnect={id => guarded(disconnect(id))}
              onRemove={id => guarded(remove(id))}
            />
          ))}

          <Button variant="primary" size="sm" onClick={() => guarded(createDevice())} disabled={busyId === 'new'}>
            {busyId === 'new' ? <Spinner size={14} /> : <Plus size={14} />}
            {t('profile.whatsappWeb.addDevice')}
          </Button>

          {/* Contact-sync note (K-193 fase 1 §5): server-side, no FE action needed. */}
          <Caption style={{ marginTop: 14, display: 'block', lineHeight: 1.6 }}>
            {t('profile.whatsappWeb.contactSyncNote')}
          </Caption>
        </>
        </>
      )}
    </div>
  )
}
