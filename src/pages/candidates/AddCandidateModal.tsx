/**
 * AddCandidateModal — the "+ Kandidaat" create form (Danny's Optie A, 2026-07-18).
 * Left: the phase column (Lead/Kandidaat), untouched. Right: a two-column grid of
 * titled cards (Persoonlijk / Contact / Werk / Adres) in the drill-down ProfileTab
 * card style, replacing the old single stacked column. The address card is
 * always open (Danny r2: popup groter, geen inklap); functietitel/geslacht/
 * provincie are searchable comboboxen mirroring the drill-down, and Esc closes
 * via the house focus trap. State keys, validation, submit body and 422
 * handling are unchanged.
 *
 * Thin container (refactor 2026-07-20): each titled card is a presentational
 * component under `addmodal/` (props in, callbacks out); this file owns state,
 * validation and the submit/422 logic. Live field validation and the required-
 * fields resolution moved into their own `addmodal/` hooks (§3 size discipline,
 * split 2026-08-06) — this file still gates submit on what they report, it no
 * longer computes it inline.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLookups } from '@/context/LookupsContext'
import { useNavigation } from '@/context/NavigationContext'
import { useUsers } from '@/lib/queries'
import { useGenders } from '@/lib/useGenders'
import { useAuth } from '@/context/AuthContext'
import { useCreateCandidate } from './hooks/useCandidateMutations'
import { useLocations } from '@/lib/useLocations'
import { useFunctions } from '@/lib/useFunctions'
import { useProvinces } from '@/hooks/useProvinces'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { cardBox, cardHead, modalColumns } from '@/components/ui/modalCards'
// CAND-IMPORT-FE-1 (23-08): the compact "create these from file" card and its
// wizard/permission wiring, shared verbatim with AddVacancyModal/AddCustomerModal
// (CLAUDE.md §4 import canon + §11 — never a second import client).
import EntityImportCard from '@/components/import/EntityImportCard'
import { useEntityImportCard } from '@/components/import/useEntityImportCard'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import ModalHeader from './addmodal/ModalHeader'
import ModalFooter from './addmodal/ModalFooter'
import NoStatusNotice from './addmodal/NoStatusNotice'
import DuplicateNotice from '@/components/forms/DuplicateNotice'
import { useDuplicateProbe, useRestoreDuplicate } from './addmodal/useDuplicateProbe'
import type { DuplicateMatch } from './addmodal/useDuplicateProbe'
import PersonalCard from './addmodal/PersonalCard'
import ContactCard from './addmodal/ContactCard'
import WorkCard from './addmodal/WorkCard'
import AddressCard from './addmodal/AddressCard'
import ProfileTextCard from './addmodal/ProfileTextCard'
import BranchesCard from './addmodal/BranchesCard'
import CvUploadCard from './addmodal/CvUploadCard'
import PasteCvCard from './addmodal/PasteCvCard'
import { CvFilledContext } from './addmodal/cvFilledContext'
import { useCvPrefill } from './addmodal/useCvPrefill'
import { useLiveFieldValidation } from './addmodal/useLiveFieldValidation'
import { useRequiredFields } from './addmodal/useRequiredFields'
import { useCreateCandidateSubmit } from './addmodal/useCreateCandidateSubmit'

// The backend importer key for a candidate file — verified against
// koiosmatch-api's ImportRegistry::IMPORTERS ('candidates' => CandidateImporter::class)
// and importTemplateShape.ts's importPermissionsFor (candidates.view/candidates.create),
// never guessed from the entity's display name.
const CANDIDATE_IMPORT_ENTITY = 'candidates'

interface AppUser { id: Id; name?: string; firstname?: string; lastname?: string; [k: string]: unknown }

// Exported so the addmodal/ card components share this exact shape (type-only import).
export interface FormState {
  firstName: string; middleName: string; lastName: string; functionTitle: string
  email: string; phone: string; mobile: string; dateOfBirth: string; gender: string
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; city: string; province: string
  // COUNTRY-1: home-address country (ISO-2 code, empty until picked).
  country: string
  ownerId: string | number
  // PROFILE-TEXT-1 (Danny 02-08): the profile text, same field the drawer's
  // ProfileTab edits later — collected here via the shared collapsed-ghost block
  // (addmodal/ProfileTextCard) so it can already ride along on create.
  summary: string
  // CONTACT-LINKEDIN-1 (Danny 06-08): mirrors the drawer's own Contact tab and the
  // customer contact modal — a bare slug or a pasted full URL, stripped to the
  // clean slug at the save boundary (toLinkedinSlug), never sent as typed.
  linkedin: string
}

interface AddCandidateModalProps {
  onClose: () => void
  onCreated?: (candidate: Candidate) => void
  /** CAND-IMPORT-FE-1: called once a real file import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
}

// The candidate create modal: the manual form, with the Excel import card (CAND-IMPORT-FE-1)
// shown above it once the recruiter opens it from the header.
export default function AddCandidateModal({ onClose, onCreated, onImported }: AddCandidateModalProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const { phases } = useLookups() as unknown as { phases: LookupOption[] }
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { user: me, hasPermission } = useAuth() as unknown as {
    user: { id?: Id; branch_ids?: Array<string | number> } | null
    hasPermission?: (perm: string) => boolean
  }
  const { genders } = useGenders()
  // Searchable comboboxes (Danny r2): function title from the functions lookup
  // (the free-entry toggle decides whether typing may produce a new value),
  // provinces from the lookup.
  // DEMO-TAAL-1: pass the translated option list (raw value, translated label) to the picker.
  const { functionOptions, allowFreeEntry } = useFunctions()
  const { createCandidate, saving } = useCreateCandidate()
  // Cross-entity jump (house pattern, same as EntityLink): opens the candidates
  // page + drawer for an existing record without prop-drilling a callback.
  const { openEntity } = useNavigation()
  const { restore, restoring } = useRestoreDuplicate()

  // On create you pick the PHASE (Lead/Kandidaat); deployability defaults to available.
  // On create you pick the PHASE; deployability defaults to available. The full
  // tenant-configured phase list is offered (21-hygiene, 2026-08-14) — a hardcoded
  // ['lead','candidate'] filter used to silently drop a renamed or newly added
  // phase from the create picker.
  const pickStatuses = phases
  // Default entry phase is flag-driven (§3B: is_default), not the hardcoded 'lead' key.
  const defaultStatus = () => pickStatuses.find(s => (s as { is_default?: boolean }).is_default)?.value ?? pickStatuses[0]?.value ?? ''

  const [status,    setStatus]    = useState(defaultStatus)
  const [errors,    setErrors]    = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  // CAND-IMPORT-FE-1: the import flow opens from the header button (closed on
  // open, mirrors AddVacancyModal/AddCustomerModal's importOpen). The
  // wizard/permission/auto-close wiring lives in the shared useEntityImportCard.
  const [importOpen, setImportOpen] = useState(false)
  const { wizard: importWizard, canView: canViewImportTemplate, canImport: canRunImport } =
    useEntityImportCard({
      entity: CANDIDATE_IMPORT_ENTITY,
      hasPermission: (perm: string) => hasPermission?.(perm) ?? false,
      onImported, onClose,
    })
  // C-29: the duplicate the server REFUSED the create on (409 `existing`), kept so
  // the user gets a real panel instead of the raw server sentence.
  const [dupBlock,  setDupBlock]  = useState<DuplicateMatch | null>(null)
  // Which advisory probe hit the user waved away (so "edit data" really dismisses).
  // Point 10: branch chips — pre-filled with the creator's own branch links from
  // /auth/me (ME-BRANCHES-1). Empty = omit the field → the backend automatically
  // links the creator's own branches (point 9); a different pick is sent
  // explicitly in the create body and wins outright (CREATE-BRANCHES-1).
  const locations = useLocations()
  const seedBranchIds = (me?.branch_ids ?? []).map(String)
  const [branchIds, setBranchIds] = useState<string[]>(seedBranchIds)
  const [form, setForm] = useState<FormState>({
    firstName: '', middleName: '', lastName: '',
    functionTitle: '',
    email: '', phone: '', mobile: '',
    dateOfBirth: '', gender: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '',
    // Owner defaults to the logged-in user; recruiter can change it.
    ownerId: me?.id ?? '',
    summary: '',
    linkedin: '',
  })

  // DUPPOST: live "warn while you type" probe over the POST endpoint (§7-safe — body,
  // not query string). Advisory only; the create 409 stays the real gate (dupBlock).
  const { probeMatch, clearProbeMatch } = useDuplicateProbe(form.email, form.mobile, form.phone)

  // Once the real statuses arrive from the API, default to Lead if nothing chosen.
  useEffect(() => { if (!status && phases.length) setStatus(defaultStatus()) }, [phases]) // eslint-disable-line

  // Province list CASCADES on the picked country (Danny addendum) — its own cache
  // slot per country (useProvinces), so switching country never leaks another
  // country's list in. If the country changes and the currently filled province no
  // longer exists in the new list, clear it rather than silently keep a mismatch.
  const { provinces } = useProvinces(form.country)
  // Clears the picked province when it no longer exists in the country-scoped list above.
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setForm(f => ({ ...f, province: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  // CV-PARSER-1 (Danny 2026-07-31): a parsed CV PREFILLS this form and never saves —
  // the recruiter's own create click stays the single confirmation step.
  const applyCvPatch = useCallback((patch: Partial<FormState>) => {
    setForm(f => ({ ...f, ...patch }))
    setErrors({})
  }, [])
  const { cv, cvFilled, summary: cvSummary, clearMark } = useCvPrefill(form, applyCvPatch)
  // PASTE-CV-1: a second call to the SAME hook, which gives it its own independent
  // parse instance (own phase/error) for free — no separate hook needed.
  const { cv: pasteCv, cvFilled: pasteCvFilled, summary: pasteCvSummary, clearMark: clearPasteMark } = useCvPrefill(form, applyCvPatch)
  // Marks from either path share one "from CV, check me" context — a field can
  // only have come from one of them at a time in practice, so a union is safe.
  const combinedCvFilled = new Set<string>([...cvFilled, ...pasteCvFilled])
  // VALIDATIE-LIVE-1 (§3 size split): live format checks + the 422 field message
  // resolution — own sibling hook, fed the live form so a message always reflects
  // the value currently on screen.
  const { setFieldMessages, markTouched, fieldMessage, clearFieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t)

  // Central field-change handler: updates the form value and clears every stale
  // validation/duplicate signal that no longer applies to the edited field.
  const set = (k: keyof FormState, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    // A fresh edit invalidates any server 422 message shown for this field.
    clearFieldMessage(k)
    setSubmitErr(null)
    // Editing a CV-prefilled field means the recruiter checked it — drop the mark
    // on whichever path (file or paste) filled it.
    clearMark(k)
    clearPasteMark(k)
    // Editing anything invalidates the refused-create verdict; the next submit re-asks
    // the server (which stays the only authority on what is a duplicate).
    setDupBlock(null)
    // Editing email/mobile/phone clears the last probe verdict too — the debounced
    // effect in useDuplicateProbe re-asks the server for the new value.
    clearProbeMatch()
  }

  // The blocked panel (create 409) takes priority over the ambient live-probe warning;
  // dismissing the warning only clears the probe verdict, never the (absent) 409 one.
  const dupNotice = dupBlock ?? probeMatch
  const dismissNotice = () => { setDupBlock(null); clearProbeMatch() }

  // Leave the create form and open the existing dossier (nothing was created here).
  const openExisting = (id: Id) => { onClose(); openEntity('candidates', id) }
  // Archived duplicate: bring it back, then open it. Restore is permission-gated in
  // the UI and re-checked by the backend (§7).
  const restoreAndOpen = async (id: Id) => { if (await restore(id)) openExisting(id) }

  // Required fields for the chosen phase (Settings → Verplichte velden) — own
  // sibling hook (§3 size split), fed the current phase.
  const { requiredForm, isReq } = useRequiredFields(status)

  // VALIDATIE-SUBMIT-1 (§3 size split): validation + payload assembly + 409/422
  // mapping live in the sibling hook; error state stays owned here, only the
  // setters are injected (mirrors useAddVacancySubmit's error-state lesson).
  const { handleSubmit } = useCreateCandidateSubmit({
    setErrors, setSubmitErr, setFieldMessages, setDupBlock,
    form, status, branchIds, requiredForm, touchInvalidFields, createCandidate, onCreated, onClose, t,
  })

  const selectedStatus = phases.find(s => s.value === status)
  // CAND-IMPORT-FE-1: blocked while an import is past its upload step (preview or
  // result) — never let the manual form fire a SECOND create while the import is
  // mid-decision or has just written its own records (mirrors AddVacancyModal).
  const canSubmit       = !!status && requiredForm.every(k => String(form[k] ?? '').trim()) && !hasFormatError
    && importWizard.step === 'upload'
  const statusLabel     = selectedStatus?.label ?? ''
  // RECHTEN-DETAIL-1: both parse routes gate on candidates.create now
  // (routes/api/tenant/candidates.php:60-61, re-measured 06-08).
  const canParseCv     = hasPermission?.('candidates.create') ?? false

  // Gender options come from the /genders tenant lookup (CFG-1), not hardcoded.
  const genderOptions = genders.map(g => ({ value: g.value, label: g.label }))

  // Build owner dropdown from the users list; make sure the logged-in default is
  // actually IN it (a super admin isn't always in the assignable list — the
  // select rendered blank while ownerId was set; mirror of the kans-modal fix).
  const ownerOptions = users.map(u => ({ value: String(u.id), label: u.name ?? `${u.firstname} ${u.lastname}`.trim() }))
  if (me?.id && !ownerOptions.some(o => o.value === String(me.id))) {
    ownerOptions.unshift({ value: String(me.id), label: (me as { name?: string }).name ?? '' })
  }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; same WIDE_MODAL footprint as before
    // (src/components/ui/modalMetrics.ts stays the ONE place to resize the wide trio).
    // The bespoke phase header (ModalHeader, incl. its own X) fills the drag handle
    // edge-to-edge via negative margins; hideClose avoids a second X.
    <FloatingPanel open onClose={onClose} ariaLabel={t('modal.candidateData')}
      persistKey="add-candidate" scrollBody={false} hideClose
      width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`} maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ flex: '1 1 100%', margin: '-12px -16px -13px' }}>
          <ModalHeader status={status} pickStatuses={pickStatuses} selectedStatus={selectedStatus} statusLabel={statusLabel}
            onSelectStatus={v => { setStatus(v); setErrors({}) }} onClose={onClose}
            canParseCv={canParseCv} onCvFile={cv.start} onCvText={pasteCv.startText}
            canImport={canRunImport} importOpen={importOpen} onToggleImport={() => setImportOpen(v => !v)}
            hasFile={!!importWizard.file} />
        </div>
      }>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* CAND-IMPORT-FE-1: the import flow opens from the header toggle and
                renders as the FIRST card only while open — a rare, optional path
                stays out of the way until deliberately summoned (KLANT-LAYOUT-3
                mirror), regardless of whether a phase is picked yet. */}
            {importOpen && (
              <div style={{ ...cardBox, padding: 16, marginBottom: 16 }}>
                <div style={cardHead}>{t('modal.import.title')}</div>
                <EntityImportCard wizard={importWizard} canView={canViewImportTemplate} canImport={canRunImport}
                  entity={CANDIDATE_IMPORT_ENTITY} intro={t('modal.import.intro')} />
              </div>
            )}
            {!status ? (
              <NoStatusNotice />
            ) : (
              // Two-column grid of titled cards (Optie A) — Persoonlijk/Adres span both
              // columns (their paired rows need the width); Contact/Werk, and now
              // Profiel-tekst/Vestiging (Danny 05-08: profile text LEFT, mirroring the
              // +Match modal's own left text column) sit side by side. Built from the
              // shared modalColumns helper (components/ui/modalCards) — same convention
              // as +Match's twoColSections — with this form's own tighter gap (14 vs the
              // helper's 24 default) kept via an explicit override.
              // Each card is a presentational component under addmodal/ (§refactor 2026-07-20).
              // CvFilledContext lets each card mark its own CV-prefilled fields
              // without drilling the set through two levels (§3).
              <CvFilledContext.Provider value={combinedCvFilled}>
                <div style={{ ...modalColumns(), gap: 14 }}>
                  {/* Both parse routes require candidates.update — hide the control when
                      it would 403 rather than offer an affordance that cannot work.
                      CV-ENTRY-ICONS-1: starting a parse now happens from the header's
                      icons (ModalHeader/CvEntryIcons) — these only render the busy/
                      ready/error progress strip once a parse has actually started. */}
                  {canParseCv && (
                    <>
                      <CvUploadCard phase={cv.phase} errorKey={cv.errorKey} fileName={cv.fileName}
                        summary={cvSummary} onReset={cv.reset} />
                      {/* PASTE-CV-1: independent phase/summary, a text alternative to the file picker. */}
                      <PasteCvCard phase={pasteCv.phase} errorKey={pasteCv.errorKey}
                        summary={pasteCvSummary} onReset={pasteCv.reset} />
                    </>
                  )}
                  <PersonalCard form={form} errors={errors} set={set} isReq={isReq} genderOptions={genderOptions} />
                  <ContactCard form={form} errors={errors} set={set} isReq={isReq} onBlur={markTouched} fieldMessage={fieldMessage} />
                  <WorkCard form={form} set={set} isReq={isReq} allowFreeEntry={allowFreeEntry} functions={functionOptions} ownerOptions={ownerOptions} />
                  <AddressCard form={form} errors={errors} set={set} isReq={isReq} provinces={provinces} />
                  <ProfileTextCard form={form} set={set} />
                  <BranchesCard branchIds={branchIds} setBranchIds={setBranchIds} locations={locations} />
                </div>
              </CvFilledContext.Provider>
            )}
          </div>

          {/* Duplicate: the refused create (409) or the live probe hit — one panel,
              with real actions (open / restore-and-open). */}
          {dupNotice && (
            <DuplicateNotice match={dupNotice} variant={dupBlock ? 'blocked' : 'warning'}
              canRestore={hasPermission?.('candidates.update') ?? false} restoring={restoring}
              onOpen={() => openExisting(dupNotice.id)} onRestore={() => restoreAndOpen(dupNotice.id)}
              onDismiss={dismissNotice} />
          )}
          {/* General submit error (non-422 responses) */}
          {submitErr && (
            <div style={{ margin: '0 24px 8px', padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)', border: '1px solid var(--color-danger)' }}>
              {submitErr}
            </div>
          )}

          <ModalFooter onClose={onClose} onSubmit={handleSubmit} canSubmit={canSubmit} saving={saving}
            hasType={!!selectedStatus} statusLabel={statusLabel} />
    </FloatingPanel>
  )
}
