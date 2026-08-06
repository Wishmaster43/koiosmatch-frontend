/**
 * useVacancyPrefillApply — applies `useVacancyPrefill`'s real vacancy fields onto
 * the rest of the match form (points 1/2/4/1.8.4, Danny's ten-point round): klant/
 * klantlocatie/afdeling/contactpersoon/vestiging/dates/uren, ONLY the ones the
 * recruiter hasn't already edited by hand, and fully reversible (the vacancy
 * field's own ✕ / the shared `CreatableSelect`'s `clearable` X both funnel through
 * the ONE `setVacancyId` this hook returns).
 *
 * Two bookkeeping records, deliberately kept separate:
 *  - `touched[field]`: the recruiter edited this field BY HAND — a permanent
 *    freeze (mirrors `branchDirty`/`endDateDirty`/`costCenterDirty` elsewhere in
 *    this hook family), so no prefill (from this vacancy, a later re-pick, or a
 *    switch to a different one) ever overwrites it again.
 *  - `auto[field]`: the field's CURRENT value is the untouched byproduct of the
 *    LAST vacancy prefill — consulted only by `setVacancyId` below, to know
 *    exactly which fields it may blank on a clear/switch (point 1.8.4: "clears
 *    ONLY the values that were auto-filled ... and are still untouched"). Without
 *    this second record, clearing the vacancy could not be told apart from an
 *    `initialCustomerId` seed (a customer/location/department drilldown's own
 *    "+ Match" prefill, point 1 of an EARLIER round) — which must survive a
 *    vacancy pick/clear untouched, since it was never produced BY the vacancy.
 *
 * WIDE INTERFACE, BY DESIGN: this concern is inherently cross-cutting (one pick
 * touches 8 fields spanning Relaties + Contract). Owning that state itself here
 * instead would ripple `customerId` (rate proposal, cascade, branch mismatch, the
 * submit body, …) through a second indirection layer — a worse trade. The RAW
 * setters below are the plain useState/sibling-hook setters (never touched-aware
 * themselves); useMatchForm wraps its OWN exported setters around `markTouched`.
 */
import { useState, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { useVacancyPrefill } from './useVacancyPrefill'
import type { Id } from '@/types/common'

export function useVacancyPrefillApply({
  editing, vacancyId, setVacancyIdRaw,
  customerId, setCustomerIdRaw, skipCascadeResetRef,
  setLocationIdRaw, setDepartmentIdRaw, setContactIdRaw,
  setBranchIdRaw, setBranchDirty,
  setStartDateRaw, setEndDateRaw, setEndDateDirty,
  setHoursRaw,
  candBranchId,
}: {
  editing: boolean
  vacancyId: string; setVacancyIdRaw: (v: string) => void
  customerId: string; setCustomerIdRaw: (v: string) => void
  // Shared with useMatchForm's own "customer changed → reset cascade" effect —
  // priming it here skips that effect's NEXT run once, exactly like the existing
  // initialCustomerId/editDetail prefills already do (same one-shot idiom).
  skipCascadeResetRef: MutableRefObject<boolean>
  setLocationIdRaw: (v: string) => void
  setDepartmentIdRaw: (v: string) => void
  setContactIdRaw: (v: string) => void
  setBranchIdRaw: (v: string) => void; setBranchDirty: (v: boolean) => void
  setStartDateRaw: (v: string) => void
  setEndDateRaw: (v: string) => void; setEndDateDirty: (v: boolean) => void
  setHoursRaw: (v: string) => void
  // Point 2: vestiging inherits from the vacancy when set, else the candidate's own.
  candBranchId?: Id | null
}) {
  // Never fetch a vacancy's detail while editing — the field renders READ-ONLY
  // there (identity fields aren't PATCHable, see useMatchForm's own docblock), so
  // there is nothing to prefill onto.
  const vacancyDetail = useVacancyPrefill(editing ? '' : vacancyId)

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = (f: string) => setTouched(t => (t[f] ? t : { ...t, [f]: true }))
  const [auto, setAuto] = useState<Record<string, boolean>>({})
  const markAuto = (f: string) => setAuto(a => (a[f] ? a : { ...a, [f]: true }))

  // Called by useMatchForm's cascade-reset effect (customer changed BY HAND wipes
  // location/department/contact) — that reset is automatic bookkeeping, not a user
  // EDIT, so these fields must stay fair game for a later vacancy prefill.
  const resetTouched = (fields: string[]) => {
    setTouched(t => { const n = { ...t }; fields.forEach(f => delete n[f]); return n })
    setAuto(a => { const n = { ...a }; fields.forEach(f => delete n[f]); return n })
  }

  // Apply the vacancy's real fields — only onto still-untouched fields. Re-runs
  // whenever new vacancy data OR the candidate's own branch resolves (point 2's
  // fallback source), so the async race between those two independent fetches
  // self-heals the moment both are known, regardless of which settles first.
  useEffect(() => {
    if (editing || !vacancyDetail) return
    if (vacancyDetail.customerId && vacancyDetail.customerId !== customerId && !touched.customerId) {
      skipCascadeResetRef.current = true
      setCustomerIdRaw(vacancyDetail.customerId); markAuto('customerId')
    }
    if (vacancyDetail.customerLocationId && !touched.locationId) { setLocationIdRaw(vacancyDetail.customerLocationId); markAuto('locationId') }
    if (vacancyDetail.customerDepartmentId && !touched.departmentId) { setDepartmentIdRaw(vacancyDetail.customerDepartmentId); markAuto('departmentId') }
    if (vacancyDetail.contactId && !touched.contactId) { setContactIdRaw(vacancyDetail.contactId); markAuto('contactId') }
    const branchProposal = vacancyDetail.branchId || (candBranchId != null ? String(candBranchId) : '')
    if (branchProposal && !touched.branchId) { setBranchIdRaw(branchProposal); setBranchDirty(true); markAuto('branchId') }
    if (vacancyDetail.startDate && !touched.startDate) { setStartDateRaw(vacancyDetail.startDate); markAuto('startDate') }
    if (vacancyDetail.endDate && !touched.endDate) { setEndDateRaw(vacancyDetail.endDate); setEndDateDirty(true); markAuto('endDate') }
    if (vacancyDetail.hours && !touched.hours) { setHoursRaw(vacancyDetail.hours); markAuto('hours') }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- touched/customerId read at apply-time only; re-triggering on THEIR own change would fight the freeze this effect exists to create (mirrors the file's other propose-but-freeze effects)
  }, [vacancyDetail, candBranchId, editing])

  // Switching OR clearing the vacancy (point 1.8.4 — the CreatableSelect's shared
  // `clearable` X and a fresh pick both funnel through this ONE onChange): first
  // blanks whatever the PREVIOUS vacancy auto-filled and is STILL untouched, then
  // moves to the new pick (or nothing, when clearing). A value the recruiter typed
  // by hand always survives; so does an unrelated seed (e.g. `initialCustomerId`
  // from a customer-drilldown's own "+ Match") — neither was ever marked `auto`.
  const setVacancyId = (v: string) => {
    if (auto.customerId && !touched.customerId) setCustomerIdRaw('')
    if (auto.locationId && !touched.locationId) setLocationIdRaw('')
    if (auto.departmentId && !touched.departmentId) setDepartmentIdRaw('')
    if (auto.contactId && !touched.contactId) setContactIdRaw('')
    if (auto.branchId && !touched.branchId) { setBranchIdRaw(''); setBranchDirty(false) }
    if (auto.startDate && !touched.startDate) setStartDateRaw('')
    if (auto.endDate && !touched.endDate) { setEndDateRaw(''); setEndDateDirty(false) }
    if (auto.hours && !touched.hours) setHoursRaw('')
    setAuto({})
    setVacancyIdRaw(v)
  }

  return { setVacancyId, markTouched, resetTouched }
}
