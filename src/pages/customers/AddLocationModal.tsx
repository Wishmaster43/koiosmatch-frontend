/**
 * AddLocationModal — create (or edit, via `initial`) a customer location with the
 * FULL C-6 field set the backend accepts (CustomerLocationController::rules).
 *
 * Widened to the house "wide form" frame (Danny 27-07: "+ vestiging nalopen want
 * klopt van geen kant, te small" — every create modal must match +Match/+Kandidaat's
 * footprint) via the shared WIDE_MODAL constant, and regrouped into titled,
 * bordered cards (Algemeen/Adres/Zakelijk/Contact) stacked full-width — mirrors
 * AddContactPersonModal.tsx (same folder, same 27-07 request) rather than the
 * candidates page's 2-column card grid, so the three "customers" sub-modals read
 * as one system. The status picker becomes a searchable CreatableSelect
 * (allowCreate={false} — a real relational id, never a free-text create).
 * `country` stays a plain text field on purpose: unlike the candidate's ISO-2
 * `country` code, this one is a free-text string (BE `country` column, default
 * "Nederland") with no lookup behind it — turning it into an ISO-2 picker would
 * silently change what gets submitted, out of scope for a layout-only pass.
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, MapPin } from 'lucide-react'
import { Field, TextField, CheckboxField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import type { LocationPayload } from './hooks/useCustomerLocations'
import type { Location } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// Card chrome — mirrors AddContactPersonModal/matchPlacement's cardHead/cardBox
// exactly (11px uppercase muted heading over a bordered surface) so every
// "wide form" modal under pages/customers reads as the same system (Danny 27-07).
const cardHead = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
const cardBox = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 12 }
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
// Even 3-across (KvK/BTW/kostenplaats) — the panel is wide enough now that all
// three "Zakelijk" fields fit on one row instead of a cramped two-field card.
const row3Even = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }
// Weighted rows for the address block (mirrors the candidate AddressCard's own
// street/postcode ratios — the same real-world field, same proportions).
const rowStreet = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }
const rowPostal = { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }

// 422 field-error keys are snake_case; map them back to this form's field names.
// No billing_email entry (Danny 2026-07-22): that field has no input here anymore
// (facturatie always comes from the customer), so there is nothing to blame it on.
const API_TO_FORM: Record<string, string> = {
  name: 'name', street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix',
  postcode: 'postalCode', city: 'city', state: 'state', country: 'country',
  coc_number: 'cocNumber', vat_number: 'vatNumber', contact_name: 'contactName',
  phone: 'phone', email: 'email', is_headquarter: 'isHeadquarter',
  cost_center: 'costCenter', status_id: 'statusId',
}

export default function AddLocationModal({ onClose, onCreate, customerName, statuses = [], initial }: {
  onClose: () => void
  onCreate?: (v: LocationPayload) => void
  customerName?: string
  statuses?: LookupOption[]
  // Editing an existing location pre-fills the form and flips the copy/action to "save".
  initial?: Location | null
}) {
  const { t } = useTranslation(['customers', 'common'])
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
    // No billingEmail INPUT anymore (Danny 2026-07-22: facturatie always comes from
    // the customer, see OverviewTab) — kept here only as an untouched passthrough so
    // an edit-save round trip never clears whatever the record already had stored.
    billingEmail: initial?.billingEmail ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    customFields: initial?.customFields ?? {},
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  const set = <K extends keyof LocationPayload>(k: K, v: LocationPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  const submit = async () => {
    if (!form.name.trim()) { setErrors({ name: true }); return }
    const payload = { ...form, name: form.name.trim() }
    // Edit path: update() keeps its existing toast-based error handling — unchanged,
    // closes immediately.
    if (isEdit) { onCreate?.(payload); onClose(); return }
    // Create path: add() rethrows on failure (C-18) so 422 field errors land under
    // their fields here instead of a generic toast while the modal closed regardless.
    try {
      await onCreate?.(payload)
      onClose()
    } catch (err) {
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    }
  }

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isEdit ? t('subModal.editLocation') : t('subModal.addLocation')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', ...WIDE_MODAL, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Algemeen — name, status, hoofdvestiging. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.general')}</div>
            <div style={cardBox}>
              <div>
                <Field label={t('subModal.locationName')} required>
                  <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.locationPlaceholder')} error={errors.name} />
                </Field>
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
              </div>
              <div style={{ ...row2, alignItems: 'end' }}>
                <Field label={t('subModal.status')}>
                  <CreatableSelect value={form.statusId ? String(form.statusId) : null} onChange={v => set('statusId', v || null)} allowCreate={false}
                    placeholder={t('subModal.selectStatus')} options={statusOptions} />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
                  <CheckboxField checked={form.isHeadquarter} onChange={v => set('isHeadquarter', v)} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.headquarter')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Adres. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.address')}</div>
            <div style={cardBox}>
              <div style={rowStreet}>
                <Field label={t('subModal.street')}><TextField value={form.street} onChange={v => set('street', v)} /></Field>
                <Field label={t('subModal.houseNumber')}><TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} /></Field>
                <Field label={t('subModal.houseNumberSuffix')}><TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} /></Field>
              </div>
              <div style={rowPostal}>
                <Field label={t('subModal.postalCode')}><TextField value={form.postalCode} onChange={v => set('postalCode', v)} placeholder="1234 AB" /></Field>
                <Field label={t('subModal.city')}><TextField value={form.city} onChange={v => set('city', v)} /></Field>
              </div>
              <div style={row2}>
                <Field label={t('subModal.state')}><TextField value={form.state} onChange={v => set('state', v)} /></Field>
                {/* `country` stays free text on purpose — see file header comment. */}
                <Field label={t('subModal.country')}><TextField value={form.country} onChange={v => set('country', v)} /></Field>
              </div>
            </div>
          </div>

          {/* Zakelijk — KvK/BTW (was "Registratie") + kostenplaats (was its own
              "Facturatie" card) merged into one card (Danny 27-07 grouping): all
              three now fit on a single row at the wider width. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.business')}</div>
            <div style={cardBox}>
              <div style={row3Even}>
                <Field label={t('subModal.coc')}><TextField value={form.cocNumber} onChange={v => set('cocNumber', v)} /></Field>
                <Field label={t('subModal.vat')}><TextField value={form.vatNumber} onChange={v => set('vatNumber', v)} /></Field>
                <Field label={t('subModal.costCenter')}><TextField value={form.costCenter} onChange={v => set('costCenter', v)} /></Field>
              </div>
            </div>
          </div>

          {/* Contact ter plaatse. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.contact')}</div>
            <div style={cardBox}>
              <Field label={t('subModal.contactName')}><TextField value={form.contactName} onChange={v => set('contactName', v)} /></Field>
              <div style={row2}>
                <Field label={t('subModal.email')}><TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder="naam@klant.nl" /></Field>
                <Field label={t('subModal.phone')}><TextField value={form.phone} onChange={v => set('phone', v)} /></Field>
              </div>
            </div>
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!form.name.trim()} style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: form.name.trim() ? 'var(--color-primary)' : 'var(--border)', color: form.name.trim() ? 'white' : 'var(--text-muted)', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
