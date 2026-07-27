/**
 * AddContactPersonModal — create (or edit, via `initial`) a contact person. Full
 * field set CustomerContactController::validateContact accepts: first/last name,
 * email, phone, function, ONE location + ONE department coupling (CONTACT-MULTI-1 —
 * the backend has no multi-value yet), status, primary toggle. One component serves
 * the top-level Contactpersonen tab AND the location detail's nested list —
 * `lockLocationId` pre-fills + hides the location field when adding "at this location".
 *
 * Widened to the house "wide form" frame (Danny 27-07: "+ contactpersoon ook" —
 * every create modal must match +Match/+Kandidaat's footprint) via the shared
 * WIDE_MODAL constant, and regrouped into titled, bordered cards (Persoon/Contact/
 * Koppeling) mirroring the placement modal's card idiom (matchPlacement/styles.ts +
 * pages/candidates/addmodal/fields' cardHead/cardBox) — kept as LOCAL constants here
 * rather than a cross-import, since an entity page must not reach into another
 * entity page's internals (CLAUDE.md §2); the values are copied verbatim so the
 * look matches exactly. The location/department pickers become searchable
 * CreatableSelects (allowCreate={false} — both are real relational ids, never a
 * free-text create), same as every other relational picker in the app.
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Users } from 'lucide-react'
import { Field, TextField, CheckboxField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import type { ContactPayload } from './hooks/useCustomerContacts'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

// Card chrome — mirrors matchPlacement/styles' cardHead/cardBox exactly (11px
// uppercase muted heading over a bordered surface) so this "wide form" modal
// reads as the same system as +Match/+Kandidaat (Danny 27-07).
const cardHead = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
const cardBox = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 12 }
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const row3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }

interface OptionRow { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  first_name: 'firstName', last_name: 'lastName', email: 'email', phone: 'phone', mobile: 'mobile',
  function: 'role', customer_location_id: 'locationId', customer_department_id: 'departmentId',
  status_id: 'statusId', is_primary: 'isPrimary',
}

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
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const isEdit = Boolean(initial)
  // Contact function (job title) is a lookup combobox, split from the candidate
  // function list (FUNCTIONS-SPLIT-1) — never a plain free-text field.
  const { contactFunctions, allowFreeEntry } = useContactFunctions()
  const [form, setForm] = useState<ContactPayload>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    mobile: initial?.mobile ?? '',
    role: initial?.role ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? null,
    departmentId: initial?.departmentId ?? null,
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    isPrimary: initial?.isPrimary ?? false,
    customFields: initial?.customFields ?? {},
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  const set = <K extends keyof ContactPayload>(k: K, v: ContactPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErrors({ firstName: !form.firstName.trim(), lastName: !form.lastName.trim() })
      return
    }
    const payload = { ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim() }
    // Edit path: update() keeps its existing toast-based error handling (it also
    // backs the couple/uncouple buttons elsewhere) — unchanged, closes immediately.
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
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', ...WIDE_MODAL, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Persoon — name + function (Danny 27-07 card split: name/lastname/functie). */}
          <div>
            <div style={cardHead}>{t('subModal.groups.person')}</div>
            <div style={cardBox}>
              <div style={row2}>
                <Field label={t('subModal.firstName')} required>
                  <TextField value={form.firstName} onChange={v => set('firstName', v)} error={errors.firstName} />
                </Field>
                <Field label={t('subModal.lastName')} required>
                  <TextField value={form.lastName} onChange={v => set('lastName', v)} error={errors.lastName} />
                </Field>
              </div>
              {(errors.firstName || errors.lastName) && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{t('subModal.required')}</div>}
              {/* Function is a searchable/creatable tenant lookup (contact-function
                  vocabulary, honours the tenant's free-entry setting). It sits in the same
                  two-column grid as the names so it lines up under Voornaam instead of
                  stretching the full 1060px — a lone full-width picker read as a banner
                  (Danny 27-07: "functie is lelijk groot zo"). */}
              <div style={row2}>
                <Field label={t('subModal.role')}>
                  <CreatableSelect value={form.role} onChange={v => set('role', v)} options={contactFunctions}
                    allowCreate={allowFreeEntry} placeholder={t('common:select')} />
                </Field>
                <div />
              </div>
            </div>
          </div>

          {/* Contact — e-mail/telefoon/mobiel (Danny 27-07: exact card the request named). */}
          <div>
            <div style={cardHead}>{t('subModal.groups.contactInfo')}</div>
            <div style={cardBox}>
              <div style={row3}>
                <Field label={t('subModal.email')}><TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder="naam@klant.nl" /></Field>
                <Field label={t('subModal.phone')}><TextField value={form.phone} onChange={v => set('phone', v)} /></Field>
                <Field label={t('subModal.mobile')}><TextField value={form.mobile} onChange={v => set('mobile', v)} /></Field>
              </div>
            </div>
          </div>

          {/* Koppeling — locatie/afdeling (searchable, allowCreate=false: real relational
              ids) + status/primair-vlag for that link. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.link')}</div>
            <div style={cardBox}>
              {showLocationPicker && (
                <div style={row2}>
                  <Field label={t('subModal.selectLocation')}>
                    <CreatableSelect value={form.locationId ? String(form.locationId) : null} allowCreate={false}
                      onChange={v => { set('locationId', v || null); set('departmentId', null) }}
                      placeholder={t('subModal.noneOption')} options={locations.map(l => ({ value: String(l.id), label: l.name }))} />
                  </Field>
                  <Field label={t('subModal.selectDepartment')}>
                    <CreatableSelect value={form.departmentId ? String(form.departmentId) : null} allowCreate={false}
                      onChange={v => set('departmentId', v || null)}
                      placeholder={t('subModal.noneOption')} options={departmentOptions} />
                  </Field>
                </div>
              )}
              <div style={{ ...row2, alignItems: 'end' }}>
                <Field label={t('subModal.status')}>
                  <CreatableSelect value={form.statusId ? String(form.statusId) : null} allowCreate={false}
                    onChange={v => set('statusId', v || null)} placeholder={t('subModal.selectStatus')} options={statusOptions} />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
                  <CheckboxField checked={form.isPrimary} onChange={v => set('isPrimary', v)} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.isPrimary')}</span>
                </label>
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
          <button onClick={submit} disabled={!canSubmit} style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'white' : 'var(--text-muted)', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
