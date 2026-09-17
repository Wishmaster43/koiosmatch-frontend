/**
 * AddCustomerModal — the "+ Customer" create form (§3A blueprint modal): titled
 * cards for company/address/business/branch fields, an inline duplicate guard,
 * and the customer-tree Excel import flow. See the component docblock below
 * for the full history of decisions this modal encodes.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
// DUP-04: one shared axios-error → message extractor, never a re-derived inline dance.
import { extractApiError } from '@/lib/extractApiError'
import { extractFormErrors } from '@/lib/extractFormErrors'
import { useSafePermission } from '@/hooks/useSafePermission'
import { useIndustries } from '@/lib/useIndustries'
import { useCustomerSources } from '@/lib/useCustomerSources'
import { useLocations } from '@/lib/useLocations'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useAuth } from '@/context/AuthContext'
import { useAddCustomerForm } from './hooks/useAddCustomerForm'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { WIDE_MODAL_PANEL_SIZE } from '@/components/ui/wideModalPanelSize'
import { modalColumns, cardBox, cardHead } from '@/components/ui/modalCards'
import CustomerCompanyCard from './addmodal/CustomerCompanyCard'
import CustomerAddressCard from './addmodal/CustomerAddressCard'
import CustomerBusinessCards from './addmodal/CustomerBusinessCards'
import CustomerCompanyTextCard from './addmodal/CustomerCompanyTextCard'
import CustomerBranchesCard from './addmodal/CustomerBranchesCard'
// CUST-DUP-FE-1 (22-08): the shared duplicate panel (via the candidate barrel, §2)
// + this entity's own duplicate wiring hook — mirrors AddCandidateModal's C-29
// handling, kept off this container to stay under the ~400-line split trigger.
import DuplicateNotice from '@/components/forms/DuplicateNotice'
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'
import { useCustomerDuplicateGuard } from './addmodal/useCustomerDuplicateGuard'
import CreateErrorAlert from '@/components/forms/CreateErrorAlert'
// EXCEL-VACATURES-1 (2026-08-14): the compact "create from file" card and its
// wizard/permission wiring generalised out of this page into a shared component —
// vacancies now reuses the exact same two, never a second copy (CLAUDE.md §11).
import EntityImportCard from '@/components/import/EntityImportCard'
import { useEntityImportCard } from '@/components/import/useEntityImportCard'
import type { Id, LookupOption } from '@/types/common'
import ModalFooter from '@/components/ui/ModalFooter'
// DUP-11 (round 11 DRY audit): the shared AddModalHeader wrapper, mirroring
// candidates'/vacancies' own addmodal/ModalHeader.tsx — never a fourth hand-rolled copy.
import ModalHeader from './addmodal/ModalHeader'

// The ONE backend importer that builds a whole customer tree (customer + locations +
// departments + contacts) from one flat file — verified against koiosmatch-api's
// ImportRegistry::IMPORTERS ('customer_tree' => CustomerTreeImporter::class), never
// guessed from the entity's display name.
const CUSTOMER_TREE_ENTITY = 'customer_tree'

// Exported so addmodal/AddressCard shares this exact shape (type-only import,
// mirrors AddCandidateModal's exported FormState).
export interface CustomerForm {
  name: string; status: string; ownerId: string; industry: string; city: string
  // KLANT-FASE-1: lifecycle phase slug (Prospect → Klant, "Customer"). Pre-selected
  // from the lookup's is_default FLAG, never from a hardcoded "prospect" slug.
  phase: string
  // BRANCH-1 (Danny 27-07): every customer hangs on one of the tenant's own
  // establishments — same /locations source as the drawer's OverviewTab picker,
  // so the create form and the drawer offer exactly one list.
  branchId: string
  // Danny 27-07 addendum ("+ Klant ... mist heel veel informatie" — "+ Customer
  // ... is missing a lot of information"): the
  // CustomerRequest::sharedRules fields this create form never collected, even
  // though create+update share the same validator. All optional.
  website: string; employeeCount: string; companyText: string; costCenter: string; billingEmail: string
  // KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, mirroring the
  // candidate's home-address fields one-for-one — see addmodal/AddressCard.
  street: string; houseNumber: string; houseNumberSuffix: string; addressLine2: string; postalCode: string; province: string; country: string
  // CUST-DUP-FE-1 (22-08): the tenant's own KvK/CoC number — the DEFAULT first
  // dedupe key (customer_dedupe_keys). Optional; a brand-new prospect may not have one yet.
  cocNumber: string
  vatNumber: string
  // CUST-SOURCE-FE-1: acquisition source name, optional like industry.
  source: string
}
interface ModalUser { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
// No `debtor_number` entry (DEBITEURNUMMER-1, Danny 02-08): the field is no longer
// collected at creation, so a 422 on it can never occur from this form.
const API_TO_FORM: Record<string, string> = {
  name: 'name', status: 'status', owner_id: 'ownerId', industry: 'industry', city: 'city',
  location_id: 'branchId', website: 'website', employee_count: 'employeeCount', description: 'companyText',
  cost_center: 'costCenter', billing_email: 'billingEmail', phase: 'phase',
  street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix',
  // LANE-I1b: address_line_2 on visiting address.
  address_line_2: 'addressLine2',
  postcode: 'postalCode', province: 'province', country: 'country',
  // CUST-DUP-FE-1: coc_number is validated by StoreCustomerRequest (string|max:32).
  coc_number: 'cocNumber',
  // CUST-SOURCE-FE-1: 422 on `source` (ValidCustomerSource, mirrors application source).
  source: 'source',
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
 * MIST HEEL VEEL INFORMATIE" — "+ Customer isn't as big as + match and + new
 * candidate AND IS MISSING A LOT OF INFORMATION"). Every dropdown is now a
 * searchable CreatableSelect.
 * Extended with the fields CustomerRequest::sharedRules already accepts on create
 * (branch/website/employeeCount/companyText/costCenter/billingEmail) — all
 * optional, so a quick "just the name" create still works unchanged. This modal
 * hands the WHOLE form object to `onCreate` (unchanged behaviour), so the new
 * fields already ride along; useCustomerRecord's handleCreate picks them up into
 * the actual POST body.
 *
 * Brought in line with AddCandidateModal (Danny 02-08, "de + nieuwe klant popup
 * moet lijken op + nieuwe kandidaat" — "the + new customer popup must look like
 * + new candidate"): the debtor number is no longer collected
 * here (it stays editable everywhere else — the customer's own accounting number,
 * rarely known yet for a new prospect); status is hidden (the phase pills already
 * carry the lifecycle choice, so status just rides along at its lookup default);
 * a full address card was added (addmodal/AddressCard, same field grouping and
 * country/province cascade as the candidate); and the account manager defaults to
 * the logged-in user when they are assignable (mirrors AddApplicationModal).
 *
 * CUSTOMER-IMPORT-1 (Danny 02-08: "bovenin ... import cvs of excel file" — "at
 * the top ... import cvs or excel file"): the
 * italic bottom-of-modal hint that only NAMED the Settings import screen is gone;
 * in its place sits CustomerImportCard, which actually RUNS the customer_tree
 * importer here — dry run first, then confirm. Unlike the CV card this does not
 * prefill the form: a real import writes the customer (+ locations/departments/
 * contacts) directly, so a clean result (something landed) closes this modal and
 * refreshes the list instead of leaving an untouched create form open behind a
 * customer that already exists (that invites a duplicate). While the import is
 * past its upload step, the manual submit below is disabled for the same reason
 * — never two creation paths armed at once. KLANT-LAYOUT-3 (Danny 14-08,
 * supersedes the 03-08 bottom-section spot): the import flow opens from a
 * header button top-right and renders as the first card only while open — a
 * rare, optional path stays out of the way until deliberately summoned.
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
  const { industryOptions: industries } = useIndustries()
  // CUST-SOURCE-FE-1: acquisition-source picker, same tenant-lookup shape as industry.
  const { sources: sourceOptions, allowFreeEntry: sourceAllowFreeEntry } = useCustomerSources()
  // KLANT-FASE-1: the lifecycle-phase lookup + the is_default phase a new customer starts in.
  const { phases, defaultPhase } = useCustomerPhases()
  // The tenant's own establishments (GET /locations) — same source as OverviewTab's Vestiging ("Branch") picker.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  // ACCOUNTMANAGER-DEFAULT-1 (Danny 02-08: "Accountmanager moet voorstel waarde zijn
  // van de gebruiker die hem aanmaakt" — "Account manager should default to the
  // value of the user creating it") — mirrors AddApplicationModal's identical
  // owner-default guard: only propose the LOGGED-IN user when they actually appear
  // in the tenant's assignable `users` list, never a super-admin or non-tenant
  // account the server would 422 on (owner_id is validated against tenant users).
  const authCtx = useAuth() as unknown as {
    user: { id?: Id; name?: string } | null
  }
  const { user: me } = authCtx
  const meIsAssignable = me?.id != null && users.some(u => String(u.id) === String(me.id))
  const hasPermission = useSafePermission()
  const { wizard: importWizard, canView: canViewImportTemplate, canImport: canRunImport } =
    useEntityImportCard({ entity: CUSTOMER_TREE_ENTITY, hasPermission, onImported, onClose })
  // DEBITEURNUMMER-1 (Danny 02-08): status is HIDDEN in this form (the phase pills
  // replace it — a new customer starts on the tenant's default status), so the
  // default must come from the lookup's own is_default FLAG, exactly like the
  // candidate modal's phase default — never an invented literal or an empty string.
  const defaultStatusValue = statuses.find(s => (s as { isDefault?: boolean }).isDefault)?.value ?? statuses[0]?.value ?? ''
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure.
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // KLANT-LAYOUT-3: the import flow is summoned from the header button (closed on open).
  const [importOpen, setImportOpen] = useState(false)
  // COLLAPSIBLE-TEXT-1: Bedrijfstekst's ("Company text") own collapsed/editing state now lives
  // inside CustomerCompanyTextCard (nothing outside that card ever reads it).
  // Form state + its three default-seeding effects + the province cascade,
  // extracted into their own hook (§0.3 split trigger) — behaviour unchanged.
  const { form, setForm, provinces } = useAddCustomerForm({ defaultPhase, defaultStatusValue, meIsAssignable, me })

  // CUST-DUP-FE-1: live probe + create-409 verdict + restore, bundled in one hook
  // (mirrors AddCandidateModal's C-29 handling).
  const dup = useCustomerDuplicateGuard(form.name, form.cocNumber, form.billingEmail, onClose)

  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for billingEmail —
  // own sibling hook (mirrors AddCandidateModal's useLiveFieldValidation).
  const { markTouched, fieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)

  // Generic field setter: updates the form, clears that field error/create-error, and invalidates any stale duplicate-check verdict so the next submit re-asks the server.
  const set = (k: keyof CustomerForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
    // CUST-DUP-FE-1: editing anything invalidates the refused-create verdict and
    // the last probe hit — the next submit / debounce re-asks the server.
    dup.clearOnEdit()
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
      const e = err as { response?: { status?: number; data?: { errors?: Record<string, unknown>; message?: string; existing?: DuplicateMatch } } }
      // CUST-DUP-FE-1: the server refused the create (409) — render the `existing`
      // payload as a real panel instead of the raw server sentence, mirrors the
      // candidate modal's C-29 handling (AddCandidateModal.tsx) exactly.
      if (e?.response?.status === 409) {
        const existing = e.response.data?.existing
        dup.setDupBlock(existing ?? null)
        // No payload (older API build): still our own translated line, never the server's.
        setCreateError(existing ? null : t('duplicate.blockedTitle'))
      } else {
        const flags = extractFormErrors(err, API_TO_FORM)
        if (flags) {
          setErrors(flags)
        } else {
          setCreateError(extractApiError(err, t('common:errorGeneric')))
        }
      }
    } finally {
      setSaving(false)
    }
  }
  // CUSTOMER-IMPORT-1: blocked while an import is past its upload step (preview or
  // result) — never let the manual form fire a SECOND create while the import is
  // mid-decision or has just written its own records.
  const canSubmit = !!form.name.trim() && !saving && importWizard.step === 'upload' && !hasFormatError
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel; the bespoke header (icon + phase-in-title + phase
    // pills) rides along inside the drag handle via the `header` slot.
    <FloatingPanel open onClose={onClose} ariaLabel={t('modal.title')}
      persistKey="customer-add" scrollBody={false} hideClose
      {...WIDE_MODAL_PANEL_SIZE}
      header={
        // The chosen phase is in the TITLE, exactly as the candidate modal reads
        // "Nieuwe — Lead" ("New — Lead") (Danny 02-08: "die fase moet zijn zoals
        // + nieuwe kandidaat" — "that phase should be like + new candidate").
        // Phase pills = the shared TitleBarPills atom (TITELBALK-PILLS, Danny
        // 27-08); import toggle mirrors KLANT-LAYOUT-3 (Danny 14-08: icon swaps
        // upload → check once a file is picked, never a border repaint).
        // The wrapper fills the drag handle edge-to-edge via negative margins
        // (mirrors candidates'/vacancies' own header wrapper) so the header's own
        // X sits at the panel's right edge, not at the row's 50% midpoint.
        <div style={{ flex: 1, margin: '-12px -16px -13px' }}>
          <ModalHeader phase={form.phase} phases={phases} onSelectPhase={v => set('phase', v)} onClose={onClose}
            importOpen={importOpen} onToggleImport={() => setImportOpen(v => !v)}
            hasFile={!!importWizard.file} />
        </div>
      }>

        {/* Body — KLANT-LAYOUT-2 (Danny 03-08 A+D decision): these cards used to
            stack in ONE column inside this WIDE_MODAL frame, wasting half its
            width and forcing a scroll for what should fit on one screen. Split
            into two responsive columns (falls back to one column below 340px
            per column, same idiom as WorkflowsListPanel): LEFT keeps the
            required/identity fields (Bedrijf, Adres — "Company, Address") the
            recruiter always fills; RIGHT holds the secondary/optional ones
            (Eigenaar, Online, Facturatie, Bedrijfstekst, Vestigingen —
            "Owner, Online, Billing, Company text, Branches"). The import
            card — rare and fully optional — moves out of the grid entirely to
            a collapsed section at the bottom (see below). */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* CUSTOMER-IMPORT-1 / KLANT-LAYOUT-3 (Danny 14-08: "knop rechts boven in" —
              "button top-right"):
              the import flow opens from the header button and renders as the first
              card while open — summoned deliberately, never in the way otherwise. */}
          {importOpen && (
            <div style={{ ...cardBox, padding: 16 }}>
              <div style={cardHead}>{t('modal.import.title')}</div>
              <EntityImportCard wizard={importWizard} canView={canViewImportTemplate} canImport={canRunImport}
                entity={CUSTOMER_TREE_ENTITY} intro={t('modal.import.intro')} wholeTree />
            </div>
          )}
          <div style={modalColumns('repeat(auto-fit, minmax(340px, 1fr))')}>
            {/* LEFT — required identity: name/industry/employeeCount + the full address,
                plus the company text (KLANT-LAYOUT-3, Danny 14-08 screenshot: "bedrijfstekst
                links" — "company text on the left" — it fills the gap under the
                address instead of stretching the right). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CustomerCompanyCard form={form} set={set} errors={errors} industries={industries}
                sources={sourceOptions} sourceAllowFreeEntry={sourceAllowFreeEntry} />
              {/* KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, the
                  same full-width card/field grouping as AddCandidateModal's AddressCard. */}
              <CustomerAddressCard form={form} set={set} provinces={provinces} />
              <CustomerCompanyTextCard form={form} set={set} />
            </div>

            {/* RIGHT — secondary/optional: owner, online/billing, branch. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CustomerBusinessCards form={form} set={set} userOptions={userOptions}
                billingEmailError={!!fieldMessage('billingEmail')} billingEmailMessage={fieldMessage('billingEmail')}
                onBillingEmailBlur={() => markTouched('billingEmail')} />
              <CustomerBranchesCard form={form} set={set} branchOptions={branchOptions} />
            </div>
          </div>
        </div>

        {/* CUST-DUP-FE-1: the refused create (409) or the live probe hit — one panel,
            with real actions (open / restore-and-open), same as the candidate modal. */}
        {dup.notice && (
          <DuplicateNotice ns="customers" match={dup.notice} variant={dup.blocked ? 'blocked' : 'warning'}
            canRestore={hasPermission('customers.update')} restoring={dup.restoring}
            onOpen={() => dup.openExisting(dup.notice!.id)} onRestore={() => dup.restoreAndOpen(dup.notice!.id)}
            onDismiss={dup.dismiss} />
        )}
        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <CreateErrorAlert message={createError} inset={24} />
        )}

        {/* Footer — the shared ModalFooter (§4) owns the one explicit height/layout, everywhere. */}
        <ModalFooter onCancel={onClose} cancelLabel={t('modal.cancel')}
          onSubmit={handleSubmit} submitLabel={t('modal.create')}
          disabled={!canSubmit} busy={saving} />
    </FloatingPanel>
  )
}
