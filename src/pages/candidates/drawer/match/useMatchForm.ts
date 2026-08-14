/**
 * useMatchForm — all state, effects, submit and 422-field-mapping for
 * the "+ Match" match form (MATCH-PLACEMENT-1). Split out of
 * MatchModal.tsx (audit R1 item 1, MUST-SPLIT: the component was 532
 * lines with 4 inline api-calls). The customer→location→department→contact
 * cascade now runs through the ONE shared `useCustomerCascade` hook (audit R1
 * item 2 — this used to be its own inline fetch here, triplicated with
 * opportunities/vacancies); the branch-mismatch check and the cost-centre/
 * billing-email takeover-default proposals are their own sibling hooks too
 * (useBranchMismatch, useCascadeDefaults — each a self-contained concern). This
 * hook owns what's left: candidate/relations/contract/financial state, the
 * rate proposal (useRateProposal), and inline contact creation. The match
 * record's own submit/edit-prefill network I/O now lives in `useMatchSubmit`
 * (see the §3 SIZE SPLIT note below). The Vestiging default (useBranchDefault,
 * 7.4) and the end-date proposal from contract type (useEndDateProposal, 7.1)
 * are their own sibling hooks too — same reason as useCascadeDefaults/
 * useBranchMismatch: each a self-contained propose-but-freeze-on-edit concern.
 *
 * Danny 24-07 additions: contract type/CAO are now lookup-backed (useContractTypes/
 * useCao) instead of a free label/free text, with an is_default-driven PROPOSAL for
 * contract type (create only) and an end-date proposal from the type's
 * `default_duration_days` — both backed by real backend columns, both inert until a
 * tenant configures them (see useContractTypes for the verified contract); the
 * inline new-contact form gained function/phone/mobile fields
 * (useContactFunctions) plus a client-side duplicate-contact preflight
 * (findDuplicateContact, helpers.ts) since the backend enforces no such uniqueness.
 *
 * EDIT-MATCH-1 (point 2, Danny live P1): `editMatchId` reopens this SAME form as an
 * edit. The candidate's own embedded `matches` row is thin (read-only display fields
 * only — no match/contract/financial columns, MATCH-EMBED-1), so this fetches the
 * full GET /matches/{id} record once and prefills every field from it; submit then
 * PATCHes instead of POSTing. Every "propose but freeze on edit" sibling hook
 * (branch/end-date/cost-centre/billing-email) gets its own *Dirty flag forced true
 * right after the prefill, so its propose-effect never overwrites the loaded value;
 * `skipCascadeResetRef` guards the ONE local reset effect below (clears location/
 * department/contact whenever `customerId` changes) so loading the match's own
 * customer doesn't immediately wipe the location/department/contact it came with.
 * Identity (candidate/vacancy) stays NOT editable here — UpdateMatchRequest's rules
 * don't accept those two, mirroring the backend docblock — so the vacancy field
 * renders read-only while editing (RelationsSection's `editing` prop) instead of a
 * silently-dropped edit (§3: no fake affordances).
 *
 * VACANCY-PREFILL-1 (points 1/2/3/4, Danny's ten-point round): picking a vacancy
 * proposes klant/klantlocatie/afdeling/contactpersoon/vestiging/data/uren as
 * EDITABLE values (never a lock), the recruiter/owner defaults from the
 * candidate's own owner (RECRUITER-DEFAULT-1, mirrors usePlanIntakeForm), and a
 * client-side duplicate/overlap preflight warns (never blocks) on the candidate's
 * OWN existing matches. All four sit in their own sibling hooks
 * (useVacancyPrefillApply / useRecruiterDefault / useMatchConflicts) for the same
 * reason as the other propose-but-freeze concerns above — see each hook's own
 * docblock for the exact contract (which vacancy fields are real vs. missing/
 * mismatched-vocabulary, verified against the backend).
 *
 * §3 SIZE SPLIT: the match record's own network I/O — the GET /matches/{id}
 * edit-prefill and the POST/PATCH /matches submit + 422 mapping — now lives in
 * its own sibling `useMatchSubmit` (this file had grown past the 400-line split
 * trigger). This hook still ASSEMBLES every value that submit persists; the
 * sibling only reads/writes them, mirroring the propose-but-freeze siblings above.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useUsers } from '@/lib/queries'
import { useLookups } from '@/context/LookupsContext'
import { useCustomerOptions } from '@/pages/vacancies/hooks/useCustomerOptions'
import { useVacancyOptions } from '@/pages/candidates/hooks/useVacancyOptions'
import { useFunctions } from '@/lib/useFunctions'
import { useContractTypes } from '@/lib/useContractTypes'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { useCao } from '@/lib/useCao'
import { useLocations } from '@/lib/useLocations'
import { useRateProposal } from '@/pages/candidates/hooks/useRateProposal'
import { useActionRulePreflight } from '@/components/actionrules'
import { useCustomerCascade } from '@/hooks/useCustomerCascade'
import { useBranchMismatch } from './useBranchMismatch'
import { useCascadeDefaults } from './useCascadeDefaults'
import { useBranchDefault } from './useBranchDefault'
import { useEndDateProposal } from './useEndDateProposal'
import { useVacancyPrefillApply } from './useVacancyPrefillApply'
import { useRecruiterDefault } from './useRecruiterDefault'
import { useMatchConflicts } from './useMatchConflicts'
import { useMatchSubmit } from './useMatchSubmit'
import { todayISO, findDuplicateContact } from './helpers'
import type { CascadeOption } from '@/hooks/useCustomerCascade'
import type { Id } from '@/types/common'
import type { MatchContractLine } from '@/types/match'

interface UserLike { id?: Id; name?: string }

export function useMatchForm({
  candidateId: fixedCandidateId, editMatchId, onClose, onCreated,
  initialCustomerId, initialCustomerLocationId, initialCustomerDepartmentId,
  candidateOwnerId,
}: {
  // Fixed when opened from a candidate's Match tab; absent on the Matches page —
  // then a candidate picker appears at the top of RELATIES (Danny 2026-07-13).
  candidateId?: Id
  // Set (EDIT-MATCH-1, point 2) when opened from a MatchesTab row's pencil —
  // prefills every field from the full record and PATCHes on submit instead of POST.
  editMatchId?: Id
  onClose: () => void
  onCreated: () => void
  // Point 1 (Danny's ten-point round): opened from a customer/location/department
  // drill-down's own "+ Match" — seeds the Relaties cascade's INITIAL state, never
  // a lock (setCustomerId/setLocationId/setDepartmentId stay fully usable below).
  initialCustomerId?: Id
  initialCustomerLocationId?: Id
  initialCustomerDepartmentId?: Id
  // RECRUITER-DEFAULT-1 (point 3, Danny's ten-point round): the candidate's own
  // owner, passed down from an already-loaded drawer record (WorkTab's `c.ownerId`)
  // — mirrors AddApplicationModal/PlanIntakeModal's candidateOwnerId, never refetched.
  candidateOwnerId?: Id | null
}) {
  const editing = Boolean(editMatchId)
  const { t } = useTranslation(['candidates', 'common'])
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const customerOptions = useCustomerOptions(true)
  const vacancyOptions = useVacancyOptions(true)

  // MATCH-SOORT-1: Contractvorm (candidateTypes lookup) — the FIRST choice in the
  // Relaties card. `hasContractLines` reads the picked value's own flag, never a
  // hardcoded slug — a tenant can point the flag at any Contractvorm row.
  const { candidateTypes } = useLookups()
  const [contractForm, setContractFormRaw] = useState('')
  const setContractForm = (v: string) => setContractFormRaw(v)
  const hasContractLines = Boolean(candidateTypes.find(ct => ct.value === contractForm)?.has_contract_lines)
  // MATCH-KLANTLOOS-1: a Contractvorm flagged `customer_not_applicable` means this
  // match has no customer — Relaties hides klant/locatie/afdeling/contactpersoon and
  // requires a branch instead (the server rejects the four fields + requires branch_id).
  const customerNotApplicable = Boolean(candidateTypes.find(ct => ct.value === contractForm)?.customer_not_applicable)
  const [contractLines, setContractLinesRaw] = useState<MatchContractLine[]>([])
  // Switching AWAY from a flagged Contractvorm clears the local draft — the
  // section disappears (§1 of the changelog: the backend cleans up orphaned
  // rows server-side, this is only the FE's own visible-state hygiene).
  useEffect(() => { if (!hasContractLines && contractLines.length) setContractLinesRaw([]) }, [hasContractLines]) // eslint-disable-line react-hooks/exhaustive-deps -- only react to the flag flipping, never to the recruiter's own row edits
  const setContractLines = (v: MatchContractLine[]) => setContractLinesRaw(v)

  // Candidate picker (only when no fixed candidate): light option list from the API.
  const [pickedCandidateId, setPickedCandidateId] = useState('')
  const [candidateOptions, setCandidateOptions] = useState<Array<{ id?: Id; name?: string }>>([])
  useEffect(() => {
    if (fixedCandidateId) return
    api.get('/candidates', { params: { per_page: 200 } })
      .then(r => setCandidateOptions((r.data?.data ?? []) as Array<{ id?: Id; name?: string }>))
      .catch(() => setCandidateOptions([]))
  }, [fixedCandidateId])
  const candidateId = fixedCandidateId ?? (pickedCandidateId || '')
  const { functions } = useFunctions()
  const { types: contractTypes, options: contractTypeOptions } = useContractTypes()
  // CAO (Danny 24-07 point 5) — the same tenant lookup every other CAO field in
  // the app already reads (customer price agreements, the match drawer's own
  // contract edit); this form's CAO field used to be a bare free-text input.
  const { types: caoOptions } = useCao()
  // Contact function/job title (Danny 24-07 addendum) — the inline new-contact
  // form's Functie picker; allowFreeEntry mirrors AddContactPersonModal exactly.
  const { contactFunctions, allowFreeEntry: contactFunctionsAllowFreeEntry } = useContactFunctions()
  // Tenant establishments (7.4) — feeds both the Vestiging picker and its default proposal.
  const branchLocations = useLocations()

  // AXIS-MATRIX-2 preflight (item 22, pattern-prover): POST /matches enforces
  // match.create against the candidate server-side (MatchController::store) —
  // surface the same warn/block decision here BEFORE submit, not just after a
  // rejected POST. Minimal: an inline banner only, no button-gating yet (the full
  // P-dialog rollout is a later wave).
  const { decision: matchRuleDecision } = useActionRulePreflight('match.create', { candidateId: String(candidateId || '') })

  // ── Relaties ── customer drives the location/department/contact cascade —
  // ONE shared implementation (audit R1 item 2; used to be its own inline
  // GET /customers/{id} effect here, duplicated in opportunities/vacancies). The
  // Raw setters below are the plain useState setters — VACANCY-PREFILL-1 wraps its
  // OWN touched-aware versions further down (`setCustomerId` etc., what the JSX
  // actually receives); every OTHER internal effect in this file keeps using Raw.
  const [customerId, setCustomerIdRaw] = useState(initialCustomerId != null ? String(initialCustomerId) : '')
  const { detail, locations, contacts, refetch: refetchCustomer } = useCustomerCascade(customerId)
  const [locationId, setLocationIdRaw] = useState(initialCustomerLocationId != null ? String(initialCustomerLocationId) : '')
  const [departmentId, setDepartmentIdRaw] = useState(initialCustomerDepartmentId != null ? String(initialCustomerDepartmentId) : '')
  const [contactId, setContactIdRaw] = useState('')
  // MATCH-KLANTLOOS-1: switching TO a `customer_not_applicable` Contractvorm clears
  // a previously staged customer/location/department/contact — those fields hide and
  // the submit body must never carry a stale relational id the server would reject.
  useEffect(() => {
    if (!customerNotApplicable) return
    if (customerId) setCustomerIdRaw('')
    if (locationId) setLocationIdRaw('')
    if (departmentId) setDepartmentIdRaw('')
    if (contactId) setContactIdRaw('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the flag flipping, never to the recruiter's own cascade edits
  }, [customerNotApplicable])
  // EDIT-MATCH-1: guards the reset below during the one-shot prefill (see the
  // prefill effect further down) — picking a NEW customer still clears location/
  // department/contact, but loading an existing match's own combination must not
  // be wiped the instant customerId itself is set from the fetched record. Point 1
  // (Danny's ten-point round) reuses the SAME guard for its own one-shot seed, and
  // VACANCY-PREFILL-1 reuses it a third time for the vacancy's own customer prefill
  // (see useVacancyPrefillApply) — every case: the mount-time/programmatic run of
  // the reset effect below must not immediately wipe a prefill it arrived together with.
  const skipCascadeResetRef = useRef(initialCustomerId != null)
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []
  // Vestiging PROPOSAL (7.4): customer branch > recruiter's own branch > tenant
  // default — own sibling hook, freezes the moment the recruiter edits it by hand.
  const { branchId, setBranchId: setBranchIdRaw, setBranchDirty } = useBranchDefault(detail, branchLocations)

  // Vestiging-mismatch (fase 3) + RECRUITER-DEFAULT-1's fallback owner (point 3) —
  // own sibling hook (self-contained: loads the candidate's branch + owner once,
  // flags a mismatch, owns the "keep vs also move" choice). Moved up from its
  // original position so `candOwnerId`/`candBranch` are ready for the two hooks below.
  const { candBranch, candOwnerId, mismatchChoice, setMismatchChoice, branchMismatch } = useBranchMismatch(candidateId, detail)

  // Inline contact-create (Danny): when a customer has no matching contact, add one
  // and couple it to the picked location right here (POST /customers/{id}/contacts).
  // function/phone/mobile (Danny 24-07 addendum) are all accepted by the backend's
  // CustomerContactController::validateContact — verified directly against the
  // koiosmatch-api source, never assumed.
  const [creatingContact, setCreatingContact] = useState(false)
  const [nc, setNc] = useState({ first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' })
  // Duplicate-contact preflight result (Danny 24-07): set by saveContact() below
  // when the entered email/phone/mobile already matches a contact already loaded
  // for this customer; null once cleared (cancel, or a fresh non-duplicate attempt).
  const [duplicateContact, setDuplicateContact] = useState<CascadeOption | null>(null)
  const [func, setFunc] = useState('')
  const [vacancyId, setVacancyIdRaw] = useState('')
  // RECRUITER-DEFAULT-1 (point 3): candidate's own owner > logged-in user, seeded
  // once — own sibling hook, mirrors usePlanIntakeForm's identical pattern.
  const { ownerId, setOwnerId } = useRecruiterDefault({ editing, candidateOwnerId, candOwnerId, users })

  // ── Contract ──
  // VACANCY-CONTRACT-FIELD-1: contractType/cao now also get a vacancy-prefill
  // overlay (below), so — like every other prefillable field in this hook — the
  // state holds a RAW setter here; the touched-aware wrapper the JSX/submit body
  // actually use is defined once useVacancyPrefillApply hands back `markTouched`.
  const [contractType, setContractTypeRaw] = useState('')
  // Default contract-type PROPOSAL (Danny 24-07 point 4): a tenant can mark ONE
  // contract type as its default (`is_default`, a real backend singleton flag —
  // see useContractTypes for the verified contract). CREATE ONLY: proposing into an
  // existing record would silently rewrite a match the recruiter opened to edit.
  // One-shot via the ref, so clearing the field by hand keeps it cleared.
  const contractTypeProposedRef = useRef(false)
  useEffect(() => {
    if (editing || contractTypeProposedRef.current || contractType) return
    const def = contractTypeOptions.find(o => o.is_default)
    if (!def) return
    contractTypeProposedRef.current = true
    setContractTypeRaw(def.label)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the options list resolving, never to the recruiter's own pick
  }, [contractTypeOptions])
  // Show the tenant's wording, not the stored slug. A match reads back
  // `contract_type` as the immutable slug (the backend normalises a posted label to
  // `value` before saving), while the picker lists labels — so canonicalise once the
  // options resolve, otherwise an edit form shows a raw `bepaalde_tijd` in the field.
  // Anything unknown (an unconfigured lookup's free text) is left untouched, never blanked.
  useEffect(() => {
    if (!contractType) return
    const label = contractTypeOptions.find(o => o.value === contractType)?.label
    if (label && label !== contractType) setContractTypeRaw(label)
  }, [contractTypeOptions, contractType])
  // Proposal, not a hard default — the recruiter can freely change it (job 19).
  const [startDate, setStartDateRaw] = useState(todayISO)
  // End-date PROPOSAL (7.1): from the picked contract type's default duration —
  // own sibling hook, honest no-op until the BE column exists.
  const { endDate, setEndDate: setEndDateRaw, setEndDateDirty } = useEndDateProposal({ contractType, startDate, options: contractTypeOptions })
  const [hours, setHoursRaw] = useState('')
  const [cao, setCaoRaw] = useState('')

  // VACANCY-PREFILL-1 (points 1/2/4): applies the picked vacancy's real fields
  // (customer/location/department/contact/branch/dates/hours) onto the state
  // above, ONLY while untouched, and owns the touched-aware setters the JSX
  // actually receives (`setCustomerId` etc. below) plus the ONE `setVacancyId`
  // that both switches and clears (point 1.8.4). See its own docblock for the
  // full contract — this call must sit AFTER every raw setter/dirty-flag it wraps.
  const { setVacancyId, markTouched, resetTouched } = useVacancyPrefillApply({
    editing, vacancyId, setVacancyIdRaw,
    customerId, setCustomerIdRaw, skipCascadeResetRef,
    setLocationIdRaw, setDepartmentIdRaw, setContactIdRaw,
    setBranchIdRaw, setBranchDirty,
    setStartDateRaw, setEndDateRaw, setEndDateDirty,
    setHoursRaw,
    // VACANCY-CONTRACT-FIELD-1: the vacancy's own contract_type/cao, same overlay contract.
    setContractTypeRaw, setCaoRaw,
    candBranchId: candBranch?.id,
  })
  // Picking a (new) customer BY HAND resets the dependent picks — cascade
  // integrity. `resetTouched` un-freezes location/department/contact for a LATER
  // vacancy prefill too: this reset is automatic bookkeeping, not a user edit.
  useEffect(() => {
    if (!customerId) return
    if (skipCascadeResetRef.current) { skipCascadeResetRef.current = false; return }
    setLocationIdRaw(''); setDepartmentIdRaw(''); setContactIdRaw('')
    resetTouched(['locationId', 'departmentId', 'contactId'])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetTouched is a stable closure from a sibling hook, not a reactive trigger
  }, [customerId])
  // Touched-aware setters (point 4: "prefill never overwrites a field the
  // recruiter already touched") — the ONLY versions RelationsSection/ContractSection
  // ever see; every internal effect above/below keeps using the Raw ones.
  const setCustomerId = (v: string) => { markTouched('customerId'); setCustomerIdRaw(v) }
  const setLocationId = (v: string) => { markTouched('locationId'); setLocationIdRaw(v) }
  const setDepartmentId = (v: string) => { markTouched('departmentId'); setDepartmentIdRaw(v) }
  const setContactId = (v: string) => { markTouched('contactId'); setContactIdRaw(v) }
  const setBranchId = (v: string) => { markTouched('branchId'); setBranchIdRaw(v) }
  const setStartDate = (v: string) => { markTouched('startDate'); setStartDateRaw(v) }
  const setEndDate = (v: string) => { markTouched('endDate'); setEndDateRaw(v) }
  const setHours = (v: string) => { markTouched('hours'); setHoursRaw(v) }
  // VACANCY-CONTRACT-FIELD-1: same touched-freeze contract as every field above —
  // ContractSection's picker/CreatableSelect calls THESE, never the raw setters.
  const setContractType = (v: string) => { markTouched('contractType'); setContractTypeRaw(v) }
  const setCao = (v: string) => { markTouched('cao'); setCaoRaw(v) }

  // ── Financieel ──
  const [scale, setScale] = useState('')
  const [step, setStep] = useState('')
  const [purchase, setPurchase] = useState('')
  const [sell, setSell] = useState('')
  // Cost centre + billing email takeover-default PROPOSALS (job 21/22) — own
  // sibling hook, mirrors useRateProposal's propose-but-freeze-on-edit pattern.
  const { costCenter, setCostCenter, setCostCenterDirty, billingEmails, setBillingEmails, setBillingDirty } =
    useCascadeDefaults({ detail, locationId, departmentId })
  const [remarks, setRemarks] = useState('')
  const [remarksExpanded, setRemarksExpanded] = useState(false)
  // Opmerkingen starts COLLAPSED (Danny 24-07: "dicht geklapt laten") — the
  // RichTextEditor only renders once the recruiter explicitly opens it; never
  // auto-opens. Mirrors the candidate profile summary / vacancy description's
  // pencil-to-edit idiom (ProfileTab/DescriptionTab), simplified to a one-way
  // reveal since a fresh create-form field has no prior saved value to preview.
  const [remarksEditing, setRemarksEditing] = useState(false)

  // Rate proposal (MATCH-PLACEMENT-2): debounced lookup keyed on customer + function
  // (+ optional cao/scale/step). Prefills empty rate fields + drives the deviation
  // guard below; the hook owns all of that logic (kept out of this file, §0.3).
  const { proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation } =
    useRateProposal({ customerId, functionTitle: func, cao, scale, step, purchase, sell, setPurchase, setSell })

  // Duplicate + overlap preflight (points 5/6, 1.10/1.11) — own sibling hook,
  // client-side over the candidate's own already-fetched matches. WARN only.
  const { duplicateMatch, overlappingMatches } = useMatchConflicts({
    candidateId: String(candidateId || ''), editMatchId, customerId, locationId, departmentId, startDate, endDate,
  })

  // Margin = sell − purchase, shown live (never entered).
  const margin = (Number(sell) || 0) - (Number(purchase) || 0)
  const hasRates = purchase !== '' && sell !== ''

  // §3 split: the match record's own network I/O (edit-prefill fetch + POST/PATCH
  // submit + 422 mapping) — own sibling hook, fed every value it needs to
  // assemble the request body and every RAW setter it needs for the one-shot
  // edit prefill (never the touched-aware ones, see its own docblock).
  const { saving, errors, submitErr, handleSubmitClick } = useMatchSubmit({
    editing, editMatchId, candidateId, t, onClose, onCreated,
    customerId, locationId, departmentId, contactId, branchId,
    contractForm, contractLines, hasContractLines, customerNotApplicable,
    func, contractType, startDate, endDate, hours, cao, scale, step,
    purchase, sell, costCenter, billingEmails, remarks, ownerId, vacancyId,
    branchMismatch, mismatchChoice, detail,
    deviatesFromProposal, confirmDeviation, setConfirmDeviation,
    skipCascadeResetRef,
    setCustomerIdRaw, setLocationIdRaw, setDepartmentIdRaw, setContactIdRaw,
    setBranchIdRaw, setBranchDirty, setVacancyIdRaw, setOwnerId, setFunc,
    // VACANCY-CONTRACT-FIELD-1: the edit-mode one-shot prefill needs the RAW
    // setters too (mirrors every other field here) — never the touched-aware
    // wrappers, so loading an existing match never freezes a later vacancy pick.
    setContractType: setContractTypeRaw, setStartDateRaw, setEndDateRaw, setEndDateDirty, setHoursRaw,
    setCao: setCaoRaw, setScale, setStep, setPurchase, setSell,
    setCostCenter, setCostCenterDirty, setBillingEmails, setBillingDirty, setRemarks,
    setContractFormRaw, setContractLinesRaw,
  })

  // Create a contact for the current customer, coupled to the picked location, then
  // refetch the cascade (shared hook) and select the new contact.
  const saveContact = async () => {
    if (!customerId || !nc.first_name.trim() || !nc.last_name.trim()) return
    // Duplicate preflight (Danny 24-07): block BEFORE posting when the email or
    // either phone number already belongs to a contact already loaded for this
    // customer — the backend does NOT enforce this uniqueness itself (verified:
    // CustomerContactController::validateContact carries no unique: rule on
    // email/phone/mobile, a real gap worth a backend ticket), so the FE is the
    // only guard against creating a second record for the same person.
    const dup = findDuplicateContact(nc, contacts)
    if (dup) { setDuplicateContact(dup); return }
    setDuplicateContact(null)
    try {
      // customer_location_id (NOT location_id — a silent-drop bug found while
      // verifying the backend contract: CustomerContact's fillable/validated key
      // is customer_location_id; the old `location_id` key was never recognised
      // by CustomerContactController::validateContact, so the picked location
      // never actually reached a newly created inline contact).
      const r = await api.post(`/customers/${customerId}/contacts`, { ...nc, customer_location_id: locationId || undefined })
      const created = (unwrap(r)) as { id?: Id }
      await refetchCustomer()
      if (created?.id) setContactId(String(created.id))
      setCreatingContact(false); setNc({ first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' })
      notifySuccess(t('placement.contactCreated'))
    } catch {
      notifyError(t('placement.contactFailed'))
    }
  }

  return {
    t, editing,
    fixedCandidateId, pickedCandidateId, setPickedCandidateId, candidateOptions,
    users, customerOptions, vacancyOptions, functions, contractTypes, caoOptions,
    contactFunctions, contactFunctionsAllowFreeEntry,
    matchRuleDecision,
    customerId, setCustomerId, detail, locations, departments, contacts,
    locationId, setLocationId, departmentId, setDepartmentId, contactId, setContactId,
    creatingContact, setCreatingContact, nc, setNc, saveContact,
    duplicateContact, setDuplicateContact,
    func, setFunc, vacancyId, setVacancyId, ownerId, setOwnerId,
    branchId, setBranchId, setBranchDirty, branchLocations,
    branchMismatch, candBranch, mismatchChoice, setMismatchChoice,
    contractType, setContractType, startDate, setStartDate, endDate, setEndDate, setEndDateDirty, hours, setHours, cao, setCao,
    // MATCH-SOORT-1: Contractvorm + its conditional CONTRACTREGELS editor.
    candidateTypes, contractForm, setContractForm, hasContractLines, contractLines, setContractLines, customerNotApplicable,
    scale, setScale, step, setStep, purchase, setPurchase, sell, setSell,
    costCenter, setCostCenter, setCostCenterDirty, billingEmails, setBillingEmails, setBillingDirty,
    remarks, setRemarks, remarksExpanded, setRemarksExpanded, remarksEditing, setRemarksEditing,
    margin, hasRates,
    proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation,
    // VACANCY-PREFILL-1 (points 5/6): the duplicate/overlap warnings for MatchModal's banners.
    duplicateMatch, overlappingMatches,
    saving, errors, submitErr, handleSubmitClick,
  }
}
