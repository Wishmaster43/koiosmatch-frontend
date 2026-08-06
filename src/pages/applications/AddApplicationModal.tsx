import { useState, useEffect, useMemo, useId, useRef } from 'react'
import type { ComponentType, ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { useLookups } from '@/context/LookupsContext'
// Funnel stages WITH their real row id — LookupsContext's `funnelTypes` drops it, and
// `application_stage_id` needs the id. Same hook the candidate drawer's "+ Solliciteren"
// modal uses (single source); it lives under pages/candidates today, which is a §2
// cross-page import — moving it to src/hooks/ is a separate, repo-wide change.
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { mapApplication } from './data/mapApplication'
import { BTN_H } from '@/config/buttonMetrics'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { isUuid } from '@/lib/uuid'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

// ownerId/ownerName (APP-OWNER-1): both /candidates and /vacancies already carry
// an `owner` object (CandidateListResource / VacancyListResource) — captured here
// so the owner-derivation chain below can read it straight off the picked option,
// no extra fetch for either the candidate or the non-locked vacancy pick.
interface PickOption { value: Id; label: string; client?: string; ownerId?: Id; ownerName?: string }
interface AppUser { id: Id; name?: string }

// 422 field-error keys are snake_case; map them back to this form's field names
// (C-18 — there is no free-text field to highlight here, only pickers, so this
// only sharpens which picker the message is about; the inline message stays).
const API_TO_FORM: Record<string, string> = {
  candidate_id: 'candidateId', vacancy_id: 'vacancyId', owner_id: 'ownerId',
  application_stage_id: 'phase',
}

// A submittable stage id is the uuid the backend validates against
// (StoreApplicationRequest: uuid|exists:application_stages,id). useApplicationStages
// seeds slug ids ("applied") until /application-stages resolves — those would 422.

// Field label + shared searchable single-select (CreatableSelect) — replaces the
// old inline SearchField dropdown (DUP-1). allowCreate off = pick-only. `style`
// (e.g. a 422 field-error border) merges with the base width, it never replaces it.
// S2 (Danny): comfortable menu width now that the panel is wide (mirrors
// MatchModal's pickerMenuWidth) — the shared component's 220px default
// read cramped for a full candidate/vacancy "title · client" label. `value || null`
// (measured live, S2): this form's state starts at '' (empty string, not null/
// undefined), and CreatableSelect's `value ?? placeholder` only falls through to
// the placeholder on null/undefined — '' short-circuited it, so every picker
// showed BLANK instead of "Selecteer een kandidaat/vacature/recruiter". Mirrors
// MatchModal's own `value={x || null}` pickers (job 17/18).
function PickField({ label, style, value, ...rest }: { label: ReactNode; style?: CSSProperties; value?: string } & AnyProps) {
  // §6: a <button> trigger cannot be labelled by a bare <div>, so the picker used to
  // announce only its value ("Piet Recruiter") with no field name. CreatableSelect
  // prefixes aria-labelledby with the label, so it now reads "Recruiter, Piet Recruiter".
  const labelId = useId()
  return (
    <div>
      <div id={labelId} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <CreatableSelect allowCreate={false} menuWidth={320} aria-labelledby={labelId} value={value || null} style={{ width: '100%', ...style }} {...rest} />
    </div>
  )
}

/**
 * AddApplicationModal — create a new application by linking an existing candidate
 * to a vacancy. Pickers load from /candidates and /vacancies. Persists to
 * POST /applications; a failure keeps the modal open with the server's message
 * (never a fabricated local row). `lockedVacancy` preselects + LOCKS the vacancy
 * field when opened from the vacancy drawer's Sollicitaties tab ("+ Sollicitatie",
 * vacancies/drawer/ApplicantsTab) — only the candidate needs picking then
 * (mirrors PlanIntakeModal's defaultVacancyId, but locked rather than editable
 * since the whole point of that entry point is "for THIS vacancy").
 *
 * APP-OWNER-1 (Danny's GO — supersedes this file's own earlier "default to me"
 * APP-OWNER-1 note below): the owner picker now seeds from a priority chain,
 * mirroring the candidate-drawer variant (pages/candidates/drawer/
 * AddApplicationModal.tsx) — (1) the picked vacancy's own recruiter (owner); (2)
 * else the picked candidate's own owner; (3) else the logged-in user. Both the
 * candidate and the non-locked vacancy list already carry `owner` on their API
 * rows (captured into PickOption above), so neither rung needs an extra fetch.
 * The ONE case that does: the LOCKED vacancy path only receives {id, title,
 * client} from its caller (ApplicantsTab, out of scope here) — its recruiter is
 * fetched once via GET /vacancies/{id}, alive-guarded. Every rung only proposes a
 * real, ASSIGNABLE tenant user (never a super-admin the server would 422 on).
 * Seeded once: a manual pick is never overwritten, and picking/changing the
 * candidate or vacancy AFTER a manual owner change never reseeds it.
 */
export default function AddApplicationModal({ onClose, onCreated, lockedVacancy }: {
  onClose: () => void
  onCreated: (app: Application) => void
  lockedVacancy?: { id: Id; title: string; client?: string }
}) {
  const { t } = useTranslation('applications')
  // Funnel lookup — drives the flag-based bucket resolution in mapApplication (A1).
  const { funnelTypes } = useLookups()
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  // Owner dropdown = the assignable (tenant-scoped) users list only — POST
  // /applications 422s with "owner does not belong to this tenant" for anyone
  // NOT in it (measured: e.g. a super-admin login isn't always a tenant user
  // row), so — unlike the cosmetic-only AddCandidateModal merge (0115255) — an
  // owner outside this list is never offered as a pickable/submittable option.
  const ownerOptions = users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))
  const meIsAssignable = me?.id != null && ownerOptions.some(o => o.value === String(me.id))
  const [candidates, setCandidates] = useState<PickOption[]>([])
  const [vacancies, setVacancies]   = useState<PickOption[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId]     = useState(lockedVacancy ? String(lockedVacancy.id) : '')
  const [saving, setSaving]           = useState(false)

  // APP-OWNER-1: the LOCKED vacancy path only receives {id, title, client} from
  // its caller — its own recruiter is fetched once, alive-guarded, since the
  // non-locked list mapping below (which DOES carry owner) never runs for it.
  const [lockedVacancyOwnerId, setLockedVacancyOwnerId] = useState<Id | undefined>(undefined)
  useEffect(() => {
    if (!lockedVacancy?.id) return
    let alive = true
    api.get(`/vacancies/${lockedVacancy.id}`)
      .then(r => { if (alive) setLockedVacancyOwnerId(unwrap<{ owner?: { id?: Id } | null }>(r)?.owner?.id) })
      .catch(() => {})
    return () => { alive = false }
  }, [lockedVacancy?.id])

  // The picked candidate/vacancy's own option row — carries ownerId (see PickOption).
  const pickedCandidate = candidates.find(c => String(c.value) === String(candidateId))
  const pickedVacancy = vacancies.find(v => String(v.value) === String(vacancyId))
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
  // Propose the tenant's flagged default as soon as the real lookup lands (the seed is
  // gone by then); re-sync whenever the held value is not a real, submittable option.
  useEffect(() => {
    if (phaseId && stageOptions.some(s => s.id === phaseId)) return
    setPhaseId(defaultStageId)
  }, [defaultStageId, stageOptions, phaseId])

  // Load candidate options always; the vacancy list only when NOT locked (data
  // minimisation, §8/§9 — a locked value never needs the full option list).
  useEffect(() => {
    api.get('/candidates', { params: { per_page: 100 } })
      .then(r => setCandidates(unwrapList<{ id?: Id; name?: string; first_name?: string; last_name?: string; owner?: { id?: Id; name?: string } | null }>(r).rows.map(c => ({
        value: c.id ?? '', label: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' '),
        ownerId: c.owner?.id, ownerName: c.owner?.name,
      }))))
      .catch(() => setCandidates([]))
    if (lockedVacancy) return
    api.get('/vacancies', { params: { per_page: 100 } })
      .then(r => setVacancies(unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string; owner?: { id?: Id; name?: string } | null }>(r).rows.map(v => ({
        value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client,
        ownerId: v.owner?.id, ownerName: v.owner?.name,
      }))))
      .catch(() => setVacancies([]))
    // Only the presence of a locked vacancy matters (checked once, on mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create the application. AUDIT-1 (CRITICAL, 15-07): the old catch fabricated a
  // fake local row (id: -Date.now()) and closed the modal as if it succeeded —
  // masking real failures INCLUDING the matrix-guard 422s. A failure now keeps the
  // modal open and shows the server's message inline.
  const [createError, setCreateError] = useState<string | null>(null)
  const [errors,      setErrors]      = useState<Record<string, boolean>>({})
  const create = async () => {
    if (!candidateId || !vacancyId || saving) return
    setSaving(true)
    setCreateError(null)
    setErrors({})
    try {
      // application_stage_id is omitted (not null-ed) when unset so the backend's own
      // `?? ApplicationStage::defaultStageId()` fallback decides the start stage.
      const res = await api.post('/applications', {
        candidate_id: candidateId, vacancy_id: vacancyId, owner_id: ownerId || null,
        ...(phaseId ? { application_stage_id: phaseId } : {}),
      })
      onCreated(mapApplication(unwrap(res), funnelTypes))
    } catch (err) {
      // Show field-level errors from 422 validation responses (highlights the
      // specific picker); fall back to the server's message otherwise.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      }
      setCreateError(extractApiError(err, t('common:errorGeneric')))
    } finally { setSaving(false) }
  }

  // Declared once — it renders either on its own row or paired with the phase picker.
  const ownerField = (
    <PickField label={t('add.owner')} placeholder={t('add.ownerPlaceholder')}
      options={ownerOptions} value={ownerId} onChange={setOwnerId}
      style={errors.ownerId ? { borderColor: 'var(--color-danger)' } : undefined} />
  )

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // remembered position; keeps the S2 720px two-column footprint.
    <FloatingPanel open onClose={onClose} title={t('add.title')} ariaLabel={t('add.title')}
      persistKey="add-application" width={720} maxWidth="94vw">

        {/* Candidate + vacancy side by side — the two "big" relational pickers get
            equal, comfortable room; owner (+ start stage) sit on the row below. */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PickField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')}
              options={candidates} value={candidateId} onChange={setCandidateId}
              style={errors.candidateId ? { borderColor: 'var(--color-danger)' } : undefined} />
            {lockedVacancy ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('add.vacancy')}</div>
                <div style={{ padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)' }}>
                  {lockedVacancy.client ? `${lockedVacancy.title} · ${lockedVacancy.client}` : lockedVacancy.title}
                </div>
              </div>
            ) : (
              <PickField label={t('add.vacancy')} placeholder={t('add.vacancyPlaceholder')}
                options={vacancies} value={vacancyId} onChange={setVacancyId}
                style={errors.vacancyId ? { borderColor: 'var(--color-danger)' } : undefined} />
            )}
          </div>
          {/* Owner + start stage share a row (§3A: pair short fields into two columns).
              The phase picker only exists when the tenant lookup gave us real, submittable
              stages — otherwise owner keeps the full width and the server picks the stage. */}
          {stageOptions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {ownerField}
              <PickField label={t('add.phase')} placeholder={t('add.phasePlaceholder')}
                options={stageOptions.map(s => ({ value: s.id, label: s.label }))}
                value={phaseId} onChange={setPhaseId}
                style={errors.phase ? { borderColor: 'var(--color-danger)' } : undefined} />
            </div>
          ) : ownerField}
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 4px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {createError}
          </div>
        )}

        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>{t('add.cancel')}</button>
          <button onClick={create} disabled={!candidateId || !vacancyId || saving}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8,
              background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: (candidateId && vacancyId) ? 1 : 0.4 }}>
            {t('add.create')}
          </button>
        </div>
    </FloatingPanel>
  )
}
