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
import { useState, useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { X, MapPin } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { useProvinces } from '@/hooks/useProvinces'
import { notifyError } from '@/lib/notify'
import { contactOptionLabel } from '@/lib/contactLabel'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox, row2, row3Even, row } from '@/components/ui/modalCards'
import SubEntityImportCard from './SubEntityImportCard'
import { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'
import { setLocationPrimaryContact } from './hooks/useCustomerContacts'
import type { LocationPayload } from './hooks/useCustomerLocations'
import type { Location, Contact } from '@/types/customer'
import type { LookupOption, Id } from '@/types/common'

// FIELD-HEIGHT-1 (Danny 02-08: "provincie niet dezelfde hoogte als de rest van de
// velden"): CreatableSelect's own default trigger (padding '6px 10px', fontSize 12)
// is shorter than TextField's inputStyle (padding '8px 11px', fontSize 13), so any
// picker sitting next to a plain text input visibly steps. Same literal values
// already adopted for this exact reason in candidates/addmodal/fields.tsx's own
// CreatableSelect wrapper — reused here rather than a fresh magic number (§4).
const pickerStyle = { padding: '8px 11px', borderRadius: 8, fontSize: 13 } as const

// Weighted rows for the address block (mirrors the candidate AddressCard's own
// street/postcode ratios — the same real-world field, same proportions) — a
// one-off column split only this card needs, built from the shared `row()`.
const rowStreet = row('2fr 1fr 1fr')
const rowPostal = row('1fr 2fr')

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

export default function AddLocationModal({
  onClose, onCreate, onImported, customerId, customerName, statuses = [], initial, existingContacts = [],
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
}) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const authCtx = useAuth() as unknown as { hasPermission?: (permName: string) => boolean } | null
  // SUBENTITY-IMPORT-1: falls back to "no permission" rather than crashing when the
  // context is mid-boot OR genuinely absent (this modal is also mounted from screens
  // with no AuthProvider ancestor in tests) — mirrors AddCustomerModal's own fallback.
  const hasPermission = authCtx?.hasPermission ?? (() => false)
  const canViewImportTemplate = hasPermission('customers.view')
  const canRunImport = hasPermission('customers.create')
  // The wizard state lives HERE (container), not in the card — mirrors AddCustomerModal.
  const importWizard = useImportWizard('locations')
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
  // COLLAPSIBLE-TEXT-1: Omschrijving's own collapsed/editing state.
  const [descExpanded, setDescExpanded] = useState(false)
  const [descEditing, setDescEditing] = useState(false)
  // STATUS-HIDDEN-1 (Danny 02-08, second round: "+ nieuwe locatie ... status moet
  // weg in de popup"): the picker is hidden by default — LocationDetail's own
  // title-row status editor already covers create AND edit — and only reappears
  // when the tenant marked status_id required (FlatRequiredFieldsGuard catalog),
  // so a tenant that requires it never hits an un-actionable 422 with no visible
  // cause. Same flat-array setting shape the Settings screen already writes.
  const settings = useAllSettings()
  const showStatusPicker = getJsonSetting<string[]>(settings, 'customer_location_required_fields', []).includes('status_id')
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
    if (!form.name.trim()) { setErrors({ name: true }); return }
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
  // CONTACT-PRIMAIR-LOCATIE-1: existing-contact options for the "contact ter plaatse"
  // picker, CREATE only — typing a name that matches none of these is still allowed
  // (allowCreate), it just cannot be coupled (no real contact id exists for it yet).
  // CONTACT-LABEL-1 (Danny 02-08): "naam — functie" via the one shared label builder
  // (mirrors RelationsSection/AddOpportunityModal/KlantTab/useCascadePickers) — never
  // a bare name, so two "Joost"s at the same customer read apart in the list.
  const contactOptions = existingContacts.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))

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
          {/* SUBENTITY-IMPORT-1: the file-import path, CREATE only — same top spot as
              CvUploadCard/CustomerImportCard. Editing a single location has no batch
              concept, so the card never renders there. */}
          {!isEdit && (
            <SubEntityImportCard entity="locations" wizard={importWizard} customerName={customerName}
              canView={canViewImportTemplate} canImport={canRunImport} />
          )}

          {/* Algemeen — name + status. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.general')}</div>
            <div style={cardBox}>
              <div>
                <Field label={t('subModal.locationName')} required>
                  <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.locationPlaceholder')} error={errors.name} />
                </Field>
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
              </div>
              {/* STATUS-HIDDEN-1: hidden unless the tenant marked it required —
                  LocationDetail's own title-row picker is where status is set. */}
              {showStatusPicker && (
                <div style={{ ...row2, alignItems: 'end' }}>
                  <Field label={t('subModal.status')}>
                    <CreatableSelect value={form.statusId ? String(form.statusId) : null} onChange={v => set('statusId', v || null)} allowCreate={false}
                      placeholder={t('subModal.selectStatus')} options={statusOptions} style={pickerStyle} />
                  </Field>
                  <div />
                </div>
              )}
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
                {/* PROVINCIE-1 (Danny 02-08: "provincie heeft geen zoekbare dropdown???"):
                    a searchable picker fed by the same shared useProvinces hook the
                    customer's own AddressCard uses — was a bare TextField, the one
                    inconsistency in this modal against every other relational field
                    here. Sends `state` (unchanged wire key): CustomerLocationController
                    aliases `state` onto `province` server-side whenever `province`
                    itself is absent (normaliseLegacyKeys) — verified in the controller
                    source, so this is not a silently-dropped key, just the legacy name. */}
                <Field label={t('subModal.state')}>
                  <CreatableSelect value={form.state || null} onChange={v => set('state', v)} allowCreate={false}
                    placeholder={t('common:select')} options={provinces} menuWidth={260} style={pickerStyle} />
                </Field>
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
              {/* CONTACT-PRIMAIR-LOCATIE-1 (Danny: "je typt Joost de Boer in en Joost
                  weet er niets van"): CREATE offers a real choice — pick one of this
                  customer's existing contacts (a real coupling, made primary-for-this-
                  site once the location exists, see submit()) or type a brand-new name
                  (kept exactly as before: a free-text label only, no contact record).
                  EDIT keeps the plain text field — the real per-site primary contact is
                  already properly editable from LocationDetail's own SectionCard, so
                  duplicating that mechanism here would be a second, conflicting UI for
                  the same fact. `email`/`phone` are untouched free-text columns in both
                  modes (see this file's report for why they stay). */}
              {isEdit ? (
                <Field label={t('subModal.contactName')}><TextField value={form.contactName} onChange={v => set('contactName', v)} /></Field>
              ) : (
                <div>
                  <Field label={t('subModal.contactName')}>
                    {/* Controlled on the ID when a real contact is picked (so the trigger's
                        OWN label lookup resolves the name, and reopening the list still
                        shows the checkmark on it) — falls back to the raw typed text once
                        pickedContactId is null (a brand-new name, no option to match). */}
                    <CreatableSelect value={pickedContactId ? String(pickedContactId) : (form.contactName || null)}
                      onChange={v => {
                        const existingMatch = existingContacts.find(c => String(c.id) === v)
                        setPickedContactId(existingMatch ? (existingMatch.id as Id) : null)
                        set('contactName', existingMatch ? existingMatch.name : v)
                      }}
                      placeholder={t('subModal.contactName')} options={contactOptions} menuWidth={280} style={pickerStyle} />
                  </Field>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{t('subModal.contactPersonHint')}</div>
                </div>
              )}
              <div style={row2}>
                <Field label={t('subModal.email')}><TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder="naam@klant.nl" /></Field>
                <Field label={t('subModal.phone')}><TextField value={form.phone} onChange={v => set('phone', v)} /></Field>
              </div>
            </div>
          </div>

          {/* Omschrijving — its own card, same convention as AddDepartmentModal's
              (Danny 02-08: "bij locatie en afdeling moeten we ook een beschrijving
              hebben"). COLLAPSIBLE-TEXT-1 (02-08 round 2): the always-open editor
              became the shared collapsed-ghost block (same shape as +Match's
              Opmerkingen) so every create modal behaves identically. */}
          <div>
            <div style={cardHead}>{t('locations.detail.description')}</div>
            <div style={cardBox}>
              {/* ARIA-LABEL-1: this modal's own footer button is ALSO labelled
                  subModal.create ("Toevoegen"/"Add", same word as the generic
                  common:add placeholder) — a distinct aria-label (the card's own
                  heading) prevents two buttons sharing one accessible name. */}
              <CollapsibleRichText t={t} value={form.description} onChange={v => set('description', v)}
                expanded={descExpanded} setExpanded={setDescExpanded}
                editing={descEditing} setEditing={setDescEditing}
                placeholder={t('common:add')} ariaLabel={t('locations.detail.description')} />
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
