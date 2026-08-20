/**
 * ContactOnSiteCard — the "Contact ter plaatse" card of AddLocationModal.
 * Extracted (§0.3 — the >400-line split trigger, 2026-08-03) once today's
 * CONTACT-PRIMAIR-LOCATIE-2 work pushed the parent modal to 458 lines. Pure
 * presentational, mirrors the house `form`+`set` card pattern
 * (candidates/addmodal/AddressCard.tsx): every value and callback comes from
 * the parent's own form state, no local state of its own besides derived
 * display options.
 *
 * Moved from the sibling `locationmodal/` folder into `addmodal/` (housekeeping,
 * 2026-08-03): the two-sub-folder split (customers/addmodal/ + customers/
 * locationmodal/) for what is really ONE modal-card family was an inconsistency —
 * every customers create-modal card now lives in this one folder. No behaviour
 * change, import path only.
 *
 * The SUBMIT CHAIN (location → contact → coupling, `splitContactName`) stays in
 * AddLocationModal — it orchestrates across this card AND the just-created
 * location/contact records, so it is container logic (§3: containers wire,
 * presentational components render), not something this card could own.
 *
 * CONTACT-PRIMAIR-LOCATIE-1/2 (Danny: "je typt Joost de Boer in en Joost weet er
 * niets van"): CREATE offers a real choice — pick one of this customer's
 * existing contacts, OR type a brand-new name — both end in a real coupling
 * once the location exists (see AddLocationModal's submit()). EDIT keeps the
 * plain text field — the real per-site primary contact is already properly
 * editable from LocationDetail's own SectionCard, so duplicating that mechanism
 * here would be a second, conflicting UI for the same fact.
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'
import { contactOptionLabel } from '@/lib/contactLabel'
import { Caption } from '@/components/ui/typography'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'
import FieldNotice from '@/components/ui/FieldNotice'

// VALIDATIE-LIVE-1-rest: the live-format message under email — one shared
// renderer now (components/ui/FieldNotice), not a fourth local copy.

// FIELD-HEIGHT-1: same literal as the parent modal's own `pickerStyle` (kept
// local since this is the only file in this folder that needs it) — a picker
// sitting next to a plain text input must match TextField's own height exactly.
const pickerStyle = { padding: '8px 11px', borderRadius: 8, fontSize: 13 } as const

interface ContactOnSiteCardProps {
  // Editing an existing location keeps the plain text field (see file header).
  isEdit: boolean
  contactName: string
  email: string
  phone: string
  onContactNameChange: (v: string) => void
  onEmailChange: (v: string) => void
  // VALIDATIE-LIVE-1-rest: blur marks email touched so its live format error
  // can render (mirrors candidates/addmodal/ContactCard's own onBlur wrapper).
  onEmailBlur?: () => void
  emailError?: boolean
  emailMessage?: string
  onPhoneChange: (v: string) => void
  // Which existing contact (if any) was picked — null when nothing was picked
  // yet, or a brand-new name was typed that matches no existing contact. Owned
  // by the parent (needed for the post-create coupling call in submit()).
  pickedContactId: Id | null
  onPickedContactChange: (id: Id | null) => void
  /** This customer's already-loaded contacts — feeds the picker's option list. */
  existingContacts: Contact[]
}

export default function ContactOnSiteCard({
  isEdit, contactName, email, phone, onContactNameChange, onEmailChange, onEmailBlur, emailError, emailMessage, onPhoneChange,
  pickedContactId, onPickedContactChange, existingContacts,
}: ContactOnSiteCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  // CONTACT-LABEL-1 (Danny 02-08): "naam — functie" via the one shared label
  // builder (mirrors RelationsSection/AddOpportunityModal/KlantTab/useCascadePickers)
  // — never a bare name, so two "Joost"s at the same customer read apart in the list.
  const contactOptions = existingContacts.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))

  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.contact')}</div>
      <div style={cardBox}>
        {/* CONTACT-PRIMAIR-LOCATIE-1/2: CREATE offers a real choice — pick one of
            this customer's existing contacts, OR type a brand-new name — both now
            end in a real coupling, made primary-for-this-site once the location
            exists (handled by the parent's submit()): picking an existing one
            couples it directly; typing a new one creates the missing contact
            record first, then couples it. EDIT keeps the plain text field — the
            real per-site primary contact is already properly editable from
            LocationDetail's own SectionCard, so duplicating that mechanism here
            would be a second, conflicting UI for the same fact. `email`/`phone`
            stay untouched free-text columns on the LOCATION in both modes (see
            AddLocationModal's own report for why they stay) — they also ride
            along into the new contact record on the typed-new path. */}
        {isEdit ? (
          <FieldRow label={t('subModal.contactName')}><TextField value={contactName} onChange={onContactNameChange} /></FieldRow>
        ) : (
          <div>
            <FieldRow label={t('subModal.contactName')}>
              {/* Controlled on the ID when a real contact is picked (so the trigger's
                  OWN label lookup resolves the name, and reopening the list still
                  shows the checkmark on it) — falls back to the raw typed text once
                  pickedContactId is null (a brand-new name, no option to match). */}
              <CreatableSelect value={pickedContactId ? String(pickedContactId) : (contactName || null)}
                onChange={v => {
                  const existingMatch = existingContacts.find(c => String(c.id) === v)
                  onPickedContactChange(existingMatch ? (existingMatch.id as Id) : null)
                  onContactNameChange(existingMatch ? existingMatch.name : v)
                }}
                placeholder={t('subModal.contactName')} options={contactOptions} menuWidth={280} style={pickerStyle} />
            </FieldRow>
            <Caption as="div" style={{ marginTop: 3 }}>{t('subModal.contactPersonHint')}</Caption>
          </div>
        )}
        <div style={row2}>
          <div onBlur={onEmailBlur}>
            <FieldRow label={t('subModal.email')}><TextField type="email" value={email} onChange={onEmailChange} placeholder={t('common:placeholders.emailExample')} error={emailError} /></FieldRow>
            <FieldNotice text={emailMessage} />
          </div>
          <FieldRow label={t('subModal.phone')}><TextField value={phone} onChange={onPhoneChange} /></FieldRow>
        </div>
      </div>
    </div>
  )
}
