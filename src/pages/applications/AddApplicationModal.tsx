import { useState, useEffect, useMemo, useId, useRef } from 'react'
import type { ComponentType, ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
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
import { useCustomFields } from '@/lib/useCustomFields'
import type { CustomFieldDef } from '@/lib/useCustomFields'
import { mapApplication } from './data/mapApplication'
import { BTN_H } from '@/config/buttonMetrics'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import SearchSelectJs from '@/components/ui/SearchSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { isUuid } from '@/lib/uuid'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>
const SearchSelect = SearchSelectJs as unknown as ComponentType<AnyProps>

// ownerId/ownerName (APP-OWNER-1): both /candidates and /vacancies already carry
// an `owner` object (CandidateListResource / VacancyListResource) — captured here
// so the owner-derivation chain below can read it straight off the picked option,
// no extra fetch for either the candidate or the non-locked vacancy pick.
interface PickOption { value: Id; label: string; client?: string; ownerId?: Id; ownerName?: string }
interface AppUser { id: Id; name?: string }

// The generic /candidates + /vacancies row shape (only the fields either mapper
// reads; the other entity's own fields simply stay undefined — same tolerant
// read the rest of this file already relies on for API rows).
interface RawPickRow {
  id?: Id; name?: string; first_name?: string; last_name?: string
  title?: string; titel?: string; client_name?: string; client?: string
  owner?: { id?: Id; name?: string } | null
}
const mapCandidateRow = (c: RawPickRow): PickOption => ({
  value: c.id ?? '', label: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' '),
  ownerId: c.owner?.id, ownerName: c.owner?.name,
})
const mapVacancyRow = (v: RawPickRow): PickOption => ({
  value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client,
  ownerId: v.owner?.id, ownerName: v.owner?.name,
})

// W30: the candidate/vacancy page size per server search round-trip — mirrors the
// backend's own default (CandidateProfileController::index / VacancyController::index
// both default per_page to 25); typing narrows the ACTUAL tenant table via `search`
// instead of ever pulling the first 100 rows and filtering that stale local slice.
const SEARCH_PAGE_SIZE = 25

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

// W30: field label + a SERVER-SEARCHED single-select (SearchSelect) — the candidate
// and vacancy pickers only. The old CreatableSelect pair filtered ONE client-fetched
// page of 100 rows locally, with no way to reach row 101; SearchSelect's own
// `onSearch` (already debounced 250ms inside the component — the house idiom, mirrors
// tasks/drawer/LinksTab's identical candidate/vacancy/… picker) drives a REAL server
// round-trip per edit instead, so typing reaches the whole tenant table. The trigger
// is hand-styled to match PickField/CreatableSelect exactly (label-prefixed button +
// chevron), so all four pickers on this form stay visually identical (§4).
function SearchPickField({ label, placeholder, value, options, onPick, onSearch, error, searchError, onRetry }: {
  label: ReactNode; placeholder?: string; value: PickOption | null; options: PickOption[]
  onPick: (opt: PickOption) => void; onSearch: (query: string) => void
  error?: boolean; searchError?: boolean; onRetry: () => void
}) {
  const { t } = useTranslation('applications')
  const labelId = useId()
  const triggerId = useId()
  return (
    <div>
      <div id={labelId} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <SearchSelect
        width={320}
        options={options.map(o => ({ value: String(o.value), label: o.label }))}
        selected={value ? [String(value.value)] : []}
        onSearch={onSearch}
        closeOnToggle
        onToggle={(v: string) => { const opt = options.find(o => String(o.value) === v); if (opt) onPick(opt) }}
        renderTrigger={(toggle: () => void) => (
          <button type="button" id={triggerId} onClick={toggle} aria-labelledby={`${labelId} ${triggerId}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
              boxSizing: 'border-box', border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border)'}`,
              borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}>
            <span style={{ fontSize: 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis', color: value ? 'var(--text)' : 'var(--text-muted)' }}>
              {value?.label ?? placeholder}
            </span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        )}
      />
      {/* Search failure — a real state (§3), never a silent empty list: unlike the old
          one-shot mount fetch, a query now fires on every edit, so a transient failure
          is more likely and needs its own recovery path (retry re-issues the SAME query,
          which an unchanged search box would otherwise never re-trigger). */}
      {searchError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--color-danger)' }}>
          <span>{t('add.searchError')}</span>
          <button type="button" onClick={onRetry}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', cursor: 'pointer', color: 'var(--text)' }}>
            {t('common:error.retry')}
          </button>
        </div>
      )}
    </div>
  )
}

// W30: one entity's server-searched picker options — re-fetches on every search-box
// edit instead of the old single 100-row mount fetch (mirrors tasks/drawer/LinksTab's
// identical candidate/vacancy/… picker fetch). A `requestId` freshness guard (that
// same idiom, not an AbortController) drops a superseded response instead of letting a
// slow earlier query overwrite a faster later one (§9 alive-guard). `skip` short-
// circuits entirely for the locked-vacancy path (data minimisation, §8/§9).
function useSearchOptions(url: string, mapRow: (row: RawPickRow) => PickOption, skip: boolean) {
  const [query, setQuery]           = useState('')
  const [options, setOptions]       = useState<PickOption[]>([])
  const [error, setError]           = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const requestIdRef = useRef(0)
  useEffect(() => {
    if (skip) return
    const requestId = ++requestIdRef.current
    setError(false)
    api.get(url, { params: { search: query, per_page: SEARCH_PAGE_SIZE } })
      .then(r => { if (requestIdRef.current === requestId) setOptions(unwrapList<RawPickRow>(r).rows.map(mapRow)) })
      .catch(() => { if (requestIdRef.current === requestId) setError(true) })
  }, [url, query, skip, mapRow, reloadTick])
  return { query, setQuery, options, error, retry: () => setReloadTick(t => t + 1) }
}

// One simple-typed tenant custom field's edit control (text/number/date/boolean/
// select) — mirrors CustomFieldsTab's own FieldInput rendering convention so the
// create-time "Extra" section and the drawer's later Extra tab render identically.
// `id` ties the control to its <label htmlFor> in the caller (§6 — every input
// needs an associated label, not just a nearby, unconnected div).
function CustomFieldInput({ id, def, value, onChange }: { id: string; def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const inputStyle: CSSProperties = { width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }
  if (def.type === 'boolean') return <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
  if (def.type === 'select') return (
    <select id={id} value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">—</option>
      {(def.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <input id={id} type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
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
 * `source` (W30): StoreApplicationRequest does NOT accept a `source` field —
 * verified against the backend request class, which hard-codes 'source' => 'manual'
 * in ApplicationController::store(). Only the PATCH path (UpdateApplicationRequest)
 * accepts it (S7, already shipped). Offering a source picker here would be a fake
 * affordance (§3 — its value would silently never reach the server), so none is
 * added; this is a backend gap, not a missed frontend wire-up (docs/WORKLIST.md S7
 * only closed the PATCH half of the ticket).
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
  // Propose the tenant's flagged default as soon as the real lookup lands (the seed is
  // gone by then); re-sync whenever the held value is not a real, submittable option.
  useEffect(() => {
    if (phaseId && stageOptions.some(s => s.id === phaseId)) return
    setPhaseId(defaultStageId)
  }, [defaultStageId, stageOptions, phaseId])

  // W30: the tenant's active custom-field defs for applications — StoreApplicationRequest
  // DOES accept `custom_fields` (ValidCustomFields('application')), unlike `source` (see
  // the file doc comment). The section only renders once ≥1 active def exists (§3A(f)).
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
    if (!candidateId || !vacancyId || saving) return
    setSaving(true)
    setCreateError(null)
    setErrors({})
    try {
      // application_stage_id is omitted (not null-ed) when unset so the backend's own
      // `?? ApplicationStage::defaultStageId()` fallback decides the start stage.
      // custom_fields only rides along once the recruiter actually filled something in
      // (an empty {} is indistinguishable from "not asked" server-side, so it's omitted
      // exactly like application_stage_id above).
      const res = await api.post('/applications', {
        candidate_id: candidateId, vacancy_id: vacancyId, owner_id: ownerId || null,
        ...(phaseId ? { application_stage_id: phaseId } : {}),
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
            <SearchPickField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')}
              value={pickedCandidate} options={candidateSearch.options} onPick={pickCandidate}
              onSearch={candidateSearch.setQuery} error={errors.candidateId}
              searchError={candidateSearch.error} onRetry={candidateSearch.retry} />
            {lockedVacancy ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('add.vacancy')}</div>
                <div style={{ padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)' }}>
                  {lockedVacancy.client ? `${lockedVacancy.title} · ${lockedVacancy.client}` : lockedVacancy.title}
                </div>
              </div>
            ) : (
              <SearchPickField label={t('add.vacancy')} placeholder={t('add.vacancyPlaceholder')}
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
              <PickField label={t('add.phase')} placeholder={t('add.phasePlaceholder')}
                options={stageOptions.map(s => ({ value: s.id, label: s.label }))}
                value={phaseId} onChange={setPhaseId}
                style={errors.phase ? { borderColor: 'var(--color-danger)' } : undefined} />
            </div>
          ) : ownerField}

          {/* W30 / §3A(f): the "Extra" section — tenant custom fields for applications,
              rendered only once ≥1 active def exists. custom_fields IS accepted by
              StoreApplicationRequest (unlike source, see the file doc comment). */}
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
