// Extracted from AddContactPersonModal (SIZE-SPLIT-B, zero behaviour change):
// the cross-card orchestration — form/error state, the primary-replace confirm,
// the client-side duplicate check, the location→department cascade, and the
// submit chain + 422 field-error mapping. See AddContactPersonModal's own
// module doc for the full design rationale (CARD SPLIT, §0.3).
import { useState, useEffect } from 'react'
import type { TFunction } from 'i18next'
import { useConfirm } from '@/hooks/useConfirm'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { useImportWizard } from '@/pages/settings/shared'
import type { ContactPayload } from './hooks/useCustomerContacts'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

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
  first_name: 'firstName', middle_name: 'middleName', last_name: 'lastName', email: 'email', phone: 'phone', mobile: 'mobile', gender: 'gender',
  preferred_language: 'preferredLanguage',
  function: 'role', customer_location_id: 'locationId', customer_department_id: 'departmentId',
  status_id: 'statusId', is_primary: 'isPrimary',
  // CONTACT-LINKEDIN-1: the backend validation rule/column is `linkedin_slug`.
  linkedin_slug: 'linkedin',
}

// VALIDATIE-LIVE-1-rest: `email` is the only contact field the backend
// validates with a shape rule (CustomerContactController::validateContact
// `email` => Laravel's `email` rule) — phone/mobile/linkedin_slug stay plain
// strings server-side, so no live format gate is added for them here (see
// src/lib/contactFieldValidation.ts for the full backend-verification note).
const EMAIL_VALIDATORS = { email: isValidEmailFormat }
const EMAIL_ERROR_KEYS = { email: 'validation.emailFormat' }

export function useAddContactPersonForm({
  onCreate, onClose, onImported, departments, statuses, initial, lockLocationId, lockDepartmentId, existing, t,
}: {
  onCreate?: (v: ContactPayload) => void
  onClose: () => void
  onImported?: () => void
  departments: Department[]
  statuses: LookupOption[]
  initial?: Contact | null
  lockLocationId?: Id
  lockDepartmentId?: Id
  existing: Contact[]
  t: TFunction
}) {
  const { confirm, dialog } = useConfirm()
  const isEdit = Boolean(initial)
  // The wizard state lives HERE (container) — mirrors AddCustomerModal.
  const importWizard = useImportWizard('contacts')
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState<ContactPayload>({
    firstName: initial?.firstName ?? '',
    middleName: initial?.middleName ?? '',
    lastName: initial?.lastName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    mobile: initial?.mobile ?? '',
    // CONTACT-LINKEDIN-1 (Danny 05-08): whatever the field holds — a bare slug or a
    // pasted full URL — gets stripped to the clean slug at the save boundary.
    linkedin: initial?.linkedin ?? '',
    gender: initial?.gender ?? '',
    preferredLanguage: initial?.preferredLanguage ?? '',
    role: initial?.role ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? null,
    departmentId: initial?.departmentId ?? lockDepartmentId ?? null,
    locationIds: initial?.locations?.map(l => l.id) ?? [],
    departmentIds: initial?.departments?.map(d => d.id) ?? [],
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    isPrimary: initial?.isPrimary ?? false,
    customFields: initial?.customFields ?? {},
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for email — owns
  // the per-field message state too (the server's own 422 text, set via
  // setFieldMessages below, always wins over a live check).
  const { fieldMessages, setFieldMessages, markTouched, fieldMessage, clearFieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)
  const set = <K extends keyof ContactPayload>(k: K, v: ContactPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    clearFieldMessage(k)
    setCreateError(null)
  }

  // SUBENTITY-IMPORT-1: a real run that landed at least one row means the contact(s)
  // already exist — close this modal (and let the parent refresh its list) so the
  // untouched manual form below can never also fire a second, duplicate create.
  useEffect(() => {
    if (importWizard.run.status !== 'success') return
    const { summary } = importWizard.run.result
    if (summary.create + summary.update === 0) return
    onImported?.()
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the run RESULT changing, not onClose/onImported identity
  }, [importWizard.run])

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
    // VALIDATIE-LIVE-1-rest: block on a live format failure too — marks any
    // untouched-but-malformed field touched so its message renders.
    const invalidKeys = touchInvalidFields()
    if (!form.firstName.trim() || !form.lastName.trim() || invalidKeys.length) {
      setErrors({ firstName: !form.firstName.trim(), lastName: !form.lastName.trim() })
      return
    }
    // Client-side duplicate guard — block submit before the server rejects the
    // same collision with a 422; the messages already render live under the fields.
    if (emailDup || phoneDup || mobileDup) {
      setErrors(e => ({ ...e, email: !!emailDup, phone: !!phoneDup, mobile: !!mobileDup }))
      return
    }
    // The pickers here are single-value on purpose — a new contact gets its FIRST
    // coupling; more are added in the drill-down. The arrays are derived from them so the
    // pivots are right from the first write instead of only after the next edit.
    const payload = {
      ...form,
      firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim(),
      locationIds: form.locationId ? [form.locationId] : [],
      departmentIds: form.departmentId ? [form.departmentId] : [],
    }
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

  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim() && !emailDup && !phoneDup && !mobileDup && !hasFormatError
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
  // Symmetric to showLocationPicker — hides the department field when adding
  // "in this department" from a department's own nested contact list.
  const showDepartmentPicker = !lockDepartmentId
  // ContactDetailsCard is pure presentational — the duplicate object stays here
  // (it needs `existing`), only the already-formatted message string goes down.
  // VALIDATIE-LIVE-1-rest: emailMessage now also resolves the live format
  // check via fieldMessage() (server 422 still wins over it); phone/mobile
  // have no format check registered, so fieldMessage() reduces to the same
  // raw 422 text fieldMessages.phone/mobile always held.
  const emailMessage = emailDup ? t('subModal.duplicate.email', { name: emailDup.name }) : fieldMessage('email')
  const phoneMessage = phoneDup ? t('subModal.duplicate.phone', { name: phoneDup.name }) : fieldMessages.phone
  const mobileMessage = mobileDup ? t('subModal.duplicate.mobile', { name: mobileDup.name }) : fieldMessages.mobile

  return {
    isEdit, importWizard, importOpen, setImportOpen, form, set, errors, createError, dialog,
    markTouched, emailDup, phoneDup, mobileDup, submit, canSubmit,
    departmentOptions, departmentPlaceholder, showLocationPicker, showDepartmentPicker,
    emailMessage, phoneMessage, mobileMessage, handlePrimaryToggle,
  }
}
