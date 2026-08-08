/**
 * AddApplicationModal — "+ Solliciteren" from the candidate Match tab: couple the
 * candidate to a vacancy in a chosen funnel phase. APP-VACANCY-OPTIONAL-1 (CMBE
 * 2e72cb1e): vacancy_id is nullable server-side — an OPEN application (no vacancy
 * yet, coupled later via PATCH) is a real flow, so the picker is optional and the
 * save button no longer waits for it. Picking "hired" without a vacancy is refused
 * by the backend with a Dutch 422 message, surfaced by the existing error handler.
 * On success the host reloads the applications list.
 *
 * S24b (Danny 16-07): vacancy + phase are both searchable pickers (CreatableSelect,
 * allowCreate=false — a vacancy/stage is a real relational id, never free text); the
 * phase picker now actually WORKS server-side — POST /applications previously only
 * accepted `phase_key`, which the backend silently ignored on create (APP-CREATE-
 * STAGE-1 fixed this), so this now sends the real `application_stage_id` and
 * preselects the tenant's flagged default stage (falling back to the first stage).
 *
 * AXIS-MATRIX-2 (CMFE audit R1): wires the shared action-rule preflight for
 * `application.create` (mirrors MatchModal's match.create) — a warn cell
 * shows an inline banner and still lets the recruiter proceed; a block cell (e.g. an
 * archived/blacklisted candidate) additionally disables Create, matching what the
 * backend's own ApplicationController::store guard will refuse anyway.
 *
 * OWNER-DEVIATION-1 (Danny: "de recruiter moet default zijn degene die de plus
 * drukt"): the original shape — a Recruiter picker defaulted straight to the
 * logged-in user — is now the LAST rung of APP-OWNER-1's derivation chain below.
 * The soft warning (never a block) stays: when the FINAL chosen recruiter still
 * differs from the candidate's own owner (prop from the drawer's already-loaded
 * record) or the picked vacancy's owner, an inline notice names who owns what;
 * Create stays enabled either way.
 *
 * APP-OWNER-1 (Danny's GO): the owner picker now seeds from a priority chain —
 * (1) the picked vacancy's own recruiter (owner) — VacancyListResource already
 * resolves it on the same /vacancies row useVacancyOptions reads, no extra fetch;
 * (2) else the candidate's own owner (`candidateOwnerId` prop); (3) else the
 * logged-in user (the old OWNER-DEVIATION-1 default). Every rung only proposes a
 * real, ASSIGNABLE tenant user (never a super-admin the server would 422 on).
 * Seeded once: a manual pick is never overwritten, and picking/changing the
 * vacancy AFTER a manual owner change never reseeds it.
 *
 * VACANCY-PREFILL-1 (Danny 06-08, "Solliciteren" from the vacancy-search score
 * panel): `initialVacancyId` seeds the vacancy picker once on mount — a soft
 * prefill, not a lock, so a misklik stays recoverable via the same searchable
 * combobox.
 *
 * EDIT MODE (Danny punt 5, 08-08 — the pencil on a candidate application row):
 * with `editApplicationId` set this form PREFILLS from GET /applications/{id}
 * (vacancy, recruiter, funnel phase) and submits `PATCH /applications/{id}`
 * instead of POSTing — the exact shape MatchModal's own pencil/edit mode uses.
 * Only CHANGED fields go in the payload: UpdateApplicationRequest validates each
 * field `sometimes`, and re-sending an unchanged stage would write a phantom
 * stage transition into the application's own stage history. The create-only
 * seeds (owner derivation chain, default start stage) stand down in edit mode so
 * they can never overwrite what the record already holds.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import CreatableSelect from '@/components/ui/CreatableSelect'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { useActionRulePreflight, ActionRuleBanner } from '@/components/actionrules'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import type { Id } from '@/types/common'

const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
// Consistent searchable-menu width (mirrors PlanIntakeModal/MatchModal's vacancy picker).
const pickerMenuWidth = 340
// S24c (Danny 24-07): the exact "+ Kandidaat toevoegen" combobox footprint
// (mirrors addmodal/fields.tsx's CreatableSelect wrapper) — every searchable
// picker in this modal must render at the same height as the reference modal.
const fieldFootprint: React.CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = { candidate_id: 'candidateId', vacancy_id: 'vacancyId', owner_id: 'ownerId', application_stage_id: 'phase' }

export default function AddApplicationModal({ candidateId, candidateOwnerId, candidateOwnerName, initialVacancyId, editApplicationId, onClose, onCreated }: {
  candidateId: Id
  // OWNER-DEVIATION-1: the candidate's own owner, passed down from the already-
  // loaded drawer record (WorkTab's `c.ownerId`/`c.owner`) — never refetched.
  candidateOwnerId?: Id | null
  candidateOwnerName?: string
  // VACANCY-PREFILL-1: a vacancy already chosen by the caller (e.g. the score panel
  // in VacancySearchTab) — seeds the picker once, still freely changeable.
  initialVacancyId?: Id
  // Punt 5: set from an application row's pencil — prefill + PATCH instead of POST.
  editApplicationId?: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation('candidates')
  const editing = editApplicationId != null
  const vacancyOptions = useVacancyOptions(true)
  // S24b: the real stage id (not just the slug) — needed to submit application_stage_id.
  const { stages, defaultStage } = useApplicationStages()

  // APP-OWNER-1: recruiter default inputs — the tenant's assignable users list and
  // the logged-in user (chain's last rung; mirrors pages/applications/
  // AddApplicationModal.tsx's identical meIsAssignable guard, a non-tenant login,
  // e.g. a super-admin, is never proposed as an owner).
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  const { data: users = [] } = useUsers() as { data?: { id: Id; name: string }[] }
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))
  const meIsAssignable = me?.id != null && userOptions.some(o => o.value === String(me.id))

  // AXIS-MATRIX-2 preflight (mirrors MatchModal's match.create wiring, the
  // reference implementation): POST /applications enforces application.create against
  // the candidate server-side (ApplicationController::store) — surface the same
  // warn/block decision here BEFORE submit. warn stays a banner only (proceed
  // allowed); block additionally disables the submit button (§3A "calm explanation",
  // never a silent 422 the recruiter has to decode).
  const { decision: appRuleDecision } = useActionRulePreflight('application.create', { candidateId: String(candidateId || '') })
  // Edit mode never creates anything, so the application.create rule may neither
  // warn nor block there — the decision itself stays loaded (Rules of Hooks), only
  // its effect on this form is gated.
  const appRuleBlocked = !editing && appRuleDecision?.effect === 'block'

  // VACANCY-PREFILL-1: seed once from the caller's prop (a lazy initializer, read
  // only at mount) — the picker still lets the recruiter pick a different vacancy.
  const [vacancyId, setVacancyId] = useState(() => (initialVacancyId != null ? String(initialVacancyId) : ''))
  // Default to the tenant's flagged start stage (APP-CREATE-STAGE-1), falling back to the first.
  const [phaseId, setPhaseId] = useState(() => defaultStage?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // EDIT MODE: the record as loaded, so the PATCH below can send only what changed.
  const [loaded, setLoaded] = useState<{ vacancyId: string; ownerId: string; phaseKey: string } | null>(null)
  const phaseSeededRef = useRef(false)

  // The picked vacancy's own option row — carries ownerId/ownerName (useVacancyOptions
  // reads it straight off VacancyListResource's `owner`, no extra fetch, see that hook).
  const pickedVacancy = vacancyOptions.find(v => String(v.value) === String(vacancyId))

  // APP-OWNER-1: derivation chain, highest priority first — the picked vacancy's
  // own recruiter (owner) > the candidate's own owner (prop) > the logged-in user
  // (the old OWNER-DEVIATION-1 default). Every rung only proposes a real,
  // ASSIGNABLE tenant user. Evaluated fresh every render from its three inputs.
  const vacancyOwnerId = pickedVacancy?.ownerId
  const vacancyOwnerAssignable = vacancyOwnerId != null && userOptions.some(o => o.value === String(vacancyOwnerId))
  const candidateOwnerAssignable = candidateOwnerId != null && userOptions.some(o => o.value === String(candidateOwnerId))
  const derivedOwnerId = vacancyOwnerAssignable ? String(vacancyOwnerId)
    : candidateOwnerAssignable ? String(candidateOwnerId)
    : meIsAssignable ? String(me?.id)
    : ''

  // Seeded from the chain above, never re-seeded once the recruiter makes a MANUAL
  // pick (tracked by a ref, not by "ownerId is already set" — unlike
  // usePlanIntakeForm's RECRUITER-DEFAULT-1, whose two inputs both resolve together
  // off the same /users load, this chain's highest-priority input — the vacancy
  // pick — can arrive LATER than a lower-priority auto-seed already did, and it
  // still must be able to promote itself over that earlier auto-seed).
  const [ownerId, setOwnerIdState] = useState('')
  const ownerManualRef = useRef(false)
  useEffect(() => {
    if (ownerManualRef.current) return
    if (derivedOwnerId && derivedOwnerId !== ownerId) setOwnerIdState(derivedOwnerId)
  }, [derivedOwnerId]) // eslint-disable-line react-hooks/exhaustive-deps
  // The picker's own onChange — any explicit pick permanently stops the auto-seed above.
  const setOwnerId = (v: string) => { ownerManualRef.current = true; setOwnerIdState(v) }

  // OWNER-DEVIATION-1: a soft warning, never a block (Danny: "wel een melding") —
  // the FINAL recruiter still differs from the candidate's own owner and/or the
  // picked vacancy's owner (e.g. after a manual override). Both sides must be a
  // KNOWN owner to compare (an unowned candidate/vacancy is not a "deviation",
  // mirroring useBranchMismatch's own "both sides nullable" rule) — never claims a
  // mismatch against an unknown "—".
  const ownerDiffersFromCandidate = Boolean(
    ownerId && candidateOwnerId != null && String(candidateOwnerId) !== String(ownerId))
  const ownerDiffersFromVacancy = Boolean(
    ownerId && pickedVacancy?.ownerId != null && String(pickedVacancy.ownerId) !== String(ownerId))

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
        const d = unwrap(r) as { vacancy?: { id?: Id } | null; owner?: { id?: Id } | null; phase_key?: string | null }
        const snap = {
          vacancyId: d?.vacancy?.id != null ? String(d.vacancy.id) : '',
          ownerId: d?.owner?.id != null ? String(d.owner.id) : '',
          phaseKey: d?.phase_key ?? '',
        }
        setLoaded(snap)
        setVacancyId(snap.vacancyId)
        // The stored owner counts as an explicit choice: the create-time derivation
        // chain (vacancy > candidate > me) must never overwrite it.
        ownerManualRef.current = true
        setOwnerIdState(snap.ownerId)
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
    setSaving(true)
    setErrors({})
    try {
      if (editing) {
        const payload: Record<string, unknown> = {}
        if ((loaded?.vacancyId ?? '') !== vacancyId) payload.vacancy_id = vacancyId || null
        if ((loaded?.ownerId ?? '') !== ownerId) payload.owner_id = ownerId || null
        const loadedStageId = loaded?.phaseKey ? (stages.find(s => s.value === loaded.phaseKey)?.id ?? '') : ''
        if (phaseId && phaseId !== loadedStageId) payload.application_stage_id = phaseId
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

  // One title/labels source for both modes (§5: never a hardcoded twin).
  const title = t(editing ? 'work.editApplication' : 'work.addApplication')

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; same overlay/Esc/backdrop semantics as before.
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="candidate-add-application" width={420} maxWidth="92vw" bodyStyle={{ padding: 22 }}>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter
            picks a vacancy. Create only: editing an existing application is not a create. */}
        {!editing && appRuleDecision && appRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 14 }}><ActionRuleBanner decision={appRuleDecision} /></div>
        )}

        {/* Vacancy — searchable pick-only combobox (S24b), mirrors PlanIntakeModal.
            APP-VACANCY-OPTIONAL-1: the label says "(optioneel)" honestly — an open
            application without a vacancy is a real backend flow now.
            S24c (Danny 24-07): resized to the AddCandidateModal text-input footprint
            (padding '8px 11px' / fontSize 13) so every drawer combobox reads as one system. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.vacancyOptional')}</div>
          <CreatableSelect value={vacancyId || null} onChange={setVacancyId} placeholder={t('work.pickVacancy')}
            allowCreate={false} menuWidth={pickerMenuWidth} style={fieldFootprint}
            options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
          {errors.vacancyId && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('work.applicationFailed')}</div>}
        </div>
        {/* Fase — searchable pick-only combobox; now submits the real stage id (S24b). */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.phase')}</div>
          <CreatableSelect value={phaseId || null} onChange={setPhaseId} allowCreate={false} menuWidth={pickerMenuWidth}
            style={fieldFootprint} options={stages.map(s => ({ value: s.id, label: s.label }))} />
          {errors.phase && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('work.applicationFailed')}</div>}
        </div>
        {/* APP-OWNER-1: recruiter picker, seeded from the derivation chain above
            (vacancy recruiter > candidate owner > logged-in user) but always
            changeable via the house user-picker, same footprint as the fields above. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.owner')}</div>
          <CreatableSelect value={ownerId || null} onChange={setOwnerId} placeholder={t('work.pickOwner')}
            allowCreate={false} menuWidth={pickerMenuWidth} style={fieldFootprint} options={userOptions} />
          {errors.ownerId && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('work.applicationFailed')}</div>}
        </div>
        {/* Soft warning (never a block, Danny: "wel een melding") — mirrors the
            AXIS-MATRIX banner's warn tint (ActionRuleBanner) so both notices in this
            modal read as the same idiom. Only fires once both sides of a comparison
            are a KNOWN owner (§ useBranchMismatch's "both sides nullable" rule). */}
        {(ownerDiffersFromCandidate || ownerDiffersFromVacancy) && (
          <div role="alert" aria-label={t('work.ownerDeviation')} style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '8px 10px', borderRadius: 8, marginBottom: 20,
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
            <AlertTriangle size={15} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {ownerDiffersFromCandidate && (
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  {t('work.ownerDeviationCandidate', { name: candidateOwnerName || '—' })}
                </div>
              )}
              {ownerDiffersFromVacancy && (
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  {t('work.ownerDeviationVacancy', { name: pickedVacancy?.ownerName || '—' })}
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={saving || appRuleBlocked}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: !appRuleBlocked ? 'pointer' : 'default', opacity: !appRuleBlocked ? 1 : 0.4 }}>
            {saving ? t('common:saving') : t(editing ? 'common:save' : 'work.createApplication')}
          </button>
        </div>
    </FloatingPanel>
  )
}
