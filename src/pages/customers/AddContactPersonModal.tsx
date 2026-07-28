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
 * Koppeling) using the shared `@/components/ui/modalCards` chrome (CLAUDE.md §11:
 * one source instead of a per-entity copy) so the look matches every other wide
 * create-modal exactly. The location/department pickers become searchable
 * CreatableSelects (allowCreate={false} — both are real relational ids, never a
 * free-text create), same as every other relational picker in the app.
 *
 * Danny 28-07 fixes: (1) locking the location (adding "at this location") used to
 * hide the WHOLE row2 block, taking the department picker down with it — the
 * department field now always renders, only the location field is conditional.
 * (2) "Primair contact" is now the shared `Toggle` (never a raw checkbox, house
 * rule) and asks via `useConfirm` before silently demoting whichever OTHER contact
 * currently holds the flag — the backend allows exactly one primary per customer
 * and demotes the previous one without asking, so the UI must ask first. (3) A
 * client-side duplicate check on email/phone/mobile (scoped to this customer's
 * OTHER contacts, via the new `existing` prop) blocks submit and explains why,
 * instead of letting the server's 422 be the first the user hears of it. (4) The
 * CreatableSelect trigger boxes (role/location/department/status) get an explicit
 * style override so they render at the exact same height/width as the TextField
 * siblings sharing their grid row — mirrors the identical fix already applied in
 * `pages/candidates/addmodal/fields.tsx` for the same trigger-vs-input mismatch.
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useConfirm } from '@/hooks/useConfirm'
import { useTranslation } from 'react-i18next'
import { X, Users } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Toggle from '@/components/ui/Toggle'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox, row2, row3Even } from '@/components/ui/modalCards'
import type { ContactPayload } from './hooks/useCustomerContacts'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

interface OptionRow { id: Id; name: string }

// Matches the TextField input footprint exactly (padding/font-size/radius) — the
// CreatableSelect trigger otherwise renders smaller (6px/12px vs 8px/13px), the
// same mismatch already fixed once in `pages/candidates/addmodal/fields.tsx`.
const CREATABLE_STYLE = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

// Normalize an email for duplicate comparison — trimmed, case-insensitive; empty never matches.
const normalizeEmail = (v: string) => v.trim().toLowerCase()
// Normalize a phone/mobile number for duplicate comparison — digits only, so
// punctuation/spacing differences ("010-522 97 18" vs "0105229718") don't hide a
// real collision. This is a plain digit-strip, not an international-format
// normalization — "+31 10 522 97 18" and "0105229718" are NOT folded into the
// same value (no country-code/leading-zero equivalence), matching the backend's
// own plain-string check; empty never matches.
const normalizeDigits = (v: string) => String(v ?? '').replace(/\D/g, '')

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  first_name: 'firstName', last_name: 'lastName', email: 'email', phone: 'phone', mobile: 'mobile',
  function: 'role', customer_location_id: 'locationId', customer_department_id: 'departmentId',
  status_id: 'statusId', is_primary: 'isPrimary',
}

// Duplicate/server message line under email·phone·mobile — the client-side
// duplicate message wins over the server's own message when both exist (same collision).
function FieldError({ text }: { text?: string }) {
  if (!text) return null
  return <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger)' }}>{text}</div>
}

export default function AddContactPersonModal({
  onClose, onCreate, customerName, locations = [], departments = [], statuses = [], initial, lockLocationId, existing = [],
}: {
  onClose: () => void
  onCreate?: (v: ContactPayload) => void
  customerName?: string
  locations?: OptionRow[]
  departments?: Department[]
  statuses?: LookupOption[]
  initial?: Contact | null
  lockLocationId?: Id
  // The customer's OTHER already-loaded contacts — drives the primary-replace
  // confirmation and the email/phone/mobile duplicate check below.
  existing?: Contact[]
}) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { confirm, dialog } = useConfirm()
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
  // The server's own per-field message (first one, when it sends one) — shown
  // under the field alongside the red border instead of being thrown away.
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  const set = <K extends keyof ContactPayload>(k: K, v: ContactPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    if (fieldMessages[k]) setFieldMessages(m => ({ ...m, [k]: '' }))
    setCreateError(null)
  }

  // The contact who currently holds the primary flag (excluding the one being
  // edited, so re-saving the already-primary contact never prompts).
  const currentPrimary = existing.find(c => c.isPrimary && String(c.id) !== String(initial?.id))
  // Turning the toggle ON while someone else is primary asks first — the backend
  // silently demotes the previous primary, so the UI must not do that silently too.
  // Turning it OFF never asks.
  const handlePrimaryToggle = (v: boolean) => {
    if (v && currentPrimary) {
      confirm(t('subModal.primaryReplace.body', { name: currentPrimary.name }), () => set('isPrimary', true), {
        title: t('subModal.primaryReplace.title'),
        confirmLabel: t('subModal.primaryReplace.confirm'),
        cancelLabel: t('subModal.primaryReplace.decline'),
      })
      return
    }
    set('isPrimary', v)
  }

  // Find another contact of this customer that already has the same email/phone/
  // mobile value — scoped per field (phone only collides with phone, mobile only
  // with mobile), never cross-field, mirroring the backend's own check.
  const findDuplicate = (value: string, field: 'email' | 'phone' | 'mobile') => {
    const normalize = field === 'email' ? normalizeEmail : normalizeDigits
    const target = normalize(value)
    if (!target) return undefined
    return existing.find(c => String(c.id) !== String(initial?.id) && normalize(c[field]) === target)
  }
  const emailDup = findDuplicate(form.email, 'email')
  const phoneDup = findDuplicate(form.phone, 'phone')
  const mobileDup = findDuplicate(form.mobile, 'mobile')

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErrors({ firstName: !form.firstName.trim(), lastName: !form.lastName.trim() })
      return
    }
    // Client-side duplicate guard — block submit before the server rejects the
    // same collision with a 422; the messages already render live under the fields.
    if (emailDup || phoneDup || mobileDup) {
      setErrors(e => ({ ...e, email: !!emailDup, phone: !!phoneDup, mobile: !!mobileDup }))
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
        const m2: Record<string, string> = {}
        Object.entries(apiErrors).forEach(([k, v]) => {
          const field = API_TO_FORM[k] ?? k
          e2[field] = true
          // Laravel 422 payloads carry an array of messages per field — keep the first.
          const msg = Array.isArray(v) ? v[0] : v
          if (typeof msg === 'string') m2[field] = msg
        })
        setErrors(e2)
        setFieldMessages(m2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    }
  }

  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim() && !emailDup && !phoneDup && !mobileDup
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  // Department options stay EMPTY until a location is picked — mirrors AddShiftModal's
  // customer->department cascade (PLAN-LOOKUP-1). Never fall back to "every department
  // of this customer": a department belongs to exactly one location, so offering the
  // full list would let one from a DIFFERENT location get submitted alongside it.
  const departmentsForLocation = form.locationId ? departments.filter(d => String(d.locationId) === String(form.locationId)) : []
  // Edit mode may load a contact whose location/department were set independently via
  // the drawer's chip-select (CONTACT-MULTI-1 has no cascade there) — keep the currently
  // selected department visible even if it falls outside the location filter, so its
  // label still resolves instead of the trigger falling back to a raw id string.
  const selectedDepartment = form.departmentId ? departments.find(d => String(d.id) === String(form.departmentId)) : undefined
  const departmentOptions = (selectedDepartment && !departmentsForLocation.some(d => String(d.id) === String(selectedDepartment.id))
    ? [...departmentsForLocation, selectedDepartment]
    : departmentsForLocation
  ).map(d => ({ value: String(d.id), label: d.name }))
  const departmentPlaceholder = !form.locationId ? t('subModal.pickLocationFirst')
    : departmentOptions.length === 0 ? t('common:noResults')
    : t('subModal.noneOption')
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
                    allowCreate={allowFreeEntry} placeholder={t('common:select')} style={CREATABLE_STYLE} />
                </Field>
                <div />
              </div>
            </div>
          </div>

          {/* Contact — e-mail/telefoon/mobiel (Danny 27-07: exact card the request named). */}
          <div>
            <div style={cardHead}>{t('subModal.groups.contactInfo')}</div>
            <div style={cardBox}>
              <div style={row3Even}>
                <div>
                  <Field label={t('subModal.email')}>
                    <TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder="naam@klant.nl" error={!!emailDup || errors.email} />
                  </Field>
                  <FieldError text={emailDup ? t('subModal.duplicate.email', { name: emailDup.name }) : fieldMessages.email} />
                </div>
                <div>
                  <Field label={t('subModal.phone')}>
                    <TextField value={form.phone} onChange={v => set('phone', v)} error={!!phoneDup || errors.phone} />
                  </Field>
                  <FieldError text={phoneDup ? t('subModal.duplicate.phone', { name: phoneDup.name }) : fieldMessages.phone} />
                </div>
                <div>
                  <Field label={t('subModal.mobile')}>
                    <TextField value={form.mobile} onChange={v => set('mobile', v)} error={!!mobileDup || errors.mobile} />
                  </Field>
                  <FieldError text={mobileDup ? t('subModal.duplicate.mobile', { name: mobileDup.name }) : fieldMessages.mobile} />
                </div>
              </div>
            </div>
          </div>

          {/* Koppeling — locatie/afdeling (searchable, allowCreate=false: real relational
              ids) + status/primair-vlag for that link. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.link')}</div>
            <div style={cardBox}>
              {/* Location is only picked here at the top-level Contactpersonen tab —
                  `lockLocationId` (adding "at this location") hides ONLY this field.
                  The department field always renders in the same row2 grid so widths
                  stay identical either way: locked -> [department, empty cell],
                  unlocked -> [location, department] — mirrors the Function row above. */}
              <div style={row2}>
                {showLocationPicker && (
                  <Field label={t('subModal.selectLocation')}>
                    <CreatableSelect value={form.locationId ? String(form.locationId) : null} allowCreate={false}
                      onChange={v => { set('locationId', v || null); set('departmentId', null) }}
                      placeholder={t('subModal.noneOption')} options={locations.map(l => ({ value: String(l.id), label: l.name }))}
                      style={CREATABLE_STYLE} />
                  </Field>
                )}
                <Field label={t('subModal.selectDepartment')}>
                  <CreatableSelect value={form.departmentId ? String(form.departmentId) : null} allowCreate={false}
                    onChange={v => set('departmentId', v || null)}
                    placeholder={departmentPlaceholder} options={departmentOptions} style={CREATABLE_STYLE} />
                </Field>
                {!showLocationPicker && <div />}
              </div>
              <div style={{ ...row2, alignItems: 'end' }}>
                <Field label={t('subModal.status')}>
                  <CreatableSelect value={form.statusId ? String(form.statusId) : null} allowCreate={false}
                    onChange={v => set('statusId', v || null)} placeholder={t('subModal.selectStatus')} options={statusOptions}
                    style={CREATABLE_STYLE} />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
                  <Toggle checked={form.isPrimary} onChange={handlePrimaryToggle} ariaLabel={t('subModal.isPrimary')} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.isPrimary')}</span>
                </div>
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
      {dialog}
    </div>
  )
}
