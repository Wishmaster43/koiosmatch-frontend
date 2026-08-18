import { useState, useEffect, useMemo, useId, useRef } from 'react'
import type { ComponentType, ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { useLookups } from '@/context/LookupsContext'
// Funnel stages WITH their real row id — LookupsContext's `funnelTypes` drops it, and
// `application_stage_id` needs the id. Same hook the candidate drawer's "+ Solliciteren"
// modal uses (single source); it lives under pages/candidates today, which is a §2
// cross-page import — moving it to src/hooks/ is a separate, repo-wide change.
import { useApplicationStages } from '@/hooks/useApplicationStages'
// AXIS-1: this page-level modal used to skip the action-rule preflight the
// candidate-drawer variant runs (AddApplicationModal.tsx under pages/candidates/
// drawer/) — reuse the SAME shared hook/banner, never a second implementation.
import { useActionRulePreflight, ActionRuleBanner } from '@/components/actionrules'
import { useCustomFields } from '@/lib/useCustomFields'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { mapApplication } from './data/mapApplication'
import { BTN_H } from '@/config/buttonMetrics'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { isUuid } from '@/lib/uuid'
// §0.3 split: server-searched picker field/hook + the tenant custom-field
// control now live in their own folder (mirrors the candidate addmodal/ folder).
import SearchPickField from './addmodal/SearchPickField'
import { useSearchOptions } from './addmodal/useSearchOptions'
import CustomFieldInput from './addmodal/CustomFieldInput'
import type { PickOption, RawPickRow } from './addmodal/types'
// NEWCAND-1 (register pt.4): reuse the real candidate create flow (incl. its own
// CV-parse entry points) — never a second, thinner "create candidate" form here.
import AddCandidateModal from '@/pages/candidates/AddCandidateModal'
import { UserPlus } from 'lucide-react'
import type { Candidate } from '@/types/candidate'
import Button from '@/components/ui/Button'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

interface AppUser { id: Id; name?: string }

// ownerId/ownerName (APP-OWNER-1): both /candidates and /vacancies already carry
// an `owner` object (CandidateListResource / VacancyListResource) — captured here
// so the owner-derivation chain below can read it straight off the picked option,
// no extra fetch for either the candidate or the non-locked vacancy pick.
// SUBLINE-1 (register PDF-SOLLICITATIES pt.1, Danny 14-08): "vijf keer Blom" is
// unpickable by name alone — fold function title + city into the label itself,
// since the shared SearchSelect row only renders a plain string (no sub-line
// slot). " · " is a value separator here, never sentence punctuation (§5).
const mapCandidateRow = (c: RawPickRow): PickOption => {
  const name = c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')
  const detail = [c.function_title, c.city].filter(Boolean).join(' · ')
  return {
    value: c.id ?? '', label: detail ? `${name} · ${detail}` : name,
    ownerId: c.owner?.id, ownerName: c.owner?.name,
  }
}
const mapVacancyRow = (v: RawPickRow): PickOption => ({
  value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client,
  ownerId: v.owner?.id, ownerName: v.owner?.name,
})

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
 *
 * W30 (2026-08): the candidate/vacancy pickers are now server-searched
 * (SearchPickField/useSearchOptions above) instead of a single 100-row mount
 * fetch — see those doc comments. The picked row is kept in its OWN state
 * (pickedCandidate/pickedVacancy) rather than looked up back out of the live
 * search results, since a later search edit legitimately replaces those results
 * and must never lose the earlier pick's label or owner-chain data.
 *
 * `source` (CMBE 5961c673, superseding the earlier W30 note below; S-SOURCE-1 08-14
 * supersedes the plain-input note further below, GRADUATED 2026-08-14): StoreApplicationRequest
 * accepts an optional `source` (sometimes|nullable|string|max:64) — the controller
 * defaults to 'manual' server-side only when the field is omitted, mirroring
 * `application_stage_id`'s own omit-to-default contract. It is a searchable/creatable
 * PICKER (useApplicationSources, `@/lib/useApplicationSources`) instead of a bare
 * `<input>`: free text let "Indeed"/"indeed"/"Indeed.nl" fragment into three different
 * sources on the Sources report, and §3A already answers this trade-off (tenant lookup,
 * mirror the function field). The picker's options now come from the REAL tenant-CRUD
 * `/candidate-sources` lookup (CandidateSourceController, on the shared
 * FreeEntryLookupController base — CRUD, reorder, in-use 409, strict-tightening
 * mismatch guard, exactly like /functions), backfilled with every distinct source
 * value that existed before it shipped so nothing already recorded went missing.
 * Free entry defaults to OFF (strict) server-side, same as Functions — a tenant turns
 * it on in Settings → Applications → Sources. Mirrors ApplicationDetailsCard's own
 * edit control byte-for-byte. Omitted (not sent) when empty, exactly like
 * `application_stage_id` above — the server's own 'manual' fallback decides then.
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
  // W30: server-searched candidate/vacancy options (see useSearchOptions above).
  // The vacancy search is skipped entirely while locked (data minimisation, §8/§9).
  const candidateSearch = useSearchOptions('/candidates', mapCandidateRow, false)
  const vacancySearch   = useSearchOptions('/vacancies', mapVacancyRow, !!lockedVacancy)
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId]     = useState(lockedVacancy ? String(lockedVacancy.id) : '')
  const [saving, setSaving]           = useState(false)
  // The picked candidate/vacancy's own FULL option row (label + owner) — kept apart
  // from the live search results, which a later query legitimately replaces (see the
  // file doc comment above).
  const [pickedCandidate, setPickedCandidate] = useState<PickOption | null>(null)
  const [pickedVacancy, setPickedVacancy]     = useState<PickOption | null>(null)
  const pickCandidate = (opt: PickOption) => { setCandidateId(String(opt.value)); setPickedCandidate(opt) }
  const pickVacancy   = (opt: PickOption) => { setVacancyId(String(opt.value)); setPickedVacancy(opt) }

  // NEWCAND-1: "+ New candidate" opens the real AddCandidateModal on top of this
  // one; a successful create picks the fresh candidate straight into this form
  // (same shape SearchPickField expects — no extra fetch needed since the
  // created record already carries id/name/title/city/ownerId).
  const [addingCandidate, setAddingCandidate] = useState(false)
  const onCandidateCreated = (c: Candidate) => {
    setAddingCandidate(false)
    pickCandidate(mapCandidateRow({
      id: c.id, name: c.name, function_title: c.title, city: c.city,
      owner: c.ownerId != null ? { id: c.ownerId, name: c.owner } : null,
    }))
  }

  // AXIS-1: same application.create preflight the candidate-drawer variant runs —
  // POST /applications enforces this against the candidate server-side, so surface
  // the same warn/block decision here BEFORE submit, once a candidate is picked.
  const { decision: appRuleDecision } = useActionRulePreflight('application.create', { candidateId })
  const appRuleBlocked = appRuleDecision?.effect === 'block'

  // APP-OWNER-1: the LOCKED vacancy path only receives {id, title, client} from
  // its caller — its own recruiter is fetched once, alive-guarded, since the
  // non-locked search above (which DOES carry owner) never runs for it.
  const [lockedVacancyOwnerId, setLockedVacancyOwnerId] = useState<Id | undefined>(undefined)
  useEffect(() => {
    if (!lockedVacancy?.id) return
    let alive = true
    api.get(`/vacancies/${lockedVacancy.id}`)
      .then(r => { if (alive) setLockedVacancyOwnerId(unwrap<{ owner?: { id?: Id } | null }>(r)?.owner?.id) })
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

  // Acquisition source (CMBE 5961c673) — S-SOURCE-1, graduated 2026-08-14: a
  // searchable/creatable picker backed by the real /candidate-sources tenant
  // lookup, mirroring ApplicationDetailsCard's own edit control (see
  // useApplicationSources' doc comment for the full backend contract).
  const [source, setSource] = useState('')
  const sourceFieldId = useId()
  const { sources: sourceOptions, allowFreeEntry: sourceAllowFreeEntry } = useApplicationSources()

  // W30: the tenant's active custom-field defs for applications — StoreApplicationRequest
  // also accepts `custom_fields` (ValidCustomFields('application')). The section only
  // renders once ≥1 active def exists (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('application')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})
  const setCustomField = (key: string, v: unknown) => setCustomFieldValues(p => ({ ...p, [key]: v }))
  const simpleCustomFields = customFieldDefs.filter(f => f.type !== 'textarea')
  const textCustomFields   = customFieldDefs.filter(f => f.type === 'textarea')

  // Create the application. AUDIT-1 (CRITICAL, 15-07): the old catch fabricated a
  // fake local row (id: -Date.now()) and closed the modal as if it succeeded —
  // masking real failures INCLUDING the matrix-guard 422s. A failure now keeps the
  // modal open and shows the server's message inline.
  const [createError, setCreateError] = useState<string | null>(null)
  const [errors,      setErrors]      = useState<Record<string, boolean>>({})
  const create = async () => {
    // VACATURE-OPTIONEEL (register pt.2): vacancy_id is `sometimes|nullable` on
    // StoreApplicationRequest — an "open application" with no vacancy yet is a
    // real, backend-supported case. Only the candidate is required to submit.
    if (!candidateId || saving || appRuleBlocked) return
    setSaving(true)
    setCreateError(null)
    setErrors({})
    try {
      // application_stage_id is omitted (not null-ed) when unset so the backend's own
      // `?? ApplicationStage::defaultStageId()` fallback decides the start stage.
      // source is omitted the same way — an empty field means "let the server default
      // to 'manual'", never an explicit empty-string value. custom_fields only rides
      // along once the recruiter actually filled something in (an empty {} is
      // indistinguishable from "not asked" server-side, so it's omitted too).
      const res = await api.post('/applications', {
        candidate_id: candidateId, vacancy_id: vacancyId || null, owner_id: ownerId || null,
        ...(phaseId ? { application_stage_id: phaseId } : {}),
        ...(source.trim() ? { source: source.trim() } : {}),
        ...(Object.keys(customFieldValues).length ? { custom_fields: customFieldValues } : {}),
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
  // CLEAR-SWEEP (Danny 13-08): owner is optional (submitted as `owner_id: ownerId ||
  // null` above) — once auto-seeded or manually picked, it must be releasable back
  // to "let the server decide" rather than stuck on whatever was last chosen.
  const ownerField = (
    <PickField label={t('add.owner')} placeholder={t('add.ownerPlaceholder')}
      clearable clearLabel={t('add.owner')}
      options={ownerOptions} value={ownerId} onChange={setOwnerId}
      style={errors.ownerId ? { borderColor: 'var(--color-danger)' } : undefined} />
  )

  return (
    // NEWCAND-1: a fragment now wraps two sibling FloatingPanels (this modal +
    // the optional layered AddCandidateModal below).
    <>
    {/* POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
        remembered position; keeps the S2 720px two-column footprint. */}
    <FloatingPanel open onClose={onClose} title={t('add.title')} ariaLabel={t('add.title')}
      persistKey="add-application" width={720} maxWidth="94vw">

        {/* Candidate + vacancy side by side — the two "big" relational pickers get
            equal, comfortable room; owner (+ start stage) sit on the row below. */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AXIS-1 preflight — warn/block on the picked candidate before submit
              (mirrors the candidate-drawer variant's identical banner placement). */}
          {candidateId && appRuleDecision && appRuleDecision.effect !== 'allow' && (
            <ActionRuleBanner decision={appRuleDecision} />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <SearchPickField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')}
                value={pickedCandidate} options={candidateSearch.options} onPick={pickCandidate}
                onSearch={candidateSearch.setQuery} error={errors.candidateId}
                searchError={candidateSearch.error} onRetry={candidateSearch.retry} />
              {/* NEWCAND-1: a real button (§3A), never coloured text-as-link — opens the
                  house AddCandidateModal (with its own CV-parse entry points) on top. */}
              <button type="button" onClick={() => setAddingCandidate(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 8px',
                  fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                <UserPlus size={12} /> {t('add.newCandidate')}
              </button>
            </div>
            {lockedVacancy ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('add.vacancy')}</div>
                <div style={{ padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)' }}>
                  {lockedVacancy.client ? `${lockedVacancy.title} · ${lockedVacancy.client}` : lockedVacancy.title}
                </div>
              </div>
            ) : (
              // VACATURE-OPTIONEEL: labelled optional so the field's own placement never
              // reads as a required step — an open application (no vacancy yet) is real.
              <SearchPickField
                label={<><span>{t('add.vacancy')}</span> <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('add.vacancyOptional')}</span></>}
                placeholder={t('add.vacancyPlaceholder')}
                value={pickedVacancy} options={vacancySearch.options} onPick={pickVacancy}
                onSearch={vacancySearch.setQuery} error={errors.vacancyId}
                searchError={vacancySearch.error} onRetry={vacancySearch.retry} />
            )}
          </div>
          {/* Owner + start stage share a row (§3A: pair short fields into two columns).
              The phase picker only exists when the tenant lookup gave us real, submittable
              stages — otherwise owner keeps the full width and the server picks the stage. */}
          {stageOptions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {ownerField}
              {/* CLEAR-SWEEP (Danny 13-08): start stage is optional too — omitted from
                  the POST body entirely when empty (see `create` above), so the server's
                  own default-stage fallback decides. Must be releasable, not sticky. */}
              <PickField label={t('add.phase')} placeholder={t('add.phasePlaceholder')}
                clearable clearLabel={t('add.phase')}
                options={stageOptions.map(s => ({ value: s.id, label: s.label }))}
                value={phaseId} onChange={setPhaseIdManual}
                style={errors.phase ? { borderColor: 'var(--color-danger)' } : undefined} />
            </div>
          ) : ownerField}

          {/* Acquisition source — S-SOURCE-1: a searchable/creatable picker over the
              real distinct source values already on applications (see useApplicationSources'
              doc comment for why no tenant-CRUD lookup exists behind it yet). Mirrors
              ApplicationDetailsCard's own Bron picker byte-for-byte. Own full-width row,
              same style as the pickers above. Clearable: source is optional. */}
          <div>
            <label id={`${sourceFieldId}-label`} htmlFor={sourceFieldId} style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.source')}</label>
            <CreatableSelectJs id={sourceFieldId} aria-labelledby={`${sourceFieldId}-label`}
              value={source} options={sourceOptions} onChange={setSource}
              allowCreate={sourceAllowFreeEntry} placeholder={t('drawer.source')}
              clearable clearLabel={t('drawer.source')}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
          </div>

          {/* W30 / §3A(f): the "Extra" section — tenant custom fields for applications,
              rendered only once ≥1 active def exists. */}
          {customFieldDefs.length > 0 && (
            <div style={errors.custom_fields ? { border: '1px solid var(--color-danger)', borderRadius: 8, padding: 10 } : undefined}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
                {t('common:customFieldsCard.title')}
              </div>
              {simpleCustomFields.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  {simpleCustomFields.map(def => {
                    // §6: a real <label htmlFor> — never a bare div floating near the input.
                    const inputId = `app-cf-${def.key}`
                    return (
                      <div key={def.key}>
                        <label htmlFor={inputId} style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{def.label}</label>
                        <CustomFieldInput id={inputId} def={def} value={customFieldValues[def.key]} onChange={v => setCustomField(def.key, v)} />
                      </div>
                    )
                  })}
                </div>
              )}
              {textCustomFields.map(def => (
                <div key={def.key} style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{def.label}</div>
                  <RichTextEditor value={String(customFieldValues[def.key] ?? '')} onChange={v => setCustomField(def.key, v)} minHeight={80} />
                </div>
              ))}
            </div>
          )}
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
          <Button variant="secondary" onClick={onClose}>{t('add.cancel')}</Button>
          <button onClick={create} disabled={!candidateId || saving || appRuleBlocked}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8,
              background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: 'pointer', opacity: (candidateId && !appRuleBlocked) ? 1 : 0.4 }}>
            {t('add.create')}
          </button>
        </div>
    </FloatingPanel>

    {/* NEWCAND-1: layered on top — its own FloatingPanel, own focus trap. */}
    {addingCandidate && (
      <AddCandidateModal onClose={() => setAddingCandidate(false)} onCreated={onCandidateCreated} />
    )}
    </>
  )
}
