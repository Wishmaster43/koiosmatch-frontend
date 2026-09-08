/**
 * WhatsAppWebNumbersSettings — Settings → WhatsApp → WhatsApp Web numbers
 * (K-195 / VESTIGING-DEVICE-1, CMBE d88ad05e). Lists the tenant's BRANCH
 * WhatsApp Web devices (`/settings/whatsapp-web-numbers`, `settings.view`)
 * and offers an add form (`settings.update`) to link a new one to one or more
 * branches. Reuses the exact device card from Profile (`WhatsAppWebDevice`) —
 * only the owning entity differs (a user vs. a branch), never the card itself.
 * The queue-limit card renders below the list (K-193 WA-6a/G-12).
 *
 * WA-WEB-BRANCHES-1 (CMBE ae235dea, Danny 08-09 "1 nummer kan voor meerdere
 * vestigingen zijn"): a device serves ONE OR MORE branches — rows carry
 * `locations[]` (the singular `location` is deprecated and no longer read), the
 * add form POSTs `location_ids[]` (min 1) and each row's pencil opens the same
 * branch picker to PATCH the full set (`/settings/whatsapp-web-numbers/{id}`).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocations } from '@/lib/useLocations'
import { useWhatsAppWeb } from '@/components/whatsappWeb/useWhatsAppWeb'
import WhatsAppWebDevice from '@/components/whatsappWeb/WhatsAppWebDevice'
import WhatsAppWebGatewayBanner from '@/components/whatsappWeb/WhatsAppWebGatewayBanner'
import { useWhatsAppWebHealth } from '@/components/whatsappWeb/useWhatsAppWebHealth'
import type { WhatsAppDevice } from '@/components/whatsappWeb/statusMeta'
import WaWebQueueLimits from './WaWebQueueLimits'
import WaWebBranchPicker from './WaWebBranchPicker'
import { FieldRow, TextField } from '@/components/forms/fields'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import { Caption, GroupLabel, SectionTitle } from '@/components/ui/typography'

const SETTINGS_BASE_PATH = '/settings/whatsapp-web-numbers'

// A branch device row carries the same shape as a personal one, plus the branches
// it serves (WA-WEB-BRANCHES-1 row: `locations [{id,name}]`, sorted by name).
type BranchDevice = WhatsAppDevice & { locations?: { id: string | number; name: string }[] }

// Toggle one id in a string-id set (the picker hands back one value per click).
const toggleId = (ids: string[], id: string) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]

// Lists the tenant's branch WhatsApp Web devices and offers a permission-gated
// add form; reuses the exact device card from Profile (only the owning entity differs).
export default function WhatsAppWebNumbersSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('settings.update') === true
  const locations = useLocations()

  // Devices + mutations, generalised from the profile hook via basePath (K-195).
  const { devices, phase, busyId, notEnabledId, unreachableId, createDevice, updateDevice, connect, disconnect, remove } =
    useWhatsAppWeb(SETTINGS_BASE_PATH)
  // Gateway verdict from /whatsapp-web/health: banner + linking off while it is down.
  const { gateway, gatewayDown } = useWhatsAppWebHealth()
  const rows = devices as BranchDevice[]

  // Add-form local state: which branches (min 1), optional label/phone.
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Per-device branch editor: which row is open, its working set of ids, its own error.
  const [editingId, setEditingId] = useState<BranchDevice['id'] | null>(null)
  const [editIds, setEditIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)

  // Submit: at least one branch is required by the contract; label/phone are optional.
  const handleAdd = async () => {
    if (locationIds.length === 0) return
    setSubmitError(null)
    // A failed POST keeps the input on screen and says so (run() resolves false, never throws).
    const ok = await createDevice({ location_ids: locationIds, label: label || undefined, phone_number: phone || undefined })
    if (!ok) { setSubmitError(t('whatsappWeb.createError')); return }
    setLocationIds([])
    setLabel('')
    setPhone('')
  }

  // Open a row's branch editor seeded with the branches it serves now.
  const startEdit = (device: BranchDevice) => {
    setEditError(null)
    setEditingId(device.id)
    setEditIds((device.locations ?? []).map(l => String(l.id)))
  }

  // PATCH the full new set; a failed PATCH keeps the editor open with the picks intact.
  const saveEdit = async () => {
    if (editingId == null || editIds.length === 0) return
    setEditError(null)
    const ok = await updateDevice(editingId, { location_ids: editIds })
    if (!ok) { setEditError(t('whatsappWeb.updateError')); return }
    setEditingId(null)
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
          <WhatsAppWebGatewayBanner gateway={gateway} />
          {/* Empty state */}
          {rows.length === 0 && <CalloutBox variant="info">{t('whatsappWeb.empty')}</CalloutBox>}

          {/* One card per branch device, the served branch names as its title prefix;
              the pencil opens the branch editor for that row (settings.update only). */}
          {rows.map(device => (
            <div key={device.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <GroupLabel>
                  {device.locations?.length ? device.locations.map(l => l.name).join(', ') : t('whatsappWeb.noLocation')}
                </GroupLabel>
                {canManage && editingId !== device.id && (
                  <Button variant="ghost" size="sm" iconOnly aria-label={t('whatsappWeb.editLocations')}
                    title={t('whatsappWeb.editLocations')} onClick={() => startEdit(device)} disabled={busyId === device.id}>
                    <Pencil size={12} />
                  </Button>
                )}
              </div>
              {editingId === device.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', marginBottom: 8,
                              background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <WaWebBranchPicker options={locations} values={editIds} ariaLabel={t('whatsappWeb.locationLabel')}
                    onToggle={id => setEditIds(prev => toggleId(prev, id))} />
                  {editError && <CalloutBox variant="danger">{editError}</CalloutBox>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="primary" size="sm" onClick={saveEdit} disabled={editIds.length === 0 || busyId === device.id}>
                      {busyId === device.id ? <Spinner size={13} /> : null}
                      {t('whatsappWeb.saveLocations')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)} disabled={busyId === device.id}>
                      {t('common:cancel')}
                    </Button>
                  </div>
                </div>
              )}
              <WhatsAppWebDevice
                device={device}
                busy={busyId === device.id}
                notEnabled={notEnabledId === device.id}
                unreachable={unreachableId === device.id}
                gatewayDown={gatewayDown}
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
                  <WaWebBranchPicker options={locations} values={locationIds} ariaLabel={t('whatsappWeb.locationLabel')}
                    onToggle={id => setLocationIds(prev => toggleId(prev, id))} />
                </FieldRow>
                <FieldRow label={t('whatsappWeb.labelField')}>
                  <TextField value={label} onChange={setLabel} placeholder={t('whatsappWeb.labelPlaceholder')} />
                </FieldRow>
                <FieldRow label={t('whatsappWeb.phoneField')}>
                  <TextField value={phone} onChange={setPhone} placeholder={t('whatsappWeb.phonePlaceholder')} />
                </FieldRow>
                {submitError && <CalloutBox variant="danger">{submitError}</CalloutBox>}
                <div>
                  <Button variant="primary" size="sm" onClick={handleAdd} disabled={locationIds.length === 0 || busyId === 'new' || gatewayDown}>
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
