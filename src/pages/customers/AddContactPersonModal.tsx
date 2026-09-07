/**
 * AddContactPersonModal — create (or edit, via `initial`) a contact person. Full
 * field set CustomerContactController::validateContact accepts: first/last name,
 * email, phone, function, ONE location + ONE department coupling (CONTACT-MULTI-1 —
 * the backend has no multi-value yet), status, primary toggle. One component serves
 * the top-level Contactpersonen tab AND the location detail's nested list —
 * `lockLocationId` pre-fills + hides the location field when adding "at this location".
 * `lockDepartmentId` is the symmetric counterpart for a department's own nested list —
 * pre-fills + hides the department field when adding "in this department".
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
 *
 * STATUS-HIDDEN-1 (Danny 02-08, second round: "+ nieuwe contactpersoon ... status
 * moet weg in de popup"): the status picker (inside ContactLinkCard) is hidden by
 * default — ContactsPanel's own status editor already covers create AND edit —
 * reappearing only when the tenant marked status_id required
 * (customer_contact_required_fields, FlatRequiredFieldsGuard catalog), mirrors
 * AddLocationModal/AddDepartmentModal's own gate.
 *
 * CARD SPLIT (§0.3 — the ~400-line split trigger, 2026-08-03): every card's JSX
 * moved to its own component in `addmodal/` (ContactIdentityCard,
 * ContactDetailsCard) or `./` (ContactLinkCard, already extracted) — pure
 * extraction, zero behaviour change.
 *
 * FORM-HOOK SPLIT (SIZE-SPLIT-B, 2026-09): all cross-card orchestration (form/error
 * state, the primary-replace confirm, the client-side duplicate check, the
 * location→department cascade, and the submit chain + 422 field-error mapping)
 * moved into useAddContactPersonForm — this container now only wires the hook to
 * the cards, staying a thin container per §3A.
 *
 * SHARED-FRAME-1 (DRY-SUBENTITY-1): the FloatingPanel header/footer/import-card
 * chrome moved to the shared SubEntityModalFrame — mirrors AddDepartmentModal.
 * useAddContactPersonForm itself now sources its basic state (isEdit/importWizard/
 * importOpen/errors/createError) from useSubEntitySave.
 */
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Users } from 'lucide-react'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { useGenders } from '@/lib/useGenders'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { modalColumns } from '@/components/ui/modalCards'
import SubEntityImportCard from './SubEntityImportCard'
import SubEntityModalFrame from './addmodal/SubEntityModalFrame'
import ContactIdentityCard from './addmodal/ContactIdentityCard'
import ContactDetailsCard from './addmodal/ContactDetailsCard'
import ContactLinkCard from './ContactLinkCard'
import { useAddContactPersonForm } from './useAddContactPersonForm'
import type { ContactPayload } from './hooks/useCustomerContacts'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import { tintBorder } from '@/lib/tint'
import { useMessagingLanguageOptions } from '@/lib/useMessagingLanguageOptions'

interface OptionRow { id: Id; name: string }

// Create/edit a contact person: wires useAddContactPersonForm (cross-card
// orchestration) to the presentational cards.
export default function AddContactPersonModal({
  onClose, onCreate, onImported, customerName, locations = [], departments = [], statuses = [], initial, lockLocationId, lockDepartmentId, existing = [],
}: {
  onClose: () => void
  onCreate?: (v: ContactPayload) => void
  /** Called once a real CSV import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
  customerName?: string
  locations?: OptionRow[]
  departments?: Department[]
  statuses?: LookupOption[]
  initial?: Contact | null
  lockLocationId?: Id
  // Symmetric counterpart of lockLocationId — used when adding "in this
  // department" from a department's own nested contact list.
  lockDepartmentId?: Id
  // The customer's OTHER already-loaded contacts — drives the primary-replace
  // confirmation and the email/phone/mobile duplicate check below.
  existing?: Contact[]
}) {
  const { t } = useTranslation(['customers', 'common'])
  const authCtx = useAuth() as unknown as { hasPermission?: (permName: string) => boolean } | null
  // SUBENTITY-IMPORT-1: falls back to "no permission" rather than crashing when the
  // context is mid-boot OR genuinely absent (this modal is also mounted from screens
  // with no AuthProvider ancestor in tests) — mirrors AddCustomerModal's own fallback.
  const hasPermission = authCtx?.hasPermission ?? (() => false)
  const canViewImportTemplate = hasPermission('customers.view')
  const canRunImport = hasPermission('customers.create')
  // Contact function (job title) is a lookup combobox, split from the candidate
  // function list (FUNCTIONS-SPLIT-1) — never a plain free-text field.
  const { contactFunctions, allowFreeEntry } = useContactFunctions()
  // CONTACT-GESLACHT-1: the SAME tenant /genders lookup a candidate uses — the field
  // stores the value SLUG (male|female|other), never a hardcoded three-option list.
  const { genders } = useGenders()
  // STATUS-HIDDEN-1: hidden unless the tenant marked it required — mirrors
  // AddLocationModal/AddDepartmentModal's own gate, same flat-array setting shape.
  const settings = useAllSettings()
  const showStatusPicker = getJsonSetting<string[]>(settings, 'customer_contact_required_fields', []).includes('status_id')

  // All cross-card orchestration (form/error state, primary-replace confirm,
  // duplicate check, location→department cascade, submit + 422 mapping).
  const {
    isEdit, importWizard, importOpen, setImportOpen, form, set, errors, createError, dialog,
    markTouched, emailDup, phoneDup, mobileDup, submit, canSubmit,
    departmentOptions, departmentPlaceholder, showLocationPicker, showDepartmentPicker,
    emailMessage, phoneMessage, mobileMessage, handlePrimaryToggle,
  } = useAddContactPersonForm({ onCreate, onClose, onImported, departments, statuses, initial, lockLocationId, lockDepartmentId, existing, t })

  // Contact-function/gender option rows for ContactIdentityCard.
  const genderOptions = genders.map(g => ({ value: g.value, label: g.label }))
  // AVG-RET-2-TAAL-1: shared messaging-language picker options.
  const { options: languageOptions } = useMessagingLanguageOptions()

  // Render the error alert banner if present.
  const alertElement = createError && (
    <div role="alert" style={{ margin: '0 22px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
      color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
      border: tintBorder('var(--color-danger)', true), flexShrink: 0 }}>
      {createError}
    </div>
  )

  // Render the import card component if the wizard is active.
  const importCardElement = (
    <SubEntityImportCard entity="contacts" wizard={importWizard} customerName={customerName}
      canView={canViewImportTemplate} canImport={canRunImport} />
  )

  return (
    <SubEntityModalFrame
      open
      onClose={onClose}
      ariaLabel={isEdit ? t('subModal.editContact') : t('subModal.addContact')}
      persistKey="customer-add-contact"
      isEdit={isEdit}
      title={isEdit ? t('subModal.editContact') : t('subModal.addContact')}
      subtitle={customerName}
      icon={Users}
      iconColor="var(--color-primary)"
      iconBg="var(--color-primary-bg)"
      importOpen={importOpen}
      setImportOpen={setImportOpen}
      importButtonTitle={t('subModal.import.title', { entity: t('settings:import.entities.contacts.label') })}
      importCardTitle={t('subModal.import.title', { entity: t('settings:import.entities.contacts.label') })}
      alert={alertElement}
      importCard={importCardElement}
      onCancel={onClose}
      onSubmit={submit}
      cancelLabel={t('subModal.cancel')}
      submitLabel={isEdit ? t('subModal.save') : t('subModal.create')}
      submitDisabled={!canSubmit}
    >
      {/* HET-RECEPT (Danny 14-08): two responsive columns, same idiom as
          AddCustomerModal/AddLocationModal — LEFT keeps the identity fields
          the recruiter always fills (Persoon/Contact), RIGHT holds the
          relational coupling (Koppeling); falls back to one column below
          340px per column. */}
      <div style={modalColumns('repeat(auto-fit, minmax(340px, 1fr))')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Persoon — name + function (Danny 27-07 card split: name/lastname/functie). */}
          <ContactIdentityCard
            firstName={form.firstName} onFirstNameChange={v => set('firstName', v)} firstNameError={errors.firstName}
            middleName={form.middleName} onMiddleNameChange={v => set('middleName', v)}
            lastName={form.lastName} onLastNameChange={v => set('lastName', v)} lastNameError={errors.lastName}
            role={form.role} onRoleChange={v => set('role', v)} contactFunctions={contactFunctions} allowFreeEntry={allowFreeEntry}
            gender={form.gender} onGenderChange={v => set('gender', v)} genders={genderOptions}
            preferredLanguage={form.preferredLanguage ?? ''} onPreferredLanguageChange={v => set('preferredLanguage', v)} languageOptions={languageOptions}
          />

          {/* Contact — e-mail/telefoon/mobiel (Danny 27-07: exact card the request named)
              + LinkedIn (CONTACT-LINKEDIN-1, 05-08). */}
          <ContactDetailsCard
            cardLabel={t('subModal.groups.contactInfo')}
            emailLabel={t('subModal.email')} phoneLabel={t('subModal.phone')} mobileLabel={t('subModal.mobile')}
            email={form.email} onEmailChange={v => set('email', v)} onEmailBlur={() => markTouched('email')}
            emailError={!!emailDup || errors.email || !!emailMessage} emailMessage={emailMessage}
            phone={form.phone} onPhoneChange={v => set('phone', v)} phoneError={!!phoneDup || errors.phone} phoneMessage={phoneMessage}
            mobile={form.mobile} onMobileChange={v => set('mobile', v)} mobileError={!!mobileDup || errors.mobile} mobileMessage={mobileMessage}
            linkedinLabel={t('subModal.linkedin')} linkedinPlaceholder={t('subModal.linkedinPlaceholder')}
            linkedin={form.linkedin} onLinkedinChange={v => set('linkedin', v)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Koppeling — locatie/afdeling (searchable, allowCreate=false: real relational
              ids) + status/primair-vlag for that link. Extracted into its own component
              (ContactLinkCard) to keep this file under the ~400-line split trigger. */}
          <ContactLinkCard
            locationId={form.locationId ? String(form.locationId) : null}
            departmentId={form.departmentId ? String(form.departmentId) : null}
            statusId={form.statusId ? String(form.statusId) : null}
            isPrimary={form.isPrimary}
            locationOptions={locations.map(l => ({ value: String(l.id), label: l.name }))}
            departmentOptions={departmentOptions}
            departmentPlaceholder={departmentPlaceholder}
            statusOptions={statuses}
            showLocationPicker={showLocationPicker}
            showDepartmentPicker={showDepartmentPicker}
            showStatusPicker={showStatusPicker}
            onLocationChange={v => { set('locationId', v || null); set('departmentId', null) }}
            onDepartmentChange={v => set('departmentId', v || null)}
            onStatusChange={v => set('statusId', v || null)}
            onPrimaryToggle={handlePrimaryToggle}
          />
        </div>
      </div>

      {/* useConfirm's staged dialog — a fixed-position overlay (FloatingPanel), so its
          position in this tree doesn't affect where it renders on screen. */}
      {dialog}
    </SubEntityModalFrame>
  )
}
