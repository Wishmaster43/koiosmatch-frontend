/**
 * AddContactPersonModal — create (or edit, via `initial`) a contact person. Full
 * field set CustomerContactController::validateContact accepts: first/last name,
 * email, phone, function, ONE location + ONE department coupling (CONTACT-MULTI-1 —
 * the backend has no multi-value yet), status, primary toggle. One component serves
 * the top-level Contactpersonen tab AND the location detail's nested list —
 * `lockLocationId` pre-fills + hides the location field when adding "at this location".
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Users } from 'lucide-react'
import { Field, TextField, SelectField, CheckboxField } from '@/components/forms/fields'
import type { ContactPayload } from './hooks/useCustomerContacts'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

interface OptionRow { id: Id; name: string }

export default function AddContactPersonModal({
  onClose, onCreate, customerName, locations = [], departments = [], statuses = [], initial, lockLocationId,
}: {
  onClose: () => void
  onCreate?: (v: ContactPayload) => void
  customerName?: string
  locations?: OptionRow[]
  departments?: Department[]
  statuses?: LookupOption[]
  initial?: Contact | null
  lockLocationId?: Id
}) {
  const { t } = useTranslation('customers')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const isEdit = Boolean(initial)
  const [form, setForm] = useState<ContactPayload>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    role: initial?.role ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? null,
    departmentId: initial?.departmentId ?? null,
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    isPrimary: initial?.isPrimary ?? false,
  })
  const [error, setError] = useState(false)
  const set = <K extends keyof ContactPayload>(k: K, v: ContactPayload[K]) => { setForm(f => ({ ...f, [k]: v })); if (k === 'firstName' || k === 'lastName') setError(false) }

  const submit = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError(true); return }
    onCreate?.({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim() })
    onClose()
  }

  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim()
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  // Departments narrow to the picked location once one is chosen (dependent picker, C-42).
  const departmentOptions = (form.locationId ? departments.filter(d => String(d.locationId) === String(form.locationId)) : departments)
    .map(d => ({ value: String(d.id), label: d.name }))
  const showLocationPicker = !lockLocationId

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isEdit ? t('subModal.editContact') : t('subModal.addContact')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={15} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('subModal.editContact') : t('subModal.addContact')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Field label={t('subModal.firstName')} required>
                <TextField value={form.firstName} onChange={v => set('firstName', v)} error={error && !form.firstName.trim()} />
              </Field>
            </div>
            <div>
              <Field label={t('subModal.lastName')} required>
                <TextField value={form.lastName} onChange={v => set('lastName', v)} error={error && !form.lastName.trim()} />
              </Field>
            </div>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: -8 }}>{t('subModal.required')}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('subModal.role')}><TextField value={form.role} onChange={v => set('role', v)} /></Field>
            <Field label={t('subModal.email')}><TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder="naam@klant.nl" /></Field>
          </div>
          <Field label={t('subModal.phone')}><TextField value={form.phone} onChange={v => set('phone', v)} /></Field>

          {showLocationPicker && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('subModal.selectLocation')}>
                <SelectField value={form.locationId ? String(form.locationId) : ''} onChange={v => { set('locationId', v || null); set('departmentId', null) }}
                  placeholder={t('subModal.noneOption')} options={locations.map(l => ({ value: String(l.id), label: l.name }))} />
              </Field>
              <Field label={t('subModal.selectDepartment')}>
                <SelectField value={form.departmentId ? String(form.departmentId) : ''} onChange={v => set('departmentId', v || null)}
                  placeholder={t('subModal.noneOption')} options={departmentOptions} />
              </Field>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
            <Field label={t('subModal.status')}>
              <SelectField value={form.statusId ? String(form.statusId) : ''} onChange={v => set('statusId', v || null)} placeholder={t('subModal.selectStatus')} options={statusOptions} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
              <CheckboxField checked={form.isPrimary} onChange={v => set('isPrimary', v)} />
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.isPrimary')}</span>
            </label>
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? 'white' : '#9CA3AF', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
