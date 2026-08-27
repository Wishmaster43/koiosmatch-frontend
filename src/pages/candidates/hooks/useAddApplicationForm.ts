/**
 * useAddApplicationForm — APPMODAL-SPLIT-1: the pure state/derivation/effects/
 * submit region (measured AddApplicationModal.tsx 172-346) extracted verbatim
 * out of the container, behaviour unchanged. Owns vacancy/phase/source/owner
 * state, the create-vs-edit prefill effects, the tenant required-fields
 * preflight and the POST/PATCH submit — including source + custom_fields
 * (W30). The owner-derivation chain itself lives in its own sub-hook,
 * useApplicationOwnerChain, consumed here. Reference pattern:
 * pages/vacancies/addmodal/useAddVacancyForm.ts (form hook owns state, the
 * container stays thin).
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useApplicationOwnerChain } from './useApplicationOwnerChain'
import type { VacancyOption } from './useVacancyOptions'
import type { Id } from '@/types/common'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  candidate_id: 'candidateId', vacancy_id: 'vacancyId', owner_id: 'ownerId',
  application_stage_id: 'phase', source: 'source',
}

export function useAddApplicationForm({
  candidateId, candidateOwnerId, initialVacancyId, suggestedVacancyId, editApplicationId,
  vacancyOptions, stages, defaultStage, userOptions, meId, meIsAssignable,
  vacancyRequired, phaseRequired, ownerRequired, sourceRequired,
  onCreated, onClose,
}: {
  candidateId: Id
  candidateOwnerId?: Id | null
  initialVacancyId?: Id
  suggestedVacancyId?: Id | null
  editApplicationId?: Id
  vacancyOptions: VacancyOption[]
  stages: { id: string; value: string; label: string }[]
  defaultStage: { id: string } | undefined
  userOptions: { value: string; label: string }[]
  meId?: Id
  meIsAssignable: boolean
  vacancyRequired: boolean
  phaseRequired: boolean
  ownerRequired: boolean
  sourceRequired: boolean
  onCreated: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('candidates')
  const editing = editApplicationId != null

  // VACANCY-PREFILL-1: seed once from the caller's prop (a lazy initializer, read
  // only at mount) — the picker still lets the recruiter pick a different vacancy.
  const [vacancyId, setVacancyId] = useState(() => {
    if (initialVacancyId != null) return String(initialVacancyId)
    // Koios suggestion seeds last — a marked proposal, never a silent guess.
    return suggestedVacancyId != null ? String(suggestedVacancyId) : ''
  })
  // Default to the tenant's flagged start stage (APP-CREATE-STAGE-1), falling back to the first.
  const [phaseId, setPhaseId] = useState(() => defaultStage?.id ?? '')
  // Acquisition source — optional unless the tenant requires it (APP-REQUIRED-FE-1).
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // EDIT MODE: the record as loaded, so the PATCH below can send only what changed.
  const [loaded, setLoaded] = useState<{ vacancyId: string; ownerId: string; phaseKey: string; source: string } | null>(null)
  const phaseSeededRef = useRef(false)

  // W30: tenant-custom-field values for this application, keyed by field def key —
  // mirrors pages/applications/AddApplicationModal's own state (source of the
  // POST's `custom_fields`, omitted entirely when nothing was filled in).
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})
  const setCustomField = (key: string, v: unknown) => setCustomFieldValues(p => ({ ...p, [key]: v }))

  // The picked vacancy's own option row — carries ownerId/ownerName (useVacancyOptions
  // reads it straight off VacancyListResource's `owner`, no extra fetch, see that hook).
  // W30 golf-1 verify: this is STICKY STATE, not a live lookup back into
  // vacancyOptions — after a pick the search query resets and the refreshed
  // unfiltered list may no longer contain the picked row (>100-vacancy tenant),
  // which blanked the label AND re-seeded the owner chain down to the me-rung
  // (a wrong owner_id written to the server). Mirrors the applications modal's
  // pickedCandidate ("its own state, not a live lookup").
  const [pickedVacancy, setPickedVacancy] = useState<VacancyOption | undefined>(undefined)
  // While the current list still carries the id, richer/fresher row data wins;
  // when the list loses the id (search reset), the sticky row survives.
  useEffect(() => {
    if (!vacancyId) { setPickedVacancy(p => (p === undefined ? p : undefined)); return }
    const hit = vacancyOptions.find(v => String(v.value) === String(vacancyId))
    // Value-compare before setting: options arrive as fresh identities per render
    // (react-query refetch, test mocks) and an unconditional set would loop.
    setPickedVacancy(p => {
      if (!hit) return p
      if (p && p.value === hit.value && p.label === hit.label && p.client === hit.client
        && p.ownerId === hit.ownerId && p.ownerName === hit.ownerName) return p
      return hit
    })
  }, [vacancyOptions, vacancyId])

  // APPMODAL-SPLIT-1: the owner-derivation chain + OWNER-DEVIATION-1 checks now
  // live in their own hook, consumed here.
  const { ownerId, setOwnerId, ownerDiffersFromCandidate, ownerDiffersFromVacancy } = useApplicationOwnerChain({
    pickedVacancy, candidateOwnerId, userOptions, meId, meIsAssignable,
  })

  // Measured live (PlanIntakeModal probe hit the identical bug — see its S24a(c)
  // comment): the lazy useState initializer above only reads `stages` at MOUNT time,
  // which is still the seed fallback (useCachedLookup's real /application-stages
  // fetch resolves a beat later). The seed's fake id ("applied") never matches a REAL
  // stage's UUID, so once the real data replaces the seed, `phaseId` is left holding
  // a value that matches nothing — the picker then shows its placeholder instead of
  // the default. Re-sync to the CURRENT default whenever it no longer matches a real
  // option; skipped once the recruiter (or an already-valid default) picked one.
  useEffect(() => {
    // Edit mode prefills the record's OWN stage below — never seed a default over it.
    if (editing) return
    if (phaseId && stages.some(s => s.id === phaseId)) return
    if (!defaultStage) return
    setPhaseId(defaultStage.id)
  }, [defaultStage, stages, phaseId, editing])

  // EDIT MODE prefill (punt 5): one GET of the full record — the candidate-embedded
  // row is thin (no owner, no phase key), exactly like MatchModal's own edit-mode
  // fetch. `alive` guards a fast id switch so a stale response can never win.
  useEffect(() => {
    if (!editing) return
    let alive = true
    api.get(`/applications/${editApplicationId}`)
      .then(r => {
        if (!alive) return
        const d = unwrap(r) as {
          vacancy?: { id?: Id } | null; owner?: { id?: Id } | null; phase_key?: string | null
          source?: string | null; source_name?: string | null
        }
        const snap = {
          vacancyId: d?.vacancy?.id != null ? String(d.vacancy.id) : '',
          ownerId: d?.owner?.id != null ? String(d.owner.id) : '',
          phaseKey: d?.phase_key ?? '',
          source: d?.source ?? d?.source_name ?? '',
        }
        setLoaded(snap)
        setVacancyId(snap.vacancyId)
        setSource(snap.source)
        // The stored owner counts as an explicit choice: the create-time derivation
        // chain (vacancy > candidate > me) must never overwrite it.
        setOwnerId(snap.ownerId)
      })
      .catch(err => { if (alive) notifyError(extractApiError(err, t('work.applicationLoadFailed'))) })
    return () => { alive = false }
  }, [editing, editApplicationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Map the loaded `phase_key` onto the REAL stage id once the tenant lookup has
  // resolved — the seed fallback's fake ids would otherwise stick (the same
  // measured trap the create-mode default effect documents above). Seeded once,
  // so a manual pick made while the lookup was still loading survives.
  useEffect(() => {
    if (!editing || phaseSeededRef.current) return
    const stage = loaded?.phaseKey ? stages.find(s => s.value === loaded.phaseKey) : undefined
    if (!stage) return
    phaseSeededRef.current = true
    setPhaseId(stage.id)
  }, [editing, loaded, stages])

  // Create via the canonical POST /applications — vacancy_id may be null (open
  // application) — or, in EDIT mode, PATCH /applications/{id} with the changed
  // fields only (measured contract: UpdateApplicationRequest takes vacancy_id /
  // owner_id / application_stage_id, each `sometimes`).
  const submit = async () => {
    // APP-REQUIRED-FE-1: client-side required-field preflight (UX only, §7 — the
    // backend's own FlatRequiredFieldsGuard('application') on
    // ApplicationController::store is the real enforcement, create only, so this
    // gates on `!editing` exactly like appRuleBlocked above).
    if (!editing) {
      const missing: Record<string, boolean> = {}
      if (vacancyRequired && !vacancyId) missing.vacancyId = true
      if (phaseRequired && !phaseId) missing.phase = true
      if (ownerRequired && !ownerId) missing.ownerId = true
      if (sourceRequired && !source.trim()) missing.source = true
      if (Object.keys(missing).length > 0) { setErrors(missing); return }
    }
    setSaving(true)
    setErrors({})
    try {
      if (editing) {
        const payload: Record<string, unknown> = {}
        if ((loaded?.vacancyId ?? '') !== vacancyId) payload.vacancy_id = vacancyId || null
        if ((loaded?.ownerId ?? '') !== ownerId) payload.owner_id = ownerId || null
        const loadedStageId = loaded?.phaseKey ? (stages.find(s => s.value === loaded.phaseKey)?.id ?? '') : ''
        if (phaseId && phaseId !== loadedStageId) payload.application_stage_id = phaseId
        if ((loaded?.source ?? '') !== source.trim()) payload.source = source.trim() || null
        // Nothing changed: close without a pointless write (and without a fake
        // "bijgewerkt" toast for a request that never happened).
        if (Object.keys(payload).length > 0) {
          await api.patch(`/applications/${editApplicationId}`, payload)
          notifySuccess(t('work.applicationUpdated'))
        }
        onCreated(); onClose()
        return
      }
      await api.post('/applications', {
        candidate_id: candidateId, vacancy_id: vacancyId || null, owner_id: ownerId || null,
        application_stage_id: phaseId || undefined,
        ...(source.trim() ? { source: source.trim() } : {}),
        // W30: source is omitted the same way — an empty field means "let the
        // server default", never an explicit value; custom_fields only rides
        // along once the recruiter actually filled something in (an empty {} is
        // indistinguishable from "not asked" server-side, so it's omitted too).
        ...(Object.keys(customFieldValues).length ? { custom_fields: customFieldValues } : {}),
      })
      notifySuccess(t('work.applicationCreated'))
      onCreated(); onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) instead of a fixed toast string.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      }
      notifyError(e?.response?.data?.message ?? t(editing ? 'work.applicationUpdateFailed' : 'work.applicationFailed'))
    } finally { setSaving(false) }
  }

  return {
    editing, vacancyId, setVacancyId, phaseId, setPhaseId, source, setSource,
    ownerId, setOwnerId, pickedVacancy, ownerDiffersFromCandidate, ownerDiffersFromVacancy,
    saving, errors, submit, customFieldValues, setCustomField,
  }
}
