/**
 * useApplicationOwnerAndStage — owner-derivation chain (vacancy owner > candidate
 * owner > logged-in user), the locked-vacancy owner fetch, the start-stage seeding,
 * and the application.create AXIS preflight for pages/applications/AddApplicationModal.
 * Extracted verbatim (R6) from that file — behaviour is unchanged, only the location.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import api, { unwrap } from '@/lib/api'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { useActionRulePreflight } from '@/components/actionrules'
import { isUuid } from '@/lib/uuid'
import type { Id } from '@/types/common'
import type { PickOption } from '../addmodal/types'

interface AppUser { id: Id; name?: string }

// APP-OWNER-1 + start-stage seeding + AXIS-1 preflight, all keyed off the same
// candidate/vacancy picks — grouped in one hook since they share those inputs.
export function useApplicationOwnerAndStage({
  candidateId, lockedVacancy, pickedCandidate, pickedVacancy, users, me,
}: {
  candidateId: string
  lockedVacancy?: { id: Id; title: string; client?: string }
  pickedCandidate: PickOption | null
  pickedVacancy: PickOption | null
  users: AppUser[]
  me: { id?: Id; name?: string } | null
}) {
  // Owner dropdown = the assignable (tenant-scoped) users list only — POST
  // /applications 422s with "owner does not belong to this tenant" for anyone
  // NOT in it (measured: e.g. a super-admin login isn't always a tenant user row).
  const ownerOptions = useMemo(() => users.map(u => ({ value: String(u.id), label: u.name ?? '—' })), [users])
  const meIsAssignable = me?.id != null && ownerOptions.some(o => o.value === String(me.id))

  // AXIS-1: same application.create preflight the candidate-drawer variant runs —
  // POST /applications enforces this against the candidate server-side, so surface
  // the same warn/block decision here BEFORE submit, once a candidate is picked.
  const { decision: appRuleDecision } = useActionRulePreflight('application.create', { candidateId })
  const appRuleBlocked = appRuleDecision?.effect === 'block'

  // APP-OWNER-1: the LOCKED vacancy path only receives {id, title, client} from
  // its caller — its own recruiter is fetched once, alive-guarded, since the
  // non-locked search (which DOES carry owner) never runs for it.
  const [lockedVacancyOwnerId, setLockedVacancyOwnerId] = useState<Id | undefined>(undefined)
  // Locked-vacancy callers only pass {id, title, client}, never the owner — fetch it
  // once here (alive-guarded against an unmount mid-request).
  useEffect(() => {
    if (!lockedVacancy?.id) return
    let alive = true
    api.get(`/vacancies/${lockedVacancy.id}`)
      .then(r => { if (alive) setLockedVacancyOwnerId(unwrap<{ owner?: { id?: Id } | null }>(r)?.owner?.id) })
      // Deliberately silent: this only seeds an owner PROPOSAL, and the derivation
      // chain below still falls back to the candidate owner then the logged-in user,
      // so a failed fetch leaves the (still editable, still visible) owner picker empty
      // rather than breaking the form.
      .catch(() => {})
    return () => { alive = false }
  }, [lockedVacancy?.id])

  const vacancyOwnerId = lockedVacancy ? lockedVacancyOwnerId : pickedVacancy?.ownerId

  // APP-OWNER-1: derivation chain, highest priority first — the picked vacancy's
  // own recruiter (owner) > the picked candidate's own owner > the logged-in user
  // (this file's own earlier "default to me" behaviour). Every rung only proposes
  // a real, ASSIGNABLE tenant user (never a super-admin the server would 422 on).
  const candidateOwnerId = pickedCandidate?.ownerId
  const vacancyOwnerAssignable = vacancyOwnerId != null && ownerOptions.some(o => o.value === String(vacancyOwnerId))
  const candidateOwnerAssignable = candidateOwnerId != null && ownerOptions.some(o => o.value === String(candidateOwnerId))
  const derivedOwnerId = vacancyOwnerAssignable ? String(vacancyOwnerId)
    : candidateOwnerAssignable ? String(candidateOwnerId)
    : meIsAssignable ? String(me?.id)
    : ''

  // Seeded from the chain above, never re-seeded once the recruiter makes a MANUAL
  // pick (tracked by a ref — the vacancy/candidate pick can arrive AFTER a
  // lower-priority auto-seed already landed and still must be able to promote
  // itself over it; mirrors the candidate-drawer variant's identical guard).
  const [ownerId, setOwnerIdState] = useState('')
  const ownerManualRef = useRef(false)
  // Auto-seed the owner from the derived chain above, but never once the recruiter
  // has made a manual pick (ownerManualRef) — a later-arriving auto-seed must not override it.
  useEffect(() => {
    if (ownerManualRef.current) return
    if (derivedOwnerId && derivedOwnerId !== ownerId) setOwnerIdState(derivedOwnerId)
  }, [derivedOwnerId]) // eslint-disable-line react-hooks/exhaustive-deps
  // The picker's own onChange — any explicit pick permanently stops the auto-seed above.
  const setOwnerId = (v: string) => { ownerManualRef.current = true; setOwnerIdState(v) }

  // Start stage ("fase") — V17: "+ Sollicitant" used to POST candidate/vacancy/owner only,
  // so a recruiter adding an applicant from a vacancy could not say where they enter.
  const { stages } = useApplicationStages()
  // Only stages the backend would accept: while the lookup is still its seed the ids are
  // slugs, and offering an option that is a guaranteed 422 is a fake affordance. Empty =>
  // no picker at all and the field is omitted, so the server applies the tenant's
  // is_default stage itself (ApplicationController::store) — never a stage we invented.
  const stageOptions = useMemo(() => stages.filter(s => isUuid(s.id)), [stages])
  const defaultStageId = stageOptions.find(s => s.is_default)?.id ?? ''
  const [phaseId, setPhaseId] = useState('')
  // CLEAR-SWEEP (Danny 13-08): a manual pick — INCLUDING an explicit clear back to
  // '' via the VAC-CLEAR-1 cross — must stick. Without this guard the effect below
  // treated a cleared '' exactly like "not yet seeded" and instantly reproposed the
  // default, so the clear cross never actually reached the persisted state.
  const phaseManualRef = useRef(false)
  const setPhaseIdManual = (v: string) => { phaseManualRef.current = true; setPhaseId(v) }
  // Propose the tenant's flagged default as soon as the real lookup lands (the seed is
  // gone by then); re-sync whenever the held value is not a real, submittable option —
  // but never once the recruiter has manually picked or cleared it.
  useEffect(() => {
    if (phaseManualRef.current) return
    if (phaseId && stageOptions.some(s => s.id === phaseId)) return
    setPhaseId(defaultStageId)
  }, [defaultStageId, stageOptions, phaseId])

  return {
    ownerOptions, ownerId, setOwnerId,
    appRuleDecision, appRuleBlocked,
    stageOptions, phaseId, setPhaseIdManual,
  }
}
