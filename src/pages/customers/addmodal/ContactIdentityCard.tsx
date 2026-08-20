/**
 * ContactIdentityCard — the "Persoon" card of AddContactPersonModal: first/
 * middle/last name plus function (role) and gender. Extracted (§0.3 — the
 * ~400-line split trigger, 2026-08-03); pure presentational, every value and
 * callback comes from the parent's own form state.
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2, row3Even } from '@/components/ui/modalCards'

// Matches the TextField input footprint exactly (padding/font-size/radius) — the
// CreatableSelect trigger otherwise renders smaller (6px/12px vs 8px/13px), the
// same mismatch already fixed once in `pages/candidates/addmodal/fields.tsx`.
const CREATABLE_STYLE = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

interface OptionRow { value: string; label: string }

interface ContactIdentityCardProps {
  firstName: string; onFirstNameChange: (v: string) => void; firstNameError?: boolean
  middleName: string; onMiddleNameChange: (v: string) => void
  lastName: string; onLastNameChange: (v: string) => void; lastNameError?: boolean
  role: string; onRoleChange: (v: string) => void
  // useContactFunctions() returns a plain string list (tenant function names),
  // not a {value,label} lookup — matches the original inline CreatableSelect usage.
  contactFunctions: string[]
  allowFreeEntry: boolean
  gender: string; onGenderChange: (v: string) => void
  genders: OptionRow[]
}

export default function ContactIdentityCard({
  firstName, onFirstNameChange, firstNameError, middleName, onMiddleNameChange, lastName, onLastNameChange, lastNameError,
  role, onRoleChange, contactFunctions, allowFreeEntry, gender, onGenderChange, genders,
}: ContactIdentityCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.person')}</div>
      <div style={cardBox}>
        <div style={row3Even}>
          <FieldRow label={t('subModal.firstName')} required>
            <TextField value={firstName} onChange={onFirstNameChange} error={firstNameError} />
          </FieldRow>
          {/* CONTACT-TUSSENVOEGSEL-1: without this the backend stores "Jan Vries"
              for "Jan de Vries" — and an edit of an existing contact wiped it. */}
          <FieldRow label={t('subModal.middleName')}>
            <TextField value={middleName} onChange={onMiddleNameChange} placeholder={t('common:placeholders.middleName')} />
          </FieldRow>
          <FieldRow label={t('subModal.lastName')} required>
            <TextField value={lastName} onChange={onLastNameChange} error={lastNameError} />
          </FieldRow>
        </div>
        {(firstNameError || lastNameError) && <div style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{t('subModal.required')}</div>}
        {/* Function is a searchable/creatable tenant lookup (contact-function
            vocabulary, honours the tenant's free-entry setting). It sits in the same
            two-column grid as the names so it lines up under Voornaam instead of
            stretching the full 1060px — a lone full-width picker read as a banner
            (Danny 27-07: "functie is lelijk groot zo"). */}
        <div style={row2}>
          <FieldRow label={t('subModal.role')}>
            {/* CLEAR-SWEEP (Danny 13-08): role is optional (useCustomerContacts.toApi
                sends `function` as-is, empty string included, which the nullable
                column accepts) — so clearable, independent of the create/strict toggle. */}
            <CreatableSelect value={role} onChange={onRoleChange} options={contactFunctions}
              allowCreate={allowFreeEntry} clearable clearLabel={t('subModal.role')}
              placeholder={t('common:select')} style={CREATABLE_STYLE} />
          </FieldRow>
          {/* Geslacht: options come from the tenant /genders lookup and the field
              stores the VALUE SLUG the backend validates with exists:candidate_genders,value.
              CLEAR-SWEEP: optional — useCustomerContacts.toApi coerces '' to null. */}
          <FieldRow label={t('subModal.gender')}>
            <CreatableSelect value={gender || null} onChange={onGenderChange} allowCreate={false}
              clearable clearLabel={t('subModal.gender')}
              placeholder={t('subModal.noneOption')} style={CREATABLE_STYLE} options={genders} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}
