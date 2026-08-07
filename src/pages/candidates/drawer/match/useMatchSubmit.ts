/**
 * useMatchSubmit — the match record's own network I/O, split out of
 * useMatchForm.ts (§3 size discipline: that file had grown past the 400-line
 * split trigger). Both directions are the SAME concern against the ONE
 * `/matches` resource — reading the full record for edit-mode prefill
 * (EDIT-MATCH-1) and writing it back via POST (create) or PATCH (update),
 * including the 422 field-error mapping — while everything left in
 * useMatchForm is about ASSEMBLING the values this hook only reads and
 * persists (relations/contract/financial state, the propose-but-freeze
 * sibling hooks). Takes the RAW setters it needs for the one-shot edit
 * prefill (never the touched-aware wrapped ones — an edit-mode prefill is
 * not a vacancy prefill, mirrors the original inline effect) and the current
 * field values it needs to build the request body; owns saving/errors/
 * submitErr internally and returns exactly what useMatchForm re-exports
 * unchanged (handleSubmitClick, saving, errors, submitErr).
 */
import { useState, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { API_TO_FORM } from './helpers'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import type { Id } from '@/types/common'

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

export function useMatchSubmit({
  editing, editMatchId, candidateId, t, onClose, onCreated,
  customerId, locationId, departmentId, contactId, branchId,
  func, contractType, startDate, endDate, hours, cao, scale, step,
  purchase, sell, costCenter, billingEmails, remarks, ownerId, vacancyId,
  branchMismatch, mismatchChoice, detail,
  deviatesFromProposal, confirmDeviation, setConfirmDeviation,
  skipCascadeResetRef,
  setCustomerIdRaw, setLocationIdRaw, setDepartmentIdRaw, setContactIdRaw,
  setBranchIdRaw, setBranchDirty, setVacancyIdRaw, setOwnerId, setFunc,
  setContractType, setStartDateRaw, setEndDateRaw, setEndDateDirty, setHoursRaw,
  setCao, setScale, setStep, setPurchase, setSell,
  setCostCenter, setCostCenterDirty, setBillingEmails, setBillingDirty, setRemarks,
}: {
  editing: boolean; editMatchId?: Id; candidateId: Id | string; t: TFunction
  onClose: () => void; onCreated: () => void
  customerId: string; locationId: string; departmentId: string; contactId: string; branchId: string
  func: string; contractType: string; startDate: string; endDate: string; hours: string; cao: string
  scale: string; step: string; purchase: string; sell: string; costCenter: string
  billingEmails: string[]; remarks: string; ownerId: string; vacancyId: string
  branchMismatch: boolean; mismatchChoice: 'match' | 'candidate'; detail: CustomerCascadeDetail | null
  // Rate-deviation confirm gate (useRateProposal, owned by useMatchForm) — the
  // first click on a deviating submit shows the inline confirm instead of posting.
  deviatesFromProposal: boolean; confirmDeviation: boolean; setConfirmDeviation: (v: boolean) => void
  // Shared with useMatchForm's own "customer changed → reset cascade" effect —
  // priming it here skips that effect's NEXT run once (same one-shot idiom as
  // initialCustomerId/useVacancyPrefillApply).
  skipCascadeResetRef: MutableRefObject<boolean>
  setCustomerIdRaw: (v: string) => void
  setLocationIdRaw: (v: string) => void
  setDepartmentIdRaw: (v: string) => void
  setContactIdRaw: (v: string) => void
  setBranchIdRaw: (v: string) => void; setBranchDirty: (v: boolean) => void
  setVacancyIdRaw: (v: string) => void
  setOwnerId: (v: string) => void
  setFunc: (v: string) => void
  setContractType: (v: string) => void
  setStartDateRaw: (v: string) => void
  setEndDateRaw: (v: string) => void; setEndDateDirty: (v: boolean) => void
  setHoursRaw: (v: string) => void
  setCao: (v: string) => void
  setScale: (v: string) => void
  setStep: (v: string) => void
  setPurchase: (v: string) => void
  setSell: (v: string) => void
  setCostCenter: (v: string) => void; setCostCenterDirty: (v: boolean) => void
  setBillingEmails: (v: string[]) => void; setBillingDirty: (v: boolean) => void
  setRemarks: (v: string) => void
}) {
  // 422 field errors (house pattern, mirrors AddCandidateModal/AddCustomerModal) +
  // a non-field fallback banner — replaces the old generic-toast-only handling.
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)

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
  // Uses the RAW setters throughout (never the touched-aware ones): an edit-mode
  // prefill is not a vacancy prefill, and the vacancy field itself is read-only
  // while editing (RelationsSection), so touched-tracking is simply irrelevant here.
  useEffect(() => {
    if (!editDetail) return
    skipCascadeResetRef.current = true
    setCustomerIdRaw(editDetail.customer_id != null ? String(editDetail.customer_id) : '')
    setLocationIdRaw(editDetail.customer_location_id != null ? String(editDetail.customer_location_id) : '')
    setDepartmentIdRaw(editDetail.customer_department_id != null ? String(editDetail.customer_department_id) : '')
    setContactIdRaw(editDetail.contact_id != null ? String(editDetail.contact_id) : '')
    setBranchIdRaw(editDetail.branch_id != null ? String(editDetail.branch_id) : ''); setBranchDirty(true)
    setVacancyIdRaw(editDetail.vacancy_id != null ? String(editDetail.vacancy_id) : '')
    setOwnerId(editDetail.owner?.id != null ? String(editDetail.owner.id) : '')
    setFunc(editDetail.function_title ?? '')
    setContractType(editDetail.contract_type ?? '')
    setStartDateRaw(editDetail.start_date ?? '')
    setEndDateRaw(editDetail.end_date ?? ''); setEndDateDirty(true)
    setHoursRaw(editDetail.hours_per_week != null ? String(editDetail.hours_per_week) : '')
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

  return { saving, errors, submitErr, handleSubmitClick }
}
