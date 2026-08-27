/**
 * AddApplicationModal (page-level) — create a new application by linking an
 * existing candidate to a vacancy, from the applications list toolbar. See the
 * full docblock further below for the field-by-field contract; this top header
 * only exists so the file opens with one (house rule).
 */
import { useState, useId } from 'react'
import type { ComponentType, ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
// AXIS-1: this page-level modal used to skip the action-rule preflight the
// candidate-drawer variant runs (AddApplicationModal.tsx under pages/candidates/
// drawer/) — reuse the SAME shared hook/banner, never a second implementation.
import { ActionRuleBanner } from '@/components/actionrules'
import { useCustomFields } from '@/lib/useCustomFields'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
// §0.3 split: server-searched picker field/hook + the tenant custom-field
// control now live in their own folder (mirrors the candidate addmodal/ folder).
import SearchPickField from './addmodal/SearchPickField'
import { useSearchOptions } from './addmodal/useSearchOptions'
import type { PickOption, RawPickRow } from './addmodal/types'
import CustomFieldsSection from './addmodal/CustomFieldsSection'
// R6: owner-derivation/preflight/stage-seeding effects and the POST submit now
// live in their own hooks (extracted verbatim, behaviour unchanged).
import { useApplicationOwnerAndStage } from './hooks/useApplicationOwnerAndStage'
import { useCreateApplication } from './hooks/useCreateApplication'
// NEWCAND-1 (register pt.4): reuse the real candidate create flow (incl. its own
// CV-parse entry points) — never a second, thinner "create candidate" form here.
import { AddCandidateModal } from '@/pages/candidates/shared'
import { UserPlus } from 'lucide-react'
import type { Candidate } from '@/types/candidate'
import Button from '@/components/ui/Button'
import { BodyText } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

interface AppUser { id: Id; name?: string }

// APP-REQUIRED-FE-1: red asterisk after a label whose field the tenant marked
// required (Settings → Sollicitaties → Verplichte velden) — same visual token
// the shared Label/FieldRow components use (components/forms/fields.tsx).
const requiredMark = <span aria-hidden="true" style={{ color: 'var(--color-danger-text)', marginLeft: 2 }}>*</span>

// ownerId/ownerName (APP-OWNER-1): both /candidates and /vacancies already carry
// an `owner` object (CandidateListResource / VacancyListResource) — captured here
// so the owner-derivation chain below can read it straight off the picked option,
// no extra fetch for either the candidate or the non-locked vacancy pick.
// SUBLINE-1 (register PDF-SOLLICITATIES pt.1, Danny 14-08): "vijf keer Blom"
// (i.e. "five Bloms in the list") is unpickable by name alone — fold function
// title + city into the label itself,
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
// showed BLANK instead of the placeholder text (i.e. "Select a
// candidate/vacancy/recruiter"). Mirrors MatchModal's own
// `value={x || null}` pickers (job 17/18).
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
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }

  // APP-REQUIRED-FE-1: tenant-configurable required fields for this popup (Settings
  // → Sollicitaties → Verplichte velden) — a flat array, no phase axis, mirroring
  // `FlatRequiredFieldsGuard('application')` on the backend (create only — this
  // modal has no edit mode, so no `!editing` gate is needed here).
  const settingsValues = useAllSettings()
  const requiredFields = getJsonSetting<string[]>(settingsValues, 'application_required_fields', [])
  const vacancyRequired = requiredFields.includes('vacancy_id')
  const ownerRequired = requiredFields.includes('owner_id')
  const phaseRequired = requiredFields.includes('application_stage_id')
  const sourceRequired = requiredFields.includes('source')

  // W30: server-searched candidate/vacancy options (see useSearchOptions above).
  // The vacancy search is skipped entirely while locked (data minimisation, §8/§9).
  const candidateSearch = useSearchOptions('/candidates', mapCandidateRow, false)
  const vacancySearch   = useSearchOptions('/vacancies', mapVacancyRow, !!lockedVacancy)
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId]     = useState(lockedVacancy ? String(lockedVacancy.id) : '')
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
  // AddCandidateModal reports the freshly created candidate back here; pick it straight
  // into the form since the create response already carries every field the picker needs.
  const onCandidateCreated = (c: Candidate) => {
    setAddingCandidate(false)
    pickCandidate(mapCandidateRow({
      id: c.id, name: c.name, function_title: c.title, city: c.city,
      owner: c.ownerId != null ? { id: c.ownerId, name: c.owner } : null,
    }))
  }

  // R6: owner-derivation chain, locked-vacancy owner fetch, the application.create
  // AXIS preflight and the start-stage seeding — all extracted into one hook.
  const { ownerOptions, ownerId, setOwnerId, appRuleDecision, appRuleBlocked,
    stageOptions, phaseId, setPhaseIdManual } = useApplicationOwnerAndStage({
    candidateId, lockedVacancy, pickedCandidate, pickedVacancy, users, me,
  })

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

  // R6: the POST submit, its client-side required-field preflight and its 422
  // field-error mapping are extracted into their own hook (behaviour unchanged).
  const { create, saving, createError, errors } = useCreateApplication({
    candidateId, vacancyId, ownerId, phaseId, source, customFieldValues,
    vacancyRequired, ownerRequired, phaseRequired, sourceRequired,
    appRuleBlocked, onCreated,
  })

  // Declared once — it renders either on its own row or paired with the phase picker.
  // CLEAR-SWEEP (Danny 13-08): owner is optional (submitted as `owner_id: ownerId ||
  // null` above) — once auto-seeded or manually picked, it must be releasable back
  // to "let the server decide" rather than stuck on whatever was last chosen.
  const ownerField = (
    <div>
      <PickField label={<>{t('add.owner')}{ownerRequired && requiredMark}</>} placeholder={t('add.ownerPlaceholder')}
        clearable={!ownerRequired} clearLabel={t('add.owner')}
        options={ownerOptions} value={ownerId} onChange={setOwnerId}
        style={errors.ownerId ? { borderColor: 'var(--color-danger)' } : undefined} />
      {errors.ownerId && !ownerId && ownerRequired && (
        <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
          {t('common:errors.fieldRequired', { field: t('add.owner') })}
        </div>
      )}
    </div>
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
              <Button variant="secondary" size="sm" style={{ marginTop: 6 }} onClick={() => setAddingCandidate(true)}>
                <UserPlus size={12} /> {t('add.newCandidate')}
              </Button>
            </div>
            {lockedVacancy ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('add.vacancy')}</div>
                <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <BodyText as="span">
                    {lockedVacancy.client ? `${lockedVacancy.title} · ${lockedVacancy.client}` : lockedVacancy.title}
                  </BodyText>
                </div>
              </div>
            ) : (
              // VACATURE-OPTIONEEL: labelled optional so the field's own placement never
              // reads as a required step — an open application (no vacancy yet) is real.
              // APP-REQUIRED-FE-1: once the tenant requires it, the honest "(optioneel)"
              // hint is replaced by the same red-asterisk marker every other field uses.
              <div>
                <SearchPickField
                  label={vacancyRequired
                    ? <>{t('add.vacancy')}{requiredMark}</>
                    : <><span>{t('add.vacancy')}</span> <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('add.vacancyOptional')}</span></>}
                  placeholder={t('add.vacancyPlaceholder')}
                  value={pickedVacancy} options={vacancySearch.options} onPick={pickVacancy}
                  onSearch={vacancySearch.setQuery} error={errors.vacancyId}
                  searchError={vacancySearch.error} onRetry={vacancySearch.retry} />
                {errors.vacancyId && !vacancyId && vacancyRequired && (
                  <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
                    {t('common:errors.fieldRequired', { field: t('add.vacancy') })}
                  </div>
                )}
              </div>
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
              <div>
                <PickField label={<>{t('add.phase')}{phaseRequired && requiredMark}</>} placeholder={t('add.phasePlaceholder')}
                  clearable={!phaseRequired} clearLabel={t('add.phase')}
                  options={stageOptions.map(s => ({ value: s.id, label: s.label }))}
                  value={phaseId} onChange={setPhaseIdManual}
                  style={errors.phase ? { borderColor: 'var(--color-danger)' } : undefined} />
                {errors.phase && !phaseId && phaseRequired && (
                  <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
                    {t('common:errors.fieldRequired', { field: t('add.phase') })}
                  </div>
                )}
              </div>
            </div>
          ) : ownerField}

          {/* Acquisition source — S-SOURCE-1: a searchable/creatable picker over the
              real distinct source values already on applications (see useApplicationSources'
              doc comment for why no tenant-CRUD lookup exists behind it yet). Mirrors
              ApplicationDetailsCard's own Bron picker byte-for-byte. Own full-width row,
              same style as the pickers above. Clearable unless the tenant requires it
              (APP-REQUIRED-FE-1, VAC-CLEAR-1: no clear-cross once required). */}
          <div>
            <label id={`${sourceFieldId}-label`} htmlFor={sourceFieldId} style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
              {t('drawer.source')}{sourceRequired && requiredMark}
            </label>
            <CreatableSelectJs id={sourceFieldId} aria-labelledby={`${sourceFieldId}-label`}
              value={source} options={sourceOptions} onChange={setSource}
              allowCreate={sourceAllowFreeEntry} placeholder={t('drawer.source')}
              clearable={!sourceRequired} clearLabel={t('drawer.source')}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                border: `1px solid ${errors.source ? 'var(--color-danger)' : 'var(--border)'}`,
                background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            {errors.source && !source.trim() && sourceRequired && (
              <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
                {t('common:errors.fieldRequired', { field: t('drawer.source') })}
              </div>
            )}
          </div>

          {/* W30 / §3A(f): the "Extra" section — tenant custom fields for applications,
              rendered only once ≥1 active def exists. */}
          {customFieldDefs.length > 0 && (
            <CustomFieldsSection simpleCustomFields={simpleCustomFields} textCustomFields={textCustomFields}
              customFieldValues={customFieldValues} setCustomField={setCustomField}
              hasError={Boolean(errors.custom_fields)} />
          )}
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 4px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
            border: tintBorder('var(--color-danger)') }}>
            {createError}
          </div>
        )}

        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>{t('add.cancel')}</Button>
          <Button variant="primary" onClick={create} disabled={!candidateId || saving || appRuleBlocked}>
            {t('add.create')}
          </Button>
        </div>
    </FloatingPanel>

    {/* NEWCAND-1: layered on top — its own FloatingPanel, own focus trap. */}
    {addingCandidate && (
      <AddCandidateModal onClose={() => setAddingCandidate(false)} onCreated={onCandidateCreated} />
    )}
    </>
  )
}
