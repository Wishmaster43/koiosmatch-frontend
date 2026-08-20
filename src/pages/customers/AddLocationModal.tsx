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
 *
 * CONTACT-PRIMAIR-LOCATIE-2: the "contact ter plaatse" picker's two paths now BOTH
 * end in a real coupling. Picking an existing contact was already wired
 * (CONTACT-PRIMAIR-LOCATIE-1); typing a brand-new name used to only write the
 * location's own free-text column, leaving it "not linked" forever — submit() now
 * also creates the missing CONTACT record (via `onAddContact`) before coupling it,
 * see submit() for the sequencing/failure handling.
 *
 * CARD SPLIT (§0.3 — the ~400-line split trigger, 2026-08-03): every card's JSX
 * moved to its own component in `addmodal/` (LocationGeneralCard,
 * LocationAddressCard, LocationBusinessCard, ContactOnSiteCard,
 * LocationDescriptionCard) — pure extraction, zero behaviour change. This
 * container keeps everything that orchestrates ACROSS cards: all form/error
 * state, `pickedContactId` ownership, the province cascade, the
 * location → contact → coupling submit chain + 422 field-error mapping.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { MapPin, Upload, CheckCircle2 } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { useProvinces } from '@/hooks/useProvinces'
import { notifyError } from '@/lib/notify'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { useIdentifierValidation } from '@/hooks/useIdentifierValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { modalColumns, cardBox, cardHead } from '@/components/ui/modalCards'
import SubEntityImportCard from './SubEntityImportCard'
import LocationGeneralCard from './addmodal/LocationGeneralCard'
import LocationAddressCard from './addmodal/LocationAddressCard'
import LocationBusinessCard from './addmodal/LocationBusinessCard'
import ContactOnSiteCard from './addmodal/ContactOnSiteCard'
import LocationDescriptionCard from './addmodal/LocationDescriptionCard'
import { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'
import { setLocationPrimaryContact, splitContactName } from './hooks/useCustomerContacts'
import type { LocationPayload } from './hooks/useCustomerLocations'
import type { ContactPayload } from './hooks/useCustomerContacts'
import type { Location, Contact } from '@/types/customer'
import type { LookupOption, Id } from '@/types/common'
import Button from '@/components/ui/Button'
import ModalFooter from '@/components/ui/ModalFooter'
import { tintBorder } from '@/lib/tint'

// 422 field-error keys are snake_case; map them back to this form's field names.
// No billing_email entry (Danny 2026-07-22): that field has no input here anymore
// (facturatie always comes from the customer), so there is nothing to blame it on.
const API_TO_FORM: Record<string, string> = {
  name: 'name', street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix',
  postcode: 'postalCode', city: 'city', state: 'state', country: 'country',
  coc_number: 'cocNumber', vat_number: 'vatNumber', contact_name: 'contactName',
  phone: 'phone', email: 'email',
  cost_center: 'costCenter', status_id: 'statusId',
  // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): mirrors the department's own description field.
  description: 'description',
}

// VALIDATIE-LIVE-1-rest: `email` is the only "contact ter plaatse" field the
// backend validates with a shape rule (CustomerLocationController::rules
// `email` => Laravel's `email` rule) — `phone` stays a plain string
// server-side, so no live format gate is added for it here (see
// src/lib/contactFieldValidation.ts for the full backend-verification note).
const EMAIL_VALIDATORS = { email: isValidEmailFormat }
const EMAIL_ERROR_KEYS = { email: 'validation.emailFormat' }

export default function AddLocationModal({
  onClose, onCreate, onImported, onAddContact, customerId, customerName, statuses = [], initial, existingContacts = [],
}: {
  onClose: () => void
  onCreate?: (v: LocationPayload) => Promise<Location | void> | void
  /** Called once a real CSV import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
  // CONTACT-PRIMAIR-LOCATIE-1: needed to call the primary-contact coupling route
  // AFTER the location exists (see submit() below) — the pivot hangs on a real location id.
  customerId?: Id
  customerName?: string
  statuses?: LookupOption[]
  // Editing an existing location pre-fills the form and flips the copy/action to "save".
  initial?: Location | null
  /** This customer's already-loaded contacts — feeds the "contact ter plaatse" picker. */
  existingContacts?: Contact[]
  // CONTACT-PRIMAIR-LOCATIE-2: creates a REAL contact record for a typed brand-new
  // name (as opposed to picking one of `existingContacts`) — the real
  // `useCustomerContacts().add`, threaded down from CustomerDrawer, resolves with
  // the saved row so its id can be coupled as this location's primary below.
  onAddContact?: (payload: ContactPayload) => Promise<Contact | void> | void
}) {
  const { t } = useTranslation(['customers', 'common'])
  const authCtx = useAuth() as unknown as { hasPermission?: (permName: string) => boolean } | null
  // SUBENTITY-IMPORT-1: falls back to "no permission" rather than crashing when the
  // context is mid-boot OR genuinely absent (this modal is also mounted from screens
  // with no AuthProvider ancestor in tests) — mirrors AddCustomerModal's own fallback.
  const hasPermission = authCtx?.hasPermission ?? (() => false)
  const canViewImportTemplate = hasPermission('customers.view')
  const canRunImport = hasPermission('customers.create')
  // The wizard state lives HERE (container), not in the card — mirrors AddCustomerModal.
  const importWizard = useImportWizard('locations')
  // K1b (2026-08-14): the import affordance sits in the header (Upload button),
  // never buried in a collapsed section — mirrors AddCustomerModal exactly.
  const [importOpen, setImportOpen] = useState(false)
  const isEdit = Boolean(initial)
  // CONTACT-PRIMAIR-LOCATIE-1: which existing contact (if any) was picked as "contact
  // ter plaatse" — distinct from the free-text name, since only a REAL id can be
  // coupled after the location is created (see submit()). Null = either nothing
  // picked yet, or the user typed a brand-new name that matches no existing contact.
  // CREATE ONLY (see the picker render below): editing already has the real thing —
  // LocationDetail's own primary-contact SectionCard — so this state stays unused there.
  const [pickedContactId, setPickedContactId] = useState<Id | null>(null)
  const [form, setForm] = useState<LocationPayload>({
    // LOCATIE-VESTIGING-1: a site starts with NO deviation, so it inherits the customer's
    // branches. Editing keeps whatever deviation it already had — the Vestiging block in
    // the drill-down is where that is changed, never here.
    branchIds: initial?.branchIds ?? [],
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
    costCenter: initial?.costCenter ?? '',
    // No billingEmail INPUT anymore (Danny 2026-07-22: facturatie always comes from
    // the customer, see OverviewTab) — kept here only as an untouched passthrough so
    // an edit-save round trip never clears whatever the record already had stored.
    billingEmail: initial?.billingEmail ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): free company text about this site,
    // same shape/limit as the department's own (max 5000, CustomerLocationController::rules).
    description: initial?.description ?? '',
    customFields: initial?.customFields ?? {},
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  // COLLAPSIBLE-TEXT-1: Omschrijving's collapsed/editing state now lives inside
  // LocationDescriptionCard (nothing outside that card ever reads it).
  // STATUS-HIDDEN-1 (Danny 02-08, second round: "+ nieuwe locatie ... status moet
  // weg in de popup"): the picker is hidden by default — LocationDetail's own
  // title-row status editor already covers create AND edit — and only reappears
  // when the tenant marked status_id required (FlatRequiredFieldsGuard catalog),
  // so a tenant that requires it never hits an un-actionable 422 with no visible
  // cause. Same flat-array setting shape the Settings screen already writes.
  const settings = useAllSettings()
  const showStatusPicker = getJsonSetting<string[]>(settings, 'customer_location_required_fields', []).includes('status_id')
  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for the "contact
  // ter plaatse" e-mail — own sibling hook, same idiom as AddCandidateModal.
  const { markTouched, fieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)
  // KVK/BTW-PER-LAND-1 (Danny 08-08, points 10 + 11): the KvK/BTW format follows the
  // country picked in THIS form (live — switching country re-checks both), and only a
  // tenant on 'block' mode is actually stopped from submitting.
  const identifiers = useIdentifierValidation()
  const cocNotice = identifiers.notice('coc', form.cocNumber, form.country)
  const vatNotice = identifiers.notice('vat', form.vatNumber, form.country)
  const hasIdentifierError = cocNotice?.severity === 'error' || vatNotice?.severity === 'error'

  const set = <K extends keyof LocationPayload>(k: K, v: LocationPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  // PROVINCIE-1: province list cascades on the picked country (shared hook, same
  // cascade-clear behaviour as AddCustomerModal's own AddressCard) — a province from
  // the PREVIOUS country must never survive a country switch.
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.state && !provinces.includes(form.state)) setForm(f => ({ ...f, state: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  // SUBENTITY-IMPORT-1: a real run that landed at least one row means the location(s)
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

  const submit = async () => {
    // VALIDATIE-LIVE-1-rest: block on a live format failure too — marks any
    // untouched-but-malformed field touched so its message renders.
    const invalidKeys = touchInvalidFields()
    if (!form.name.trim() || invalidKeys.length) { setErrors({ name: !form.name.trim() }); return }
    // KVK/BTW-PER-LAND-1: only a BLOCKING (tenant setting = 'block') identifier
    // mismatch stops the submit — a warning is shown but never refuses the save.
    if (hasIdentifierError) return
    const payload = { ...form, name: form.name.trim() }
    // Edit path: update() keeps its existing toast-based error handling — unchanged,
    // closes immediately. The contact picker above only renders on CREATE (see the
    // render below), so there is no coupling to attempt here.
    if (isEdit) { onCreate?.(payload); onClose(); return }
    // Create path: add() rethrows on failure (C-18) so 422 field errors land under
    // their fields here instead of a generic toast while the modal closed regardless.
    try {
      const created = await onCreate?.(payload)
      // CONTACT-PRIMAIR-LOCATIE-1: the pivot needs a REAL location id, which only
      // exists once the create above has actually landed — so the coupling is a
      // deliberate SECOND call, never bundled into the location POST (the backend
      // has no field for it, see this file's report). A location that was created
      // successfully must close the modal either way; a coupling failure is
      // reported honestly (toast) instead of silently pretending it worked or
      // rolling back a location that may already hold other data.
      if (pickedContactId && customerId && created?.id) {
        try {
          const applied = await setLocationPrimaryContact(customerId, pickedContactId, created.id)
          if (!applied) notifyError(t('locations.detail.setPrimaryContactUnavailable'))
        } catch {
          notifyError(t('subModal.contactCouplingFailed', { name: created.name }))
        }
      } else if (!pickedContactId && customerId && created?.id && form.contactName.trim()) {
        // CONTACT-PRIMAIR-LOCATIE-2: a typed name that matched no existing contact
        // used to stay dead free text forever (LocationContactSection's "not linked"
        // warning). Close that gap — create the missing contact record first, THEN
        // couple it as this location's primary the same way the pick-existing branch
        // above does. Each step is independent: a location that was created stays
        // created regardless of what follows, and a contact that WAS created stays
        // created even if the coupling PUT then fails — no rollback theatre, one
        // honest toast per failure. `email`/`phone` ride along from the same "Contact
        // ter plaatse" card so the new record is not a bare name-only shell; the free-
        // text columns on the location itself are untouched (still written above).
        try {
          const newContact = await onAddContact?.({
            ...splitContactName(form.contactName), middleName: '', email: form.email, phone: form.phone, mobile: '',
            // CONTACT-LINKEDIN-1: no LinkedIn field on this quick-create path.
            linkedin: '',
            gender: '', role: '', locationId: null, departmentId: null, locationIds: [], departmentIds: [],
            statusId: null, isPrimary: false, customFields: {},
          })
          if (newContact?.id) {
            try {
              const applied = await setLocationPrimaryContact(customerId, newContact.id, created.id)
              if (!applied) notifyError(t('locations.detail.setPrimaryContactUnavailable'))
            } catch {
              notifyError(t('subModal.contactCouplingFailed', { name: created.name }))
            }
          }
        } catch {
          notifyError(t('subModal.contactCreateFailed', { name: created.name }))
        }
      }
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
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel — same focus-trap/backdrop/Esc semantics.
    <FloatingPanel open onClose={onClose}
      ariaLabel={isEdit ? t('subModal.editLocation') : t('subModal.addLocation')}
      persistKey="customer-add-location" scrollBody={false}
      width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`} maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={15} color="var(--color-secondary)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('subModal.editLocation') : t('subModal.addLocation')}</div>
            {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
          </div>
          {/* K1b (2026-08-14): the import affordance lives top-right in the header, a
              real button, never buried in a collapsed section — mirrors AddCustomerModal. */}
          {/* HUISSTIJL-1: the header import toggle reads the solid house trio; the
              §4-IMPORT "a paused import stays visible" cue survives as the ink
              RING once a file is picked — the same active-signal convention the
              sort/filter triggers use on the solid fill. */}
          {!isEdit && (
            <Button type="button" variant="primary" onClick={() => setImportOpen(v => !v)} aria-expanded={importOpen}
              style={{ gap: 6, marginLeft: 'auto' }}>
              {/* Icon swap = the paused-import signal (AddCustomerModal canon): never a second identity paint on the chrome. */}
              {importWizard.file ? <CheckCircle2 size={13} /> : <Upload size={13} />}
              {t('subModal.import.title', { entity: t('settings:import.entities.locations.label') })}
            </Button>
          )}
        </div>
      }>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* K1b (2026-08-14): the import flow opens from the header button and renders
              as the first card while open — summoned deliberately, mirrors AddCustomerModal. */}
          {importOpen && !isEdit && (
            <div style={{ ...cardBox, padding: 16 }}>
              <div style={cardHead}>{t('subModal.import.title', { entity: t('settings:import.entities.locations.label') })}</div>
              <SubEntityImportCard entity="locations" wizard={importWizard} customerName={customerName}
                canView={canViewImportTemplate} canImport={canRunImport} />
            </div>
          )}
          {/* Two-column section split (Danny 03-08 A+D decision): six cards stacked
              in ONE column left half the wide 1060px frame idle and forced a
              scroll — the required core (Algemeen/Adres) now sits left, the
              secondary cards (Zakelijk/Contact ter plaatse/Omschrijving) right;
              falls back to one column at narrow widths via the auto-fit idiom. */}
          <div style={modalColumns('repeat(auto-fit, minmax(340px, 1fr))')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <LocationGeneralCard
                name={form.name} onNameChange={v => set('name', v)} nameError={errors.name}
                showStatusPicker={showStatusPicker} statusId={form.statusId ? String(form.statusId) : null}
                onStatusChange={v => set('statusId', v || null)} statusOptions={statusOptions}
              />
              <LocationAddressCard
                street={form.street} onStreetChange={v => set('street', v)}
                houseNumber={form.houseNumber} onHouseNumberChange={v => set('houseNumber', v)}
                houseNumberSuffix={form.houseNumberSuffix} onHouseNumberSuffixChange={v => set('houseNumberSuffix', v)}
                postalCode={form.postalCode} onPostalCodeChange={v => set('postalCode', v)}
                city={form.city} onCityChange={v => set('city', v)}
                state={form.state} onStateChange={v => set('state', v)}
                country={form.country} onCountryChange={v => set('country', v)}
                provinces={provinces}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <LocationBusinessCard
                cocNumber={form.cocNumber} onCocNumberChange={v => set('cocNumber', v)}
                vatNumber={form.vatNumber} onVatNumberChange={v => set('vatNumber', v)}
                costCenter={form.costCenter} onCostCenterChange={v => set('costCenter', v)}
                cocNotice={cocNotice} vatNotice={vatNotice}
              />

              {/* Contact ter plaatse — extracted card (§0.3 split, 2026-08-03): the
                  existing-contact picker, new-contact fields and their local render
                  logic live in ContactOnSiteCard; only pickedContactId's OWNERSHIP
                  stays here (the post-create coupling call in submit() needs it). */}
              <ContactOnSiteCard
                isEdit={isEdit}
                contactName={form.contactName} email={form.email} phone={form.phone}
                onContactNameChange={v => set('contactName', v)}
                onEmailChange={v => set('email', v)} onEmailBlur={() => markTouched('email')}
                emailError={!!fieldMessage('email')} emailMessage={fieldMessage('email')}
                onPhoneChange={v => set('phone', v)}
                pickedContactId={pickedContactId} onPickedContactChange={setPickedContactId}
                existingContacts={existingContacts}
              />

              <LocationDescriptionCard value={form.description} onChange={v => set('description', v)} />
            </div>
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: tintBorder('var(--color-danger)', true), flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* KVK/BTW-PER-LAND-1: a blocking identifier mismatch gates the button too,
            so the disabled state and submit() agree on one condition. */}
        <ModalFooter onCancel={onClose} cancelLabel={t('subModal.cancel')}
          onSubmit={submit} submitLabel={isEdit ? t('subModal.save') : t('subModal.create')}
          disabled={!form.name.trim() || hasFormatError || hasIdentifierError} />
    </FloatingPanel>
  )
}
