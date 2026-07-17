/**
 * useMatchPlacementForm — all state, effects, submit and 422-field-mapping for
 * the "+ Match" placement form (MATCH-PLACEMENT-1). Split out of
 * MatchPlacementModal.tsx (audit R1 item 1, MUST-SPLIT: the component was 532
 * lines with 4 inline api-calls). The customer→location→department→contact
 * cascade now runs through the ONE shared `useCustomerCascade` hook (audit R1
 * item 2 — this used to be its own inline fetch here, triplicated with
 * opportunities/vacancies); the branch-mismatch check and the cost-centre/
 * billing-email takeover-default proposals are their own sibling hooks too
 * (useBranchMismatch, useCascadeDefaults — each a self-contained concern). This
 * hook owns what's left: candidate/relations/contract/financial state, the
 * rate proposal (useRateProposal), inline contact creation, and the POST
 * /matches submit + 422 field mapping.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useUsers } from '@/lib/queries'
import { useCustomerOptions } from '@/pages/vacancies/hooks/useCustomerOptions'
import { useVacancyOptions } from '@/pages/candidates/hooks/useVacancyOptions'
import { useFunctions } from '@/lib/useFunctions'
import { useContractTypes } from '@/lib/useContractTypes'
import { useRateProposal } from '@/pages/candidates/hooks/useRateProposal'
import { useActionRulePreflight } from '@/components/actionrules'
import { useCustomerCascade } from '@/hooks/useCustomerCascade'
import { useBranchMismatch } from './useBranchMismatch'
import { useCascadeDefaults } from './useCascadeDefaults'
import { API_TO_FORM, todayISO } from './helpers'
import type { Id } from '@/types/common'

interface UserLike { id?: Id; name?: string }

export function useMatchPlacementForm({ candidateId: fixedCandidateId, onClose, onCreated }: {
  // Fixed when opened from a candidate's Match tab; absent on the Matches page —
  // then a candidate picker appears at the top of RELATIES (Danny 2026-07-13).
  candidateId?: Id
  onClose: () => void
  onCreated: () => void
}) {
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
  const { types: contractTypes } = useContractTypes()

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
  // Picking a (new) customer resets the dependent picks — cascade integrity.
  useEffect(() => {
    if (!customerId) return
    setLocationId(''); setDepartmentId(''); setContactId('')
  }, [customerId])
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []

  // Inline contact-create (Danny): when a customer has no matching contact, add one
  // and couple it to the picked location right here (POST /customers/{id}/contacts).
  const [creatingContact, setCreatingContact] = useState(false)
  const [nc, setNc] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [func, setFunc] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [ownerId, setOwnerId] = useState('')

  // ── Contract ──
  const [contractType, setContractType] = useState('')
  // Proposal, not a hard default — the recruiter can freely change it (job 19).
  const [startDate, setStartDate] = useState(todayISO)
  const [endDate, setEndDate] = useState('')
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

  // POST the placement. vacancy_id + department are optional; the rest form the
  // contract layer (persisted once BE adds the columns — currently tolerated).
  const submit = async () => {
    if (!candidateId || !customerId || !func) return
    setSaving(true)
    setErrors({}); setSubmitErr(null)
    const body: Record<string, unknown> = {
      candidate_id: candidateId,
      customer_id: customerId,
      customer_location_id: locationId || null,
      customer_department_id: departmentId || null,
      contact_id: contactId || null,
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
      ...(vacancyId ? { vacancy_id: vacancyId } : {}),
      ...(ownerId ? { owner_id: ownerId } : {}),
    }
    try {
      await api.post('/matches', body)
      // Mismatch resolution: recruiter chose to move the candidate's branch along.
      // Best-effort AFTER the placement (its failure must not lose the match).
      if (branchMismatch && mismatchChoice === 'candidate' && detail?.branch_id) {
        await api.patch(`/candidates/${candidateId}`, { location_id: detail.branch_id }).catch(() => {})
      }
      notifySuccess(t('placement.created'))
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
    try {
      const r = await api.post(`/customers/${customerId}/contacts`, { ...nc, location_id: locationId || undefined })
      const created = (unwrap(r)) as { id?: Id }
      await refetchCustomer()
      if (created?.id) setContactId(String(created.id))
      setCreatingContact(false); setNc({ first_name: '', last_name: '', email: '', phone: '' })
      notifySuccess(t('placement.contactCreated'))
    } catch {
      notifyError(t('placement.contactFailed'))
    }
  }

  return {
    t,
    fixedCandidateId, pickedCandidateId, setPickedCandidateId, candidateOptions,
    users, customerOptions, vacancyOptions, functions, contractTypes,
    matchRuleDecision,
    customerId, setCustomerId, detail, locations, departments, contacts,
    locationId, setLocationId, departmentId, setDepartmentId, contactId, setContactId,
    creatingContact, setCreatingContact, nc, setNc, saveContact,
    func, setFunc, vacancyId, setVacancyId, ownerId, setOwnerId,
    branchMismatch, candBranch, mismatchChoice, setMismatchChoice,
    contractType, setContractType, startDate, setStartDate, endDate, setEndDate, hours, setHours, cao, setCao,
    scale, setScale, step, setStep, purchase, setPurchase, sell, setSell,
    costCenter, setCostCenter, setCostCenterDirty, billingEmails, setBillingEmails, setBillingDirty,
    remarks, setRemarks, remarksExpanded, setRemarksExpanded,
    margin, hasRates,
    proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation,
    saving, errors, submitErr, handleSubmitClick,
  }
}
