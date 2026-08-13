import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2 } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { useIndustries } from '@/lib/useIndustries'
import { useLocations } from '@/lib/useLocations'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useProvinces } from '@/hooks/useProvinces'
import { useAuth } from '@/context/AuthContext'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { modalColumns } from '@/components/ui/modalCards'
import CollapsedCard from '@/components/ui/CollapsedCard'
import CustomerCompanyCard from './addmodal/CustomerCompanyCard'
import CustomerAddressCard from './addmodal/CustomerAddressCard'
import CustomerBusinessCards from './addmodal/CustomerBusinessCards'
import CustomerCompanyTextCard from './addmodal/CustomerCompanyTextCard'
import CustomerBranchesCard from './addmodal/CustomerBranchesCard'
import CustomerImportCard from './addmodal/CustomerImportCard'
import { useCustomerImport } from './addmodal/useCustomerImport'
import type { Id, LookupOption } from '@/types/common'

// Exported so addmodal/AddressCard shares this exact shape (type-only import,
// mirrors AddCandidateModal's exported FormState).
export interface CustomerForm {
  name: string; status: string; ownerId: string; industry: string; city: string
  // KLANT-FASE-1: lifecycle phase slug (Prospect → Klant). Pre-selected from the
  // lookup's is_default FLAG, never from a hardcoded "prospect" slug.
  phase: string
  // BRANCH-1 (Danny 27-07): every customer hangs on one of the tenant's own
  // establishments — same /locations source as the drawer's OverviewTab picker,
  // so the create form and the drawer offer exactly one list.
  branchId: string
  // Danny 27-07 addendum ("+ Klant ... mist heel veel informatie"): the
  // CustomerRequest::sharedRules fields this create form never collected, even
  // though create+update share the same validator. All optional.
  website: string; employeeCount: string; toneOfVoice: string; costCenter: string; billingEmail: string
  // KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, mirroring the
  // candidate's home-address fields one-for-one — see addmodal/AddressCard.
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; province: string; country: string
}
interface ModalUser { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
// No `debtor_number` entry (DEBITEURNUMMER-1, Danny 02-08): the field is no longer
// collected at creation, so a 422 on it can never occur from this form.
// STALE-KEY-FIX (COLLAPSIBLE-TEXT-1): this used to list `tone_of_voice`, but the
// create POST has sent this field under `description` since BEDRIJFSTEKST-1 (see
// useCustomerRecord's OPTIONAL_CREATE_FIELDS) — a 422 on `description` was falling
// through unmapped, so the Bedrijfstekst card would silently show no error at all.
const API_TO_FORM: Record<string, string> = {
  name: 'name', status: 'status', owner_id: 'ownerId', industry: 'industry', city: 'city',
  location_id: 'branchId', website: 'website', employee_count: 'employeeCount', description: 'toneOfVoice',
  cost_center: 'costCenter', billing_email: 'billingEmail', phase: 'phase',
  street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix',
  postcode: 'postalCode', province: 'province', country: 'country',
}

// VALIDATIE-LIVE-1-rest: billingEmail is the only field here the backend
// validates with a shape rule (CustomerRequest::sharedRules `billing_email` =>
// Laravel's `email` rule) — website/costCenter stay plain strings server-side,
// so no live format gate is added for them (see src/lib/contactFieldValidation.ts).
const EMAIL_VALIDATORS = { billingEmail: isValidEmailFormat }
const EMAIL_ERROR_KEYS = { billingEmail: 'validation.emailFormat' }

/**
 * AddCustomerModal — create a customer. Status comes from the tenant lookup
 * (its default, hidden — see below), account manager from the user list,
 * industry from /industries and the establishment from /locations — never
 * hardcoded option lists. Awaits onCreate (the page's POST) and only closes on
 * success (C-18).
 *
 * Widened to the house WIDE_MODAL frame and regrouped into titled bordered cards
 * (Danny 27-07: "+ Klant is niet zo groot als + match en + nieuwe kandidaat EN
 * MIST HEEL VEEL INFORMATIE"). Every dropdown is now a searchable CreatableSelect.
 * Extended with the fields CustomerRequest::sharedRules already accepts on create
 * (branch/website/employeeCount/toneOfVoice/costCenter/billingEmail) — all
 * optional, so a quick "just the name" create still works unchanged. This modal
 * hands the WHOLE form object to `onCreate` (unchanged behaviour), so the new
 * fields already ride along; useCustomerRecord's handleCreate picks them up into
 * the actual POST body.
 *
 * Brought in line with AddCandidateModal (Danny 02-08, "de + nieuwe klant popup
 * moet lijken op + nieuwe kandidaat"): the debtor number is no longer collected
 * here (it stays editable everywhere else — the customer's own accounting number,
 * rarely known yet for a new prospect); status is hidden (the phase pills already
 * carry the lifecycle choice, so status just rides along at its lookup default);
 * a full address card was added (addmodal/AddressCard, same field grouping and
 * country/province cascade as the candidate); and the account manager defaults to
 * the logged-in user when they are assignable (mirrors AddApplicationModal).
 *
 * CUSTOMER-IMPORT-1 (Danny 02-08: "bovenin ... import cvs of excel file"): the
 * italic bottom-of-modal hint that only NAMED the Settings import screen is gone;
 * in its place sits CustomerImportCard, which actually RUNS the customer_tree
 * importer here — dry run first, then confirm. Unlike the CV card this does not
 * prefill the form: a real import writes the customer (+ locations/departments/
 * contacts) directly, so a clean result (something landed) closes this modal and
 * refreshes the list instead of leaving an untouched create form open behind a
 * customer that already exists (that invites a duplicate). While the import is
 * past its upload step, the manual submit below is disabled for the same reason
 * — never two creation paths armed at once. KLANT-LAYOUT-2 (Danny 03-08) moved
 * the card from its original top-of-modal spot to a collapsed-by-default section
 * at the bottom (see CollapsedCard below) — a rare, optional path shouldn't sit
 * above the name field the recruiter almost always fills by hand.
 *
 * CARD SPLIT (§0.3 — the ~400-line split trigger, 2026-08-03): every card's JSX
 * moved to its own component in `addmodal/` (CustomerCompanyCard,
 * CustomerAddressCard, CustomerBusinessCards, CustomerCompanyTextCard,
 * CustomerBranchesCard) — pure extraction, zero behaviour change. This
 * container keeps everything that orchestrates ACROSS cards: all form/error
 * state, the phase/status/owner default effects, the province cascade, the
 * submit chain + 422 field-error mapping, and the import-vs-manual-submit gate.
 */
export default function AddCustomerModal({ onClose, onCreate, onImported, users = [], statuses = [] }: {
  onClose: () => void; onCreate?: (form: CustomerForm) => unknown
  /** Called once a real import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
  users?: ModalUser[]; statuses?: LookupOption[]
}) {
  const { t } = useTranslation(['customers', 'common'])
  const { industries } = useIndustries()
  // KLANT-FASE-1: the lifecycle-phase lookup + the is_default phase a new customer starts in.
  const { phases, defaultPhase } = useCustomerPhases()
  // The tenant's own establishments (GET /locations) — same source as OverviewTab's Vestiging picker.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  // ACCOUNTMANAGER-DEFAULT-1 (Danny 02-08: "Accountmanager moet voorstel waarde zijn
  // van de gebruiker die hem aanmaakt") — mirrors AddApplicationModal's identical
  // owner-default guard: only propose the LOGGED-IN user when they actually appear
  // in the tenant's assignable `users` list, never a super-admin or non-tenant
  // account the server would 422 on (owner_id is validated against tenant users).
  const authCtx = useAuth() as unknown as {
    user: { id?: Id; name?: string } | null
    hasPermission?: (permName: string) => boolean
  }
  const { user: me } = authCtx
  const meIsAssignable = me?.id != null && users.some(u => String(u.id) === String(me.id))
  // CUSTOMER-IMPORT-1: falls back to "no permission" rather than crashing when the
  // context is mid-boot (mirrors ImporterenSettings' own hasPermission fallback).
  // The wizard/permission/auto-close wiring itself lives in useCustomerImport (kept
  // out of this container to stay under the ~400-line split trigger, CLAUDE.md §3).
  const hasPermission = authCtx.hasPermission ?? (() => false)
  const { wizard: importWizard, canView: canViewImportTemplate, canImport: canRunImport } =
    useCustomerImport({ hasPermission, onImported, onClose })
  // DEBITEURNUMMER-1 (Danny 02-08): status is HIDDEN in this form (the phase pills
  // replace it — a new customer starts on the tenant's default status), so the
  // default must come from the lookup's own is_default FLAG, exactly like the
  // candidate modal's phase default — never an invented literal or an empty string.
  const defaultStatusValue = statuses.find(s => (s as { isDefault?: boolean }).isDefault)?.value ?? statuses[0]?.value ?? ''
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure.
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // COLLAPSIBLE-TEXT-1: Bedrijfstekst's own collapsed/editing state now lives
  // inside CustomerCompanyTextCard (nothing outside that card ever reads it).
  const [form, setForm] = useState<CustomerForm>({
    name: '', status: defaultStatusValue, ownerId: '', industry: '', city: '',
    phase: defaultPhase,
    branchId: '', website: '', employeeCount: '', toneOfVoice: '', costCenter: '', billingEmail: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', province: '', country: '',
  })

  // The lookup arrives async (one cached GET), so seed the default phase once it lands —
  // but never overwrite a phase the user already picked.
  useEffect(() => {
    setForm(f => (f.phase ? f : { ...f, phase: defaultPhase }))
  }, [defaultPhase])

  // Same pattern for the (now hidden) status default — the recruiter never picks it
  // here, so this is the ONLY thing that ever sets it.
  useEffect(() => {
    setForm(f => (f.status ? f : { ...f, status: defaultStatusValue }))
  }, [defaultStatusValue])

  // Propose the current user as account manager ONCE they are known to be
  // assignable; a value the recruiter already picked (or picks later) is never
  // overwritten — the functional update only fires while ownerId is still empty.
  useEffect(() => {
    if (meIsAssignable) setForm(f => (f.ownerId ? f : { ...f, ownerId: String(me!.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to assignability resolving, mirrors AddApplicationModal's owner-default effect
  }, [meIsAssignable])

  // KLANT-ADRES-1: province list CASCADES on the picked country, same shared hook
  // (and same clear-on-mismatch behaviour) as the candidate's home address.
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setForm(f => ({ ...f, province: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for billingEmail —
  // own sibling hook (mirrors AddCandidateModal's useLiveFieldValidation).
  const { markTouched, fieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)

  const set = (k: keyof CustomerForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  const handleSubmit = async () => {
    // VALIDATIE-LIVE-1-rest: block on a live format failure too — marks any
    // untouched-but-malformed field touched so its message renders.
    const invalidKeys = touchInvalidFields()
    if (!form.name.trim() || invalidKeys.length) { setErrors({ name: !form.name.trim() }); return }
    setSaving(true)
    try {
      await onCreate?.(form)
      onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) so the user isn't left guessing.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    } finally {
      setSaving(false)
    }
  }
  // CUSTOMER-IMPORT-1: blocked while an import is past its upload step (preview or
  // result) — never let the manual form fire a SECOND create while the import is
  // mid-decision or has just written its own records.
  const canSubmit = !!form.name.trim() && !saving && importWizard.step === 'upload' && !hasFormatError
  // The phase the title names — the pills below are the only way to change it.
  const selectedPhase = phases.find(p => String(p.value) === String(form.phase))
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel; the bespoke header (icon + phase-in-title + phase
    // pills) rides along inside the drag handle via the `header` slot.
    <FloatingPanel open onClose={onClose} ariaLabel={t('modal.title')}
      persistKey="customer-add" scrollBody={false}
      width="min(calc(100vw - 48px), 1060px)" maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={16} color="var(--color-primary)" />
          </div>
          <div>
            {/* The chosen phase is in the TITLE, exactly as the candidate modal reads
                "Nieuwe — Lead" (Danny 02-08: "die fase moet zijn zoals + nieuwe
                kandidaat"). A phase buried in a card is a phase nobody notices. */}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {selectedPhase ? `${t('modal.title')} — ${selectedPhase.label}` : t('modal.title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('modal.subtitle')}</div>
          </div>
          {/* Phase choice — two compact pills, the same control the candidate uses. */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', marginRight: 12, flexShrink: 0 }}>
            {phases.map(ph => {
              const active = form.phase === ph.value
              return (
                <button key={String(ph.value)} type="button" onClick={() => set('phase', String(ph.value))}
                  aria-pressed={active} title={ph.label}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, height: BTN_H, padding: '0 14px',
                    borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                    border: `1.5px solid ${active ? (ph.color ?? 'var(--color-primary)') : 'var(--border)'}`,
                    background: active ? (ph.color ?? 'var(--color-primary)') + '14' : 'var(--surface)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ph.color ?? 'var(--color-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500,
                    // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                    color: active ? (ph.color ?? 'var(--color-primary-text)') : 'var(--text)' }}>{ph.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      }>

        {/* Body — KLANT-LAYOUT-2 (Danny 03-08 A+D decision): these cards used to
            stack in ONE column inside this WIDE_MODAL frame, wasting half its
            width and forcing a scroll for what should fit on one screen. Split
            into two responsive columns (falls back to one column below 340px
            per column, same idiom as WorkflowsListPanel): LEFT keeps the
            required/identity fields (Bedrijf, Adres) the recruiter always
            fills; RIGHT holds the secondary/optional ones (Eigenaar, Online,
            Facturatie, Bedrijfstekst, Vestigingen). The import card — rare and
            fully optional — moves out of the grid entirely to a collapsed
            section at the bottom (see below). */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={modalColumns('repeat(auto-fit, minmax(340px, 1fr))')}>
            {/* LEFT — required identity: name/industry/employeeCount + the full address. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CustomerCompanyCard form={form} set={set} errors={errors} industries={industries} />
              {/* KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, the
                  same full-width card/field grouping as AddCandidateModal's AddressCard. */}
              <CustomerAddressCard form={form} set={set} provinces={provinces} />
            </div>

            {/* RIGHT — secondary/optional: owner, online/billing, company text, branch. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CustomerBusinessCards form={form} set={set} userOptions={userOptions}
                billingEmailError={!!fieldMessage('billingEmail')} billingEmailMessage={fieldMessage('billingEmail')}
                onBillingEmailBlur={() => markTouched('billingEmail')} />
              <CustomerCompanyTextCard form={form} set={set} />
              <CustomerBranchesCard form={form} set={set} branchOptions={branchOptions} />
            </div>
          </div>

          {/* CUSTOMER-IMPORT-1 / KLANT-LAYOUT-2: moved from the top of the modal (it used
              to sit above the name field) to a collapsed-by-default section at the very
              bottom — importing a whole customer tree from a file is a rare, secondary
              path, not the first thing a recruiter should see. `filled` tints the
              indicator dot once a file is picked, so a recruiter mid-import can tell the
              section holds something even while collapsed. */}
          <CollapsedCard title={t('modal.import.title')} filled={!!importWizard.file}>
            <CustomerImportCard wizard={importWizard} canView={canViewImportTemplate} canImport={canRunImport} />
          </CollapsedCard>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 24px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'var(--color-on-accent)' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {saving ? t('common:saving') : t('modal.create')}
          </button>
        </div>
    </FloatingPanel>
  )
}
