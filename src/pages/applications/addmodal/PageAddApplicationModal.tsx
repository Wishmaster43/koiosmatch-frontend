/**
 * PageAddApplicationModal — the applications-page-toolbar context of the merged
 * AddApplicationModal (ADDAPPLICATION-TWIN-1): create a new application by
 * linking an existing candidate to a vacancy, from the applications list
 * toolbar (or the vacancy drawer's "+ Sollicitatie", via `lockedVacancy`). See
 * the full docblock further below for the field-by-field contract; this top
 * header only exists so the file opens with one (house rule). Relocated
 * verbatim from pages/applications/AddApplicationModal.tsx — the top-level
 * pages/applications/AddApplicationModal.tsx is now a thin dispatcher that
 * picks this component (context 'page', the default) or
 * DrawerAddApplicationModal (context 'drawer').
 */
import { useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
// AXIS-1: this page-level modal used to skip the action-rule preflight the
// candidate-drawer variant runs (DrawerAddApplicationModal) — reuse the SAME
// shared hook/banner, never a second implementation.
import { ActionRuleBanner } from '@/components/actionrules'
import { useCustomFields } from '@/lib/useCustomFields'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
// §0.3 split: server-searched picker hook + the tenant custom-field
// control now live in their own folder (mirrors the candidate addmodal/ folder).
import { useSearchOptions } from './useSearchOptions'
import type { PickOption } from './types'
import CustomFieldsSection from './CustomFieldsSection'
import InterviewConsentRow from './InterviewConsentRow'
import CandidateVacancyRow from './CandidateVacancyRow'
import OwnerPhaseRow from './OwnerPhaseRow'
import { mapCandidateRow, mapVacancyRow } from './pickRowMappers'
// R6: owner-derivation/preflight/stage-seeding effects and the POST submit now
// live in their own hooks (extracted verbatim, behaviour unchanged).
import { useApplicationOwnerAndStage } from '../hooks/useApplicationOwnerAndStage'
import { useCreateApplication } from '../hooks/useCreateApplication'
// NEWCAND-1 (register pt.4): reuse the real candidate create flow (incl. its own
// CV-parse entry points) — never a second, thinner "create candidate" form here.
import { AddCandidateModal } from '@/pages/candidates/shared'
import type { Candidate } from '@/types/candidate'
import ModalFooter from '@/components/ui/ModalFooter'
import { tintBorder } from '@/lib/tint'
// LABEL-LEFT-1 (§3A: modals mirror the drill-down — label LEFT of the field,
// canon label width ~120px). CLONE-BY-CONSTRUCTION-1 (§16): the shared row shell
// (this file's twin, DrawerAddApplicationModal, and SearchPickField all adopt it).
import { ApplicationFieldRow } from './ApplicationFieldRow'

interface AppUser { id: Id; name?: string }

// A submittable stage id is the uuid the backend validates against
// (StoreApplicationRequest: uuid|exists:application_stages,id). useApplicationStages
// seeds slug ids ("applied") until /application-stages resolves — those would 422.

/**
 * PageAddApplicationModal — create a new application by linking an existing
 * candidate to a vacancy. Pickers load from /candidates and /vacancies. Persists
 * to POST /applications; a failure keeps the modal open with the server's message
 * (never a fabricated local row). `lockedVacancy` preselects + LOCKS the vacancy
 * field when opened from the vacancy drawer's Sollicitaties tab ("+ Sollicitatie",
 * vacancies/drawer/ApplicantsTab) — only the candidate needs picking then
 * (mirrors PlanIntakeModal's defaultVacancyId, but locked rather than editable
 * since the whole point of that entry point is "for THIS vacancy").
 *
 * APP-OWNER-1 (Danny's GO — supersedes this file's own earlier "default to me"
 * APP-OWNER-1 note below): the owner picker now seeds from a priority chain,
 * mirroring the candidate-drawer variant (DrawerAddApplicationModal) — (1) the
 * picked vacancy's own recruiter (owner); (2) else the picked candidate's own
 * owner; (3) else the logged-in user. Both the candidate and the non-locked
 * vacancy list already carry `owner` on their API rows (captured into PickOption
 * above), so neither rung needs an extra fetch. The ONE case that does: the
 * LOCKED vacancy path only receives {id, title, client} from its caller
 * (ApplicantsTab, out of scope here) — its recruiter is fetched once via GET
 * /vacancies/{id}, alive-guarded. Every rung only proposes a real, ASSIGNABLE
 * tenant user (never a super-admin the server would 422 on). Seeded once: a
 * manual pick is never overwritten, and picking/changing the candidate or
 * vacancy AFTER a manual owner change never reseeds it.
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
export default function PageAddApplicationModal({ onClose, onCreated, lockedVacancy }: {
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
  // K-277: the picked option's stable key rides along with the name (null for free entry).
  const sourceKey = (sourceOptions.find(o => o.value === source) as { key?: string | null } | undefined)?.key ?? null

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
  // ONIX K-006: interview consent, unchecked by default.
  const [interviewConsent, setInterviewConsent] = useState(false)
  const { create, saving, createError, errors } = useCreateApplication({
    candidateId, vacancyId, ownerId, phaseId, source, sourceKey, customFieldValues,
    vacancyRequired, ownerRequired, phaseRequired, sourceRequired,
    appRuleBlocked, interviewConsent, onCreated,
  })


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
          <CandidateVacancyRow lockedVacancy={lockedVacancy} pickedCandidate={pickedCandidate} pickCandidate={pickCandidate}
            candidateSearch={candidateSearch} pickedVacancy={pickedVacancy} pickVacancy={pickVacancy}
            vacancySearch={vacancySearch} vacancyRequired={vacancyRequired} vacancyId={vacancyId}
            errors={errors} onNewCandidate={() => setAddingCandidate(true)} />
          <OwnerPhaseRow ownerOptions={ownerOptions} ownerId={ownerId} setOwnerId={setOwnerId} ownerRequired={ownerRequired}
            stageOptions={stageOptions} phaseId={phaseId} setPhaseIdManual={setPhaseIdManual}
            phaseRequired={phaseRequired} errors={errors} />


          {/* Acquisition source — S-SOURCE-1: a searchable/creatable picker over the
              real distinct source values already on applications (see useApplicationSources'
              doc comment for why no tenant-CRUD lookup exists behind it yet). Mirrors
              ApplicationDetailsCard's own Bron picker byte-for-byte. Own full-width row,
              same style as the pickers above. Clearable unless the tenant requires it
              (APP-REQUIRED-FE-1, VAC-CLEAR-1: no clear-cross once required). */}
          {/* CLONE-BY-CONSTRUCTION-1: same shell as the twin's (DrawerAddApplicationModal) source row. */}
          <ApplicationFieldRow fieldId={sourceFieldId} label={t('drawer.source')} required={sourceRequired}
            error={!!errors.source && !source.trim() && sourceRequired}
            errorText={t('common:errors.fieldRequired', { field: t('drawer.source') })}>
            <CreatableSelectJs id={sourceFieldId} aria-labelledby={`${sourceFieldId}-label`} aria-required={sourceRequired}
              value={source} options={sourceOptions} onChange={setSource}
              allowCreate={sourceAllowFreeEntry} placeholder={t('drawer.source')}
              clearable={!sourceRequired} clearLabel={t('drawer.source')}
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                border: `1px solid ${errors.source ? 'var(--color-danger)' : 'var(--border)'}`,
                background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
          </ApplicationFieldRow>

          {/* ONIX K-006: consent gate for the AI interview. */}
          <InterviewConsentRow checked={interviewConsent} onChange={setInterviewConsent} />

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

        {/* Footer — the shared ModalFooter (§4) owns this footer layout. */}
        <ModalFooter
          onCancel={onClose}
          onSubmit={create}
          cancelLabel={t('add.cancel')}
          submitLabel={t('add.create')}
          busy={saving}
          disabled={!candidateId || saving || appRuleBlocked}
        />
    </FloatingPanel>

    {/* NEWCAND-1: layered on top — its own FloatingPanel, own focus trap. */}
    {addingCandidate && (
      <AddCandidateModal onClose={() => setAddingCandidate(false)} onCreated={onCandidateCreated} />
    )}
    </>
  )
}
