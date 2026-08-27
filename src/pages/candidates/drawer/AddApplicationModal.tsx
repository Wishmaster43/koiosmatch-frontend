/**
 * AddApplicationModal — "+ Solliciteren" from the candidate Match tab: couple the
 * candidate to a vacancy in a chosen funnel phase. vacancy_id is nullable
 * server-side (APP-VACANCY-OPTIONAL-1) — an open application without a vacancy
 * yet is a real backend flow, so the picker is optional and Create never waits
 * on it. Vacancy + phase + owner + source are all searchable pick-only
 * comboboxes (S24b), owner seeded from the APP-OWNER-1 priority chain (picked
 * vacancy's recruiter > candidate's own owner > logged-in user) with an
 * OWNER-DEVIATION-1 soft warning when the final pick still differs — both the
 * chain and the soft-warning booleans live in useApplicationOwnerChain.
 *
 * The AXIS-MATRIX-2 `application.create` preflight banners on warn and
 * additionally disables Create on block, matching the backend guard.
 * `initialVacancyId`/`suggestedVacancyId` seed the vacancy picker once
 * (VACANCY-PREFILL-1 / KOIOS-VOORSTEL-1). With `editApplicationId` the form
 * PREFILLS from GET /applications/{id} and PATCHes instead of POSTing (punt 5).
 *
 * APPMODAL-SPLIT-1 (§0.3 split): all state/derivation/effects/submit logic now
 * lives in useAddApplicationForm — this file stays a thin container wiring the
 * tenant lookups into the shared field layout below.
 *
 * W30: the vacancy picker now server-searches (useVacancyOptions' `search` arg,
 * via CreatableSelect's own onSearch) instead of a flat 100-row mount fetch,
 * and the POST body now also carries `source` + tenant `custom_fields`
 * (StoreApplicationRequest accepts both), mirroring
 * pages/applications/AddApplicationModal.tsx's identical fields.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import KoiosSuggestionBadge from '@/components/ui/KoiosSuggestionBadge'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { ActionRuleBanner } from '@/components/actionrules'
import { useApplicationModalLookups } from '../hooks/useApplicationModalLookups'
import { useAddApplicationForm } from '../hooks/useAddApplicationForm'
import ApplicationCustomFieldsSection from './ApplicationCustomFieldsSection'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder } from '@/lib/tint'

// APP-REQUIRED-FE-1: red asterisk after a label whose field the tenant marked
// required (Settings → Sollicitaties → Verplichte velden) — same visual token
// the shared Label/FieldRow components use, kept local since neither picker row
// in this modal is built from those components (custom CANON_LABEL_STYLE rows).
const requiredMark = <span aria-hidden="true" style={{ color: 'var(--color-danger-text)', marginLeft: 2 }}>*</span>

// Label-left canon (P32, batch 5): label column fixed at CANON_LABEL_WIDTH, control fills the rest.
const fieldRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const fieldControl: React.CSSProperties = { flex: 1, minWidth: 0 }
// Consistent searchable-menu width (mirrors PlanIntakeModal/MatchModal's vacancy picker).
const pickerMenuWidth = 340
// S24c (Danny 24-07): the exact "+ Kandidaat toevoegen" combobox footprint
// (mirrors addmodal/fields.tsx's CreatableSelect wrapper) — every searchable
// picker in this modal must render at the same height as the reference modal.
const fieldFootprint: React.CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

// Create-or-edit modal for one candidate's application: wires the tenant lookups
// (vacancies/stages/users/sources/settings/custom fields) and the AXIS-MATRIX
// preflight into useAddApplicationForm, then renders the shared field layout.
export default function AddApplicationModal({ candidateId, candidateOwnerId, candidateOwnerName, initialVacancyId, suggestedVacancyId, editApplicationId, onClose, onCreated }: {
  candidateId: Id
  // OWNER-DEVIATION-1: the candidate's own owner, passed down from the already-
  // loaded drawer record (WorkTab's `c.ownerId`/`c.owner`) — never refetched.
  candidateOwnerId?: Id | null
  candidateOwnerName?: string
  // VACANCY-PREFILL-1: a vacancy already chosen by the caller (e.g. the score panel
  // in VacancySearchTab) — seeds the picker once, still freely changeable.
  initialVacancyId?: Id
  // KOIOS-VOORSTEL-1 (Danny 13-08): vacancy Koios suggests from the candidate's
  // history — seeds the picker AND shows the Koios mark while it still holds
  // initialVacancyId (score panel: user clicked THAT vacancy) stays badge-less:
  // explicit context is the user's own choice, not a proposal.
  suggestedVacancyId?: Id | null
  // Punt 5: set from an application row's pencil — prefill + PATCH instead of POST.
  editApplicationId?: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation('candidates')
  const editing = editApplicationId != null
  // §6: stable id pairs linking each row's label to its combobox trigger.
  const vacancyFieldId = useId()
  const phaseFieldId = useId()
  const ownerFieldId = useId()
  const sourceFieldId = useId()

  // APPMODAL-SPLIT-1: every tenant lookup (vacancies/stages/users/sources/custom
  // fields/required-flags/AXIS preflight) now lives in this hook.
  const {
    vacancyOptions, setVacancySearch, stages, defaultStage,
    userOptions, meId, meIsAssignable,
    sourceOptions, sourceAllowFreeEntry,
    customFieldDefs, simpleCustomFields, textCustomFields,
    vacancyRequired, phaseRequired, ownerRequired, sourceRequired,
    appRuleDecision, appRuleBlocked,
  } = useApplicationModalLookups({ candidateId, editing })

  // APPMODAL-SPLIT-1: all state/derivation/effects/submit now live in this hook.
  const {
    vacancyId, setVacancyId, phaseId, setPhaseId, source, setSource,
    ownerId, setOwnerId, pickedVacancy, ownerDiffersFromCandidate, ownerDiffersFromVacancy,
    saving, errors, submit, customFieldValues, setCustomField,
  } = useAddApplicationForm({
    candidateId, candidateOwnerId, initialVacancyId, suggestedVacancyId, editApplicationId,
    vacancyOptions, stages, defaultStage, userOptions, meId, meIsAssignable,
    vacancyRequired, phaseRequired, ownerRequired, sourceRequired, onCreated, onClose,
  })

  // One title/labels source for both modes (§5: never a hardcoded twin).
  const title = t(editing ? 'work.editApplication' : 'work.addApplication')

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; same overlay/Esc/backdrop semantics as before.
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="candidate-add-application" width={560} maxWidth="92vw" scrollBody={false} bodyStyle={{ padding: 0 }}>

      {/* Fields scroll in their own area so the footer buttons stay pinned and never clip (Danny 13-08). */}
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: 22 }}>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter
            picks a vacancy. Create only: editing an existing application is not a create. */}
        {!editing && appRuleDecision && appRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 14 }}><ActionRuleBanner decision={appRuleDecision} /></div>
        )}

        {/* Vacancy — searchable pick-only combobox (S24b), mirrors PlanIntakeModal.
            APP-VACANCY-OPTIONAL-1: the label says "(optioneel)" honestly — an open
            application without a vacancy is a real backend flow now. W30: server-
            searched via onSearch, so a >100-vacancy tenant can still find anything. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldRow}>
            <div id={`${vacancyFieldId}-label`} style={CANON_LABEL_STYLE}>
              {t(vacancyRequired ? 'work.vacancy' : 'work.vacancyOptional')}
              {vacancyRequired && requiredMark}
            </div>
            <div style={fieldControl}>
              {/* Clearable (Danny 13-08 'hier ook niet — eenmaal gekozen blijft hij
                  staan'): an OPTIONAL vacancy must be releasable back to an open
                  application — VAC-CLEAR-1 cross, same as the intake modal. No cross
                  once the tenant made it required (APP-REQUIRED-FE-1). */}
              <CreatableSelect id={vacancyFieldId} aria-labelledby={`${vacancyFieldId}-label`}
                value={vacancyId || null} onChange={setVacancyId} onSearch={setVacancySearch}
                placeholder={t('work.pickVacancy')} clearable={!vacancyRequired} clearLabel={t('work.vacancyOptional')}
                allowCreate={false} menuWidth={pickerMenuWidth} style={fieldFootprint}
                options={(() => {
                  // Pin the picked row into the list: after a pick the query resets and
                  // the refreshed top-100 may not contain it — the trigger label and the
                  // open menu must keep showing the actual pick (golf-1 verify).
                  const rows = vacancyOptions.some(v => String(v.value) === String(vacancyId)) || !pickedVacancy
                    ? vacancyOptions : [pickedVacancy, ...vacancyOptions]
                  return rows.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))
                })()} />
              {/* The badge lives exactly as long as the suggestion holds — cleared
                  or repicked means the value is the recruiter's own again. */}
              {suggestedVacancyId != null && String(vacancyId) === String(suggestedVacancyId) && !editApplicationId && <KoiosSuggestionBadge />}
            </div>
          </div>
          {errors.vacancyId && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>
              {!vacancyId && vacancyRequired ? t('common:errors.fieldRequired', { field: t('work.vacancy') }) : t('work.applicationFailed')}
            </div>
          )}
        </div>
        {/* Fase — searchable pick-only combobox; now submits the real stage id (S24b).
            No clear cross here (never had one): unlike vacancy/source this field
            never carried a VAC-CLEAR-1 affordance, and retrofitting one is a
            separate change — only the required-marker is added here. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldRow}>
            <div id={`${phaseFieldId}-label`} style={CANON_LABEL_STYLE}>{t('work.phase')}{phaseRequired && requiredMark}</div>
            <div style={fieldControl}>
              <CreatableSelect id={phaseFieldId} aria-labelledby={`${phaseFieldId}-label`}
                value={phaseId || null} onChange={setPhaseId} allowCreate={false} menuWidth={pickerMenuWidth}
                style={fieldFootprint} options={stages.map(s => ({ value: s.id, label: s.label }))} />
            </div>
          </div>
          {errors.phase && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>
              {!phaseId && phaseRequired ? t('common:errors.fieldRequired', { field: t('work.phase') }) : t('work.applicationFailed')}
            </div>
          )}
        </div>
        {/* APP-OWNER-1: recruiter picker, seeded from the derivation chain above
            (vacancy recruiter > candidate owner > logged-in user) but always
            changeable via the house user-picker, same footprint as the fields above.
            No clear cross here either, for the same reason as phase above. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldRow}>
            <div id={`${ownerFieldId}-label`} style={CANON_LABEL_STYLE}>{t('work.owner')}{ownerRequired && requiredMark}</div>
            <div style={fieldControl}>
              <CreatableSelect id={ownerFieldId} aria-labelledby={`${ownerFieldId}-label`}
                value={ownerId || null} onChange={setOwnerId} placeholder={t('work.pickOwner')}
                allowCreate={false} menuWidth={pickerMenuWidth} style={fieldFootprint} options={userOptions} />
            </div>
          </div>
          {errors.ownerId && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>
              {!ownerId && ownerRequired ? t('common:errors.fieldRequired', { field: t('work.owner') }) : t('work.applicationFailed')}
            </div>
          )}
        </div>
        {/* Bron (APP-REQUIRED-FE-1) — searchable/creatable tenant-lookup picker,
            mirrors ApplicationDetailsCard/pages/applications/AddApplicationModal's
            own source field. Optional unless the tenant requires it in Settings. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldRow}>
            <div id={`${sourceFieldId}-label`} style={CANON_LABEL_STYLE}>{t('filters.source')}{sourceRequired && requiredMark}</div>
            <div style={fieldControl}>
              {/* §6: the picker's accessible name is the LABEL, never the picked
                  raw value — same id/aria-labelledby wiring as the sibling modal. */}
              <CreatableSelect id={sourceFieldId} aria-labelledby={`${sourceFieldId}-label`}
                value={source || null} onChange={setSource} placeholder={t('filters.source')}
                clearable={!sourceRequired} clearLabel={t('filters.source')}
                allowCreate={sourceAllowFreeEntry} menuWidth={pickerMenuWidth} style={fieldFootprint}
                options={sourceOptions} />
            </div>
          </div>
          {errors.source && (
            <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>
              {!source.trim() && sourceRequired ? t('common:errors.fieldRequired', { field: t('filters.source') }) : t('work.applicationFailed')}
            </div>
          )}
        </div>
        {/* W30: tenant custom fields — only rendered once ≥1 active def exists (§3A(f)). */}
        {customFieldDefs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <ApplicationCustomFieldsSection
              simpleCustomFields={simpleCustomFields} textCustomFields={textCustomFields}
              customFieldValues={customFieldValues} setCustomField={setCustomField} />
          </div>
        )}
        {/* Soft warning (never a block, Danny: "wel een melding") — mirrors the
            AXIS-MATRIX banner's warn tint (ActionRuleBanner) so both notices in this
            modal read as the same idiom. Only fires once both sides of a comparison
            are a KNOWN owner (§ useBranchMismatch's "both sides nullable" rule). */}
        {(ownerDiffersFromCandidate || ownerDiffersFromVacancy) && (
          <div role="alert" aria-label={t('work.ownerDeviation')} style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '8px 10px', borderRadius: 8, marginBottom: 20,
            background: tintBg('var(--color-warning)'),
            border: tintBorder('var(--color-warning)') }}>
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
      </div>

      {/* Pinned footer — buttons stay visible whatever the content height (Danny 13-08). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Button variant="secondary" onClick={onClose}>{t('common:cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={saving || appRuleBlocked}>
            {saving ? t('common:saving') : t(editing ? 'common:save' : 'work.createApplication')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
