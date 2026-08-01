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
 * rate proposal (useRateProposal), inline contact creation, and the POST
 * /matches submit + 422 field mapping. The Vestiging default (useBranchDefault,
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
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useUsers } from '@/lib/queries'
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
import { API_TO_FORM, todayISO, findDuplicateContact } from './helpers'
import type { CascadeOption } from '@/hooks/useCustomerCascade'
import type { Id } from '@/types/common'

interface UserLike { id?: Id; name?: string }

// The GET /matches/{id} shape this hook prefills from (MatchDetailResource — the
// list row's fields plus the full block that resource builds). That method is still
// called placement() on the backend: the vocabulary rename of 31-07 covers our side,
// theirs follows in MATCH-VOCABULAIRE-1. Naming it match() here would point the next
// reader at a symbol that does not exist over there.
interface MatchEditDetail {
  customer_id?: Id | null; customer_location_id?: Id | null; customer_department_id?: Id | null
  contact_id?: Id | null; branch_id?: Id | null; vacancy_id?: Id | null
  owner?: { id?: Id; name?: string } | null
  function_title?: string | null; contract_type?: string | null
  start_date?: string | null; end_date?: string | null; hours_per_week?: number | string | null
  cao?: string | null; scale?: string | null; step?: string | null
  purchase_rate?: number | string | null; sell_rate?: number | string | null
  cost_center?: string | null; billing_emails?: string[] | null; remarks?: string | null
}

export function useMatchForm({ candidateId: fixedCandidateId, editMatchId, onClose, onCreated }: {
  // Fixed when opened from a candidate's Match tab; absent on the Matches page —
  // then a candidate picker appears at the top of RELATIES (Danny 2026-07-13).
  candidateId?: Id
  // Set (EDIT-MATCH-1, point 2) when opened from a MatchesTab row's pencil —
  // prefills every field from the full record and PATCHes on submit instead of POST.
  editMatchId?: Id
  onClose: () => void
  onCreated: () => void
}) {
  const editing = Boolean(editMatchId)
  const { t } = useTranslation(['candidates', 'common'])
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const customerOptions = useCustomerOptions(true)
  const vacancyOptions = useVacancyOptions(true)

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
  // GET /customers/{id} effect here, duplicated in opportunities/vacancies).
  const [customerId, setCustomerId] = useState('')
  const { detail, locations, contacts, refetch: refetchCustomer } = useCustomerCascade(customerId)
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [contactId, setContactId] = useState('')
  // EDIT-MATCH-1: guards the reset below during the one-shot prefill (see the
  // prefill effect further down) — picking a NEW customer still clears location/
  // department/contact, but loading an existing match's own combination must not
  // be wiped the instant customerId itself is set from the fetched record.
  const skipCascadeResetRef = useRef(false)
  // Picking a (new) customer resets the dependent picks — cascade integrity.
  useEffect(() => {
    if (!customerId) return
    if (skipCascadeResetRef.current) { skipCascadeResetRef.current = false; return }
    setLocationId(''); setDepartmentId(''); setContactId('')
  }, [customerId])
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []
  // Vestiging PROPOSAL (7.4): customer branch > recruiter's own branch > tenant
  // default — own sibling hook, freezes the moment the recruiter edits it by hand.
  const { branchId, setBranchId, setBranchDirty } = useBranchDefault(detail, branchLocations)

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
  const [vacancyId, setVacancyId] = useState('')
  const [ownerId, setOwnerId] = useState('')

  // ── Contract ──
  const [contractType, setContractType] = useState('')
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
    setContractType(def.label)
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
    if (label && label !== contractType) setContractType(label)
  }, [contractTypeOptions, contractType])
  // Proposal, not a hard default — the recruiter can freely change it (job 19).
  const [startDate, setStartDate] = useState(todayISO)
  // End-date PROPOSAL (7.1): from the picked contract type's default duration —
  // own sibling hook, honest no-op until the BE column exists.
  const { endDate, setEndDate, setEndDateDirty } = useEndDateProposal({ contractType, startDate, options: contractTypeOptions })
  const [hours, setHours] = useState('')
  const [cao, setCao] = useState('')

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
  const [saving, setSaving] = useState(false)
  // 422 field errors (house pattern, mirrors AddCandidateModal/AddCustomerModal) +
  // a non-field fallback banner — replaces the old generic-toast-only handling.
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // Rate proposal (MATCH-PLACEMENT-2): debounced lookup keyed on customer + function
  // (+ optional cao/scale/step). Prefills empty rate fields + drives the deviation
  // guard below; the hook owns all of that logic (kept out of this file, §0.3).
  const { proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation } =
    useRateProposal({ customerId, functionTitle: func, cao, scale, step, purchase, sell, setPurchase, setSell })

  // Vestiging-mismatch (fase 3): the candidate's own branch vs the customer's —
  // own sibling hook (self-contained: loads the candidate's branch, flags a
  // mismatch, owns the "keep vs also move" choice).
  const { candBranch, mismatchChoice, setMismatchChoice, branchMismatch } = useBranchMismatch(candidateId, detail)

  // Margin = sell − purchase, shown live (never entered).
  const margin = (Number(sell) || 0) - (Number(purchase) || 0)
  const hasRates = purchase !== '' && sell !== ''

  // EDIT-MATCH-1: fetch the full record once — the candidate's embedded `matches`
  // row (MATCH-EMBED-1) carries none of the match/contract/financial fields.
  const [editDetail, setEditDetail] = useState<MatchEditDetail | null>(null)
  useEffect(() => {
    if (!editMatchId) return
    let alive = true
    api.get(`/matches/${editMatchId}`)
      .then(r => { if (alive) setEditDetail((unwrap(r)) as MatchEditDetail) })
      .catch(() => { if (alive) setSubmitErr(t('common:errorGeneric')) })
    return () => { alive = false }
  }, [editMatchId]) // eslint-disable-line react-hooks/exhaustive-deps -- t is stable (i18n)

  // One-shot prefill once the record arrives — every *Dirty flag is forced true
  // right after its value is set so the sibling "propose" hooks (branch/end-date/
  // cost-centre/billing-email) never recompute over the loaded value; skipCascadeResetRef
  // stops the customerId-change reset above from wiping location/department/contact.
  useEffect(() => {
    if (!editDetail) return
    skipCascadeResetRef.current = true
    setCustomerId(editDetail.customer_id != null ? String(editDetail.customer_id) : '')
    setLocationId(editDetail.customer_location_id != null ? String(editDetail.customer_location_id) : '')
    setDepartmentId(editDetail.customer_department_id != null ? String(editDetail.customer_department_id) : '')
    setContactId(editDetail.contact_id != null ? String(editDetail.contact_id) : '')
    setBranchId(editDetail.branch_id != null ? String(editDetail.branch_id) : ''); setBranchDirty(true)
    setVacancyId(editDetail.vacancy_id != null ? String(editDetail.vacancy_id) : '')
    setOwnerId(editDetail.owner?.id != null ? String(editDetail.owner.id) : '')
    setFunc(editDetail.function_title ?? '')
    setContractType(editDetail.contract_type ?? '')
    setStartDate(editDetail.start_date ?? '')
    setEndDate(editDetail.end_date ?? ''); setEndDateDirty(true)
    setHours(editDetail.hours_per_week != null ? String(editDetail.hours_per_week) : '')
    setCao(editDetail.cao ?? '')
    setScale(editDetail.scale ?? '')
    setStep(editDetail.step ?? '')
    setPurchase(editDetail.purchase_rate != null ? String(editDetail.purchase_rate) : '')
    setSell(editDetail.sell_rate != null ? String(editDetail.sell_rate) : '')
    setCostCenter(editDetail.cost_center ?? ''); setCostCenterDirty(true)
    setBillingEmails(editDetail.billing_emails?.length ? editDetail.billing_emails : [''])
    setBillingDirty(true)
    setRemarks(editDetail.remarks ?? '')
    // Every setter above is a stable useState/sibling-hook setter — only react to a NEW record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDetail])

  // POST (create) or PATCH (edit) the match. vacancy_id + department are
  // optional; the rest form the contract layer. Identity (candidate/vacancy) is
  // NOT accepted by UpdateMatchRequest (mirrors the backend docblock) — the PATCH
  // body below deliberately omits both, RelationsSection renders vacancy read-only
  // while editing so the UI never implies an edit that silently drops (§3).
  const submit = async () => {
    if (!candidateId || !customerId || !func) return
    setSaving(true)
    setErrors({}); setSubmitErr(null)
    const match = {
      customer_id: customerId,
      customer_location_id: locationId || null,
      customer_department_id: departmentId || null,
      contact_id: contactId || null,
      branch_id: branchId || null,
      function_title: func,
      contract_type: contractType || null,
      start_date: startDate || null,
      end_date: endDate || null,
      hours_per_week: hours ? Number(hours) : null,
      cao: cao || null,
      scale: scale || null,
      step: step || null,
      purchase_rate: purchase ? Number(purchase) : null,
      sell_rate: sell ? Number(sell) : null,
      cost_center: costCenter || null,
      billing_emails: billingEmails.map(e => e.trim()).filter(Boolean),
      remarks: remarks || null,
      ...(ownerId ? { owner_id: ownerId } : {}),
    }
    const body: Record<string, unknown> = editing
      ? match // PATCH — no candidate_id/vacancy_id (identity stays fixed).
      : { candidate_id: candidateId, ...match, ...(vacancyId ? { vacancy_id: vacancyId } : {}) }
    try {
      if (editing) await api.patch(`/matches/${editMatchId}`, body)
      else         await api.post('/matches', body)

      // MATCH-EXPERIENCE-AUTO-1 (CMBE, 2026-07-25): the backend's MatchMaker now
      // writes the work-experience entry itself on every match create — with and
      // without a vacancy — and is idempotent on employer+start date per candidate.
      // The frontend must NOT post one anymore (the old interim bridge is removed).

      // Mismatch resolution: recruiter chose to move the candidate's branch along.
      // Best-effort AFTER the match — its failure must NOT roll back or lose
      // the match that was just created, so this stays a separate, non-fatal call.
      // BUG CLASS FIX: it used to end in `.catch(() => {})` — a fully silent
      // best-effort write, so the recruiter believed the branch moved when it
      // hadn't. It still doesn't throw (the match creation above already
      // succeeded and must be reported as such), but it now tells the user with
      // its own specific message instead of saying nothing.
      if (branchMismatch && mismatchChoice === 'candidate' && detail?.branch_id) {
        await api.patch(`/candidates/${candidateId}`, { location_id: detail.branch_id })
          .catch(() => notifyError(t('placement.branchMoveFailed')))
      }
      notifySuccess(t(editing ? 'placement.updated' : 'placement.created'))
      onCreated(); onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one, via the shared extractApiError) so
      // the user isn't left guessing.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setSubmitErr(extractApiError(err, t('common:errorGeneric')))
      }
    } finally { setSaving(false) }
  }

  // First click on a deviating submit shows the inline confirm instead of posting;
  // the second click (confirm already true) goes through — "one extra click", no hard block.
  const handleSubmitClick = () => {
    if (deviatesFromProposal && !confirmDeviation) { setConfirmDeviation(true); return }
    submit()
  }

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
    scale, setScale, step, setStep, purchase, setPurchase, sell, setSell,
    costCenter, setCostCenter, setCostCenterDirty, billingEmails, setBillingEmails, setBillingDirty,
    remarks, setRemarks, remarksExpanded, setRemarksExpanded, remarksEditing, setRemarksEditing,
    margin, hasRates,
    proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation,
    saving, errors, submitErr, handleSubmitClick,
  }
}
