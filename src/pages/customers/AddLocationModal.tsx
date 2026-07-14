/**
 * AddLocationModal — create (or edit, via `initial`) a customer location with the
 * FULL C-6 field set the backend accepts (CustomerLocationController::rules):
 * Algemeen (naam/status/hoofdvestiging), Adres, Registratie, Contact ter plaatse,
 * Facturatie. Danny 13/7: the old name+city-only popup was "far too bare" — this
 * is the detailed replacement. Reuses the shared Field/TextField/SelectField/
 * CheckboxField primitives (no hand-rolled input styling).
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, MapPin } from 'lucide-react'
import { Field, TextField, SelectField, CheckboxField } from '@/components/forms/fields'
import type { LocationPayload } from './hooks/useCustomerLocations'
import type { Location } from '@/types/customer'
import type { LookupOption } from '@/types/common'

const groupTitle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8, marginTop: 4 }
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const row3 = { display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 12 }

export default function AddLocationModal({ onClose, onCreate, customerName, statuses = [], initial }: {
  onClose: () => void
  onCreate?: (v: LocationPayload) => void
  customerName?: string
  statuses?: LookupOption[]
  // Editing an existing location pre-fills the form and flips the copy/action to "save".
  initial?: Location | null
}) {
  const { t } = useTranslation('customers')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const isEdit = Boolean(initial)
  const [form, setForm] = useState<LocationPayload>({
    name: initial?.name ?? '',
    street: initial?.street ?? '',
    houseNumber: initial?.houseNumber ?? '',
    houseNumberSuffix: initial?.houseNumberSuffix ?? '',
    postalCode: initial?.postalCode ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    country: initial?.country ?? 'Nederland',
    cocNumber: initial?.cocNumber ?? '',
    vatNumber: initial?.vatNumber ?? '',
    contactName: initial?.contactName ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    isHeadquarter: initial?.isHeadquarter ?? false,
    costCenter: initial?.costCenter ?? '',
    billingEmail: initial?.billingEmail ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
  })
  const [error, setError] = useState(false)
  const set = <K extends keyof LocationPayload>(k: K, v: LocationPayload[K]) => { setForm(f => ({ ...f, [k]: v })); if (k === 'name') setError(false) }

  const submit = () => {
    if (!form.name.trim()) { setError(true); return }
    onCreate?.({ ...form, name: form.name.trim() })
    onClose()
  }

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isEdit ? t('subModal.editLocation') : t('subModal.addLocation')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={15} color="var(--color-secondary)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('subModal.editLocation') : t('subModal.addLocation')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Algemeen — name, status, hoofdvestiging. */}
          <div style={groupTitle}>{t('subModal.groups.general')}</div>
          <div style={{ marginBottom: 12 }}>
            <Field label={t('subModal.locationName')} required>
              <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.locationPlaceholder')} error={error} />
            </Field>
            {error && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
          </div>
          <div style={{ ...row2, marginBottom: 12, alignItems: 'end' }}>
            <Field label={t('subModal.status')}>
              <SelectField value={form.statusId ? String(form.statusId) : ''} onChange={v => set('statusId', v || null)} placeholder={t('subModal.selectStatus')} options={statusOptions} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
              <CheckboxField checked={form.isHeadquarter} onChange={v => set('isHeadquarter', v)} />
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.headquarter')}</span>
            </label>
          </div>

          {/* Adres. */}
          <div style={groupTitle}>{t('subModal.groups.address')}</div>
          <div style={{ ...row3, marginBottom: 12 }}>
            <Field label={t('subModal.street')}><TextField value={form.street} onChange={v => set('street', v)} /></Field>
            <Field label={t('subModal.houseNumber')}><TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} /></Field>
            <Field label={t('subModal.houseNumberSuffix')}><TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} /></Field>
          </div>
          <div style={{ ...row2, marginBottom: 12 }}>
            <Field label={t('subModal.postalCode')}><TextField value={form.postalCode} onChange={v => set('postalCode', v)} placeholder="1234 AB" /></Field>
            <Field label={t('subModal.city')}><TextField value={form.city} onChange={v => set('city', v)} /></Field>
          </div>
          <div style={{ ...row2, marginBottom: 12 }}>
            <Field label={t('subModal.state')}><TextField value={form.state} onChange={v => set('state', v)} /></Field>
            <Field label={t('subModal.country')}><TextField value={form.country} onChange={v => set('country', v)} /></Field>
          </div>

          {/* Registratie. */}
          <div style={groupTitle}>{t('subModal.groups.registration')}</div>
          <div style={{ ...row2, marginBottom: 12 }}>
            <Field label={t('subModal.coc')}><TextField value={form.cocNumber} onChange={v => set('cocNumber', v)} /></Field>
            <Field label={t('subModal.vat')}><TextField value={form.vatNumber} onChange={v => set('vatNumber', v)} /></Field>
          </div>

          {/* Contact ter plaatse. */}
          <div style={groupTitle}>{t('subModal.groups.contact')}</div>
          <div style={{ marginBottom: 12 }}>
            <Field label={t('subModal.contactName')}><TextField value={form.contactName} onChange={v => set('contactName', v)} /></Field>
          </div>
          <div style={{ ...row2, marginBottom: 12 }}>
            <Field label={t('subModal.email')}><TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder="naam@klant.nl" /></Field>
            <Field label={t('subModal.phone')}><TextField value={form.phone} onChange={v => set('phone', v)} /></Field>
          </div>

          {/* Facturatie. */}
          <div style={groupTitle}>{t('subModal.groups.billing')}</div>
          <div style={{ ...row2, marginBottom: 4 }}>
            <Field label={t('subModal.costCenter')}><TextField value={form.costCenter} onChange={v => set('costCenter', v)} /></Field>
            <Field label={t('subModal.billingEmail')}><TextField type="email" value={form.billingEmail} onChange={v => set('billingEmail', v)} /></Field>
          </div>
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!form.name.trim()} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: form.name.trim() ? 'var(--color-primary)' : '#E5E7EB', color: form.name.trim() ? 'white' : '#9CA3AF', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
