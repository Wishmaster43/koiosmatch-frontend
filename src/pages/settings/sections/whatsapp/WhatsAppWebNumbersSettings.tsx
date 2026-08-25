/**
 * WhatsAppWebNumbersSettings — Settings → WhatsApp → WhatsApp Web numbers
 * (K-195 / VESTIGING-DEVICE-1, CMBE d88ad05e). Lists the tenant's BRANCH
 * WhatsApp Web devices (`/settings/whatsapp-web-numbers`, `settings.view`)
 * and offers an add form (`settings.update`) to link a new one to a chosen
 * location. Reuses the exact device card from Profile (`WhatsAppWebDevice`) —
 * only the owning entity differs (a user vs. a branch), never the card itself.
 * The queue-limit card renders below the list (K-193 WA-6a/G-12).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocations } from '@/lib/useLocations'
import { useWhatsAppWeb } from '@/components/whatsappWeb/useWhatsAppWeb'
import WhatsAppWebDevice from '@/components/whatsappWeb/WhatsAppWebDevice'
import type { WhatsAppDevice } from '@/components/whatsappWeb/statusMeta'
import WaWebQueueLimits from './WaWebQueueLimits'
import { FieldRow, SelectField, TextField } from '@/components/forms/fields'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import { Caption, GroupLabel, SectionTitle } from '@/components/ui/typography'

const SETTINGS_BASE_PATH = '/settings/whatsapp-web-numbers'

// A branch device row carries the same shape as a personal one, plus the
// owning location (VESTIGING-DEVICE-1 row: `location {id,name} | null`).
type BranchDevice = WhatsAppDevice & { location?: { id: string | number; name: string } | null }

export default function WhatsAppWebNumbersSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('settings.update') === true
  const locations = useLocations()

  // Devices + mutations, generalised from the profile hook via basePath (K-195).
  const { devices, phase, busyId, notEnabledId, createDevice, connect, disconnect, remove } =
    useWhatsAppWeb(SETTINGS_BASE_PATH)
  const rows = devices as BranchDevice[]

  // Add-form local state: which location, optional label/phone.
  const [locationId, setLocationId] = useState('')
  const [label, setLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Submit: location is required by the contract; label/phone are optional.
  const handleAdd = async () => {
    if (!locationId) return
    setSubmitError(null)
    // A failed POST keeps the input on screen and says so (run() resolves false, never throws).
    const ok = await createDevice({ location_id: locationId, label: label || undefined, phone_number: phone || undefined })
    if (!ok) { setSubmitError(t('whatsappWeb.createError')); return }
    setLocationId('')
    setLabel('')
    setPhone('')
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Caption style={{ marginBottom: 16, display: 'block' }}>{t('whatsappWeb.intro')}</Caption>

      {/* Loading state */}
      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
          <Spinner size={16} /> <Caption>{t('whatsappWeb.loading')}</Caption>
        </div>
      )}

      {/* Module/permission off — calm notice, not an error */}
      {phase === 'unavailable' && <CalloutBox variant="info">{t('whatsappWeb.unavailable')}</CalloutBox>}

      {/* Genuine load failure */}
      {phase === 'error' && <CalloutBox variant="danger">{t('whatsappWeb.error')}</CalloutBox>}

      {phase === 'ready' && (
        <>
          {/* Empty state */}
          {rows.length === 0 && <CalloutBox variant="info">{t('whatsappWeb.empty')}</CalloutBox>}

          {/* One card per branch device, the location name as its title prefix. */}
          {rows.map(device => (
            <div key={device.id} style={{ marginBottom: 14 }}>
              <GroupLabel style={{ marginBottom: 4, display: 'block' }}>
                {device.location?.name ?? t('whatsappWeb.noLocation')}
              </GroupLabel>
              <WhatsAppWebDevice
                device={device}
                busy={busyId === device.id}
                notEnabled={notEnabledId === device.id}
                onConnect={connect}
                onDisconnect={async id => { if (!(await disconnect(id))) setSubmitError(t('whatsappWeb.actionError')) }}
                onRemove={async id => { if (!(await remove(id))) setSubmitError(t('whatsappWeb.actionError')) }}
              />
              <Caption style={{ marginTop: -6, display: 'block' }}>{t('whatsappWeb.contactSyncNote')}</Caption>
            </div>
          ))}

          {/* Add form — location select is required; label/phone optional. Hidden
              behind settings.update, mirrors the §3 authorization-gated pattern. */}
          {canManage && (
            <div style={{ marginTop: 20, padding: 16, background: 'var(--input-bg)',
                          border: '1px solid var(--border)', borderRadius: 10 }}>
              <SectionTitle style={{ marginBottom: 12, display: 'block' }}>{t('whatsappWeb.addTitle')}</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={t('whatsappWeb.locationLabel')} required>
                  <SelectField value={locationId} onChange={setLocationId}
                    options={locations.map(l => ({ value: String(l.value), label: l.label }))}
                    placeholder={t('whatsappWeb.locationPlaceholder')} />
                </FieldRow>
                <FieldRow label={t('whatsappWeb.labelField')}>
                  <TextField value={label} onChange={setLabel} placeholder={t('whatsappWeb.labelPlaceholder')} />
                </FieldRow>
                <FieldRow label={t('whatsappWeb.phoneField')}>
                  <TextField value={phone} onChange={setPhone} placeholder={t('whatsappWeb.phonePlaceholder')} />
                </FieldRow>
                {submitError && <CalloutBox variant="danger">{submitError}</CalloutBox>}
                <div>
                  <Button variant="primary" size="sm" onClick={handleAdd} disabled={!locationId || busyId === 'new'}>
                    {busyId === 'new' ? <Spinner size={13} /> : <Plus size={13} />}
                    {t('whatsappWeb.submit')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Queue-limits card renders only once the list itself is ready, so
              the two cards never show contradictory phases at once. */}
          <div style={{ marginTop: 24 }}>
            <WaWebQueueLimits canManage={canManage} />
          </div>
        </>
      )}
    </div>
  )
}
