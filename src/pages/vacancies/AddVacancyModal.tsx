/**
 * AddVacancyModal — create a vacancy. SLICE 1+2 of Danny's 22-point spec: split
 * into `addmodal/` (mirrors pages/candidates/addmodal/) — one component per
 * card, all state/lookups/cascade/submit logic in useAddVacancyForm. This file
 * is now a thin assembler (shell + card wiring only); 30+ fields across eleven
 * cards would have blown a single-file component well past the ~400-line
 * split trigger (§3). The landed prefill props (lockCustomerId/lockCustomerName,
 * initialCustomerLocationId/DepartmentId/Names) keep working exactly as before
 * — only `initialIndustry` is new (punt 4). SLICE 2 adds Matchprofiel/AI-agent/
 * Publicatie cards and (permission-gated) a Documenten+notitie card whose
 * uploads/note run AFTER create via the separate usePostCreateAttachments hook
 * — nothing pending keeps the exact pre-SLICE-2 immediate-close behaviour.
 *
 * EXCEL-VACATURES-1 (Danny 14-08, screenshot: "Excel importeren moet in de
 * pop-up + nieuwe vacature niet hier boven de tabel!!", i.e. "Excel import
 * must be in the popup + new vacancy, not here above the table!!"): the Excel/CSV bulk
 * upload moved off the list toolbar into THIS modal — mirrors AddCustomerModal's
 * KLANT-LAYOUT-3 shape verbatim: a header toggle (ModalHeader), the import flow
 * as the FIRST card in the body while open, wired to the same shared
 * useEntityImportCard/EntityImportCard the customer modal uses, pointed at the
 * 'vacancies' importer (never a second upload implementation, §11).
 */
import { useEffect, useState } from 'react'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { tintBorder } from '@/lib/tint'
import { cardBox, cardHead } from '@/components/ui/modalCards'
import CollapsedCard from '@/components/ui/CollapsedCard'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { useAuth } from '@/context/AuthContext'
import EntityImportCard from '@/components/import/EntityImportCard'
import { useEntityImportCard } from '@/components/import/useEntityImportCard'
import { useAddVacancyForm } from './addmodal/useAddVacancyForm'
import { usePostCreateAttachments } from './addmodal/usePostCreateAttachments'
import ModalHeader from './addmodal/ModalHeader'
import GeneralCard from './addmodal/GeneralCard'
import ClientCascadeCard from './addmodal/ClientCascadeCard'
import PlacementCard from './addmodal/PlacementCard'
import RequirementsCard from './addmodal/RequirementsCard'
import ConditionsCard from './addmodal/ConditionsCard'
import DescriptionCard from './addmodal/DescriptionCard'
import MatchProfileCard from './addmodal/MatchProfileCard'
import AiAgentCard from './addmodal/AiAgentCard'
import PublicationCard from './addmodal/PublicationCard'
import AttachmentsCard from './addmodal/AttachmentsCard'
import PostCreateResultsPanel from './addmodal/PostCreateResultsPanel'
import RecruiterCard from './addmodal/RecruiterCard'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

// The backend importer key for a whole-vacancy file — verified against
// koiosmatch-api's ImportRegistry::IMPORTERS ('vacancies' => VacancyImporter::class)
// and importTemplateShape.ts's importPermissionsFor (vacancies.view/vacancies.create),
// never guessed from the entity's display name.
const VACANCY_IMPORT_ENTITY = 'vacancies'

// TABBLADEN-1 (Danny 27-08: "tabbladen zijn beter omdat je kan switchen") —
// maps every form field name (the useAddVacancyForm/useAddVacancySubmit
// vocabulary) onto the tab that must become active when that field carries a
// client- or server-side (422) validation error, so a failed submit always
// lands the recruiter on the right tab instead of a silent no-op.
const FIELD_TO_TAB: Record<string, string> = {
  title: 'general', status: 'general', ownerId: 'general', clientId: 'general',
  industry: 'general', category: 'general', location: 'general',
  customerLocationId: 'general', customerDepartmentId: 'general', contactId: 'general',
  contractTypes: 'general', startDate: 'general', endDate: 'general',
  street: 'general', houseNumber: 'general', houseNumberSuffix: 'general',
  postalCode: 'general', city: 'general', province: 'general', country: 'general', branchId: 'general',
  seniority: 'requirements', education: 'requirements', skills: 'requirements',
  salaryMin: 'requirements', salaryMax: 'requirements', salaryPeriod: 'requirements',
  hoursMin: 'requirements', hoursMax: 'requirements',
  description: 'description',
  matchWeightTemplateId: 'matching', matchWeights: 'matching',
  aiAgentId: 'aiAgent',
  published: 'publication', publishedChannels: 'publication', applicationSettings: 'publication',
}

// Thin assembler for the create-vacancy modal (see file docblock above): shell
// + card wiring only, all state/lookups/submit logic lives in useAddVacancyForm.
export default function AddVacancyModal({
  onClose, onCreated, onImported, users = [], customers = [], lockCustomerId, lockCustomerName,
  initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
  initialIndustry,
}: {
  onClose: () => void; onCreated?: (v: Vacancy) => void
  /** EXCEL-VACATURES-1: called once a real file import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
  users?: ModalUser[]; customers?: ModalCustomer[]
  // Opened from a customer drawer: the client is already known, so it is
  // pre-filled and shown read-only instead of asking the recruiter to pick the
  // customer they are already looking at (mirrors AddDepartmentModal's lockLocationId).
  lockCustomerId?: string; lockCustomerName?: string
  // Opened from a location/department drill-down's own "+ Vacature" — seeds
  // the ClientCascadeCard's cascade (punt 6), still editable from there.
  initialCustomerLocationId?: string; initialCustomerDepartmentId?: string
  initialCustomerLocationName?: string; initialCustomerDepartmentName?: string
  // Punt 4: prefilled ONLY when active for this tenant (useAddVacancyForm
  // validates against the live /industries list) — an inactive/unknown name
  // would 422, so it silently falls back to empty instead.
  initialIndustry?: string
}) {
  // Punten 21+22: a SEPARATE hook (own lifecycle: pick now, run after create) —
  // handed into useAddVacancyForm only so submit can sequence it (§ own hook).
  const attachments = usePostCreateAttachments()
  const f = useAddVacancyForm({
    onClose, onCreated, users, customers, lockCustomerId,
    initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
    initialIndustry, attachments,
  })
  // EXCEL-VACATURES-1: the import affordance opens from the header button
  // (closed on open, mirrors AddCustomerModal's importOpen/KLANT-LAYOUT-3).
  const [importOpen, setImportOpen] = useState(false)
  // TABBLADEN-1: free-switching tabs (no wizard/step gating) — component-local
  // active-tab state only; the form itself keeps living in useAddVacancyForm,
  // so nothing here remounts and typed values survive every tab switch.
  const [activeTab, setActiveTab] = useState('general')
  const tabs = [
    { id: 'general', label: f.t('modal.tabs.general') },
    { id: 'requirements', label: f.t('modal.tabs.requirements') },
    { id: 'description', label: f.t('modal.tabs.description') },
    { id: 'matching', label: f.t('modal.tabs.matching') },
    ...(f.showAiAgentCard ? [{ id: 'aiAgent', label: f.t('modal.tabs.aiAgent') }] : []),
    { id: 'publication', label: f.t('modal.tabs.publication') },
    ...(f.showAttachmentCards ? [{ id: 'attachments', label: f.t('modal.tabs.attachments') }] : []),
  ]
  // Any field carrying an error (required-title client check or a mapped 422)
  // jumps the view to its owning tab, so a failed submit is never silent.
  useEffect(() => {
    const badField = Object.keys(f.errors).find(k => f.errors[k])
    const tab = badField ? FIELD_TO_TAB[badField] : undefined
    if (tab) setActiveTab(tab)
  }, [f.errors])
  const authCtx = useAuth() as unknown as { hasPermission?: (perm: string) => boolean }
  const hasPermission = authCtx.hasPermission ?? (() => false)
  const { wizard: importWizard, canView: canViewImportTemplate, canImport: canRunImport } =
    useEntityImportCard({ entity: VACANCY_IMPORT_ENTITY, hasPermission, onImported, onClose })

  // Punten 21+22: the vacancy already exists once this is true — show the
  // per-item post-create outcome instead of the form, Close is the recruiter's call.
  if (f.postCreatePhase) {
    return (
      // POPUP-SLEEP-1: the post-create results dialog rides the same shared
      // FloatingPanel shell (its own persistKey — it is its own window).
      <FloatingPanel open onClose={onClose} title={f.t('modal.attachments.resultsTitle')}
        ariaLabel={f.t('modal.attachments.resultsTitle')} persistKey="add-vacancy-results"
        scrollBody={false} width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`} maxWidth={`${WIDE_MODAL.maxWidth}px`}>
          <PostCreateResultsPanel files={attachments.files} noteText={attachments.noteText}
            noteStatus={attachments.noteStatus} noteError={attachments.noteError} running={attachments.running}
            onRetryFile={attachments.retryFile} onRetryNote={attachments.retryNote} onClose={onClose} />
      </FloatingPanel>
    )
  }

  // EXCEL-VACATURES-1: blocked while an import is past its upload step (preview
  // or result) — never let the manual form fire a SECOND create while the import
  // is mid-decision or has just written its own records (mirrors AddCustomerModal).
  const canSubmit = f.canSubmit && importWizard.step === 'upload'

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position; same WIDE_MODAL footprint. The
    // bespoke ModalHeader (title + status pills + its own X) fills the drag
    // handle via negative margins, so the panel's built-in X is hidden.
    <FloatingPanel open onClose={onClose} ariaLabel={f.t('modal.title')}
      persistKey="add-vacancy" scrollBody={false} hideClose
      // WIDER (Danny 08-08: "Nieuwe vacature mag breder zijn dus knoppen naar
      // rechts", i.e. "New vacancy may be wider so buttons go to the right"):
      // the shared 1060px cap squeezed the header so the title wrapped
      // onto two lines and the status pills sat right against it. This form has
      // three column groups, so it gets its own, wider cap — the shared
      // WIDE_MODAL stays untouched for every other modal.
      width="94vw" maxWidth="1320px"
      header={
        <div style={{ flex: 1, margin: '-12px -16px -13px' }}>
          <ModalHeader status={f.form.status} statusOptions={f.statusOptions}
            onSelectStatus={v => f.set('status', v)} onClose={onClose}
            canImport={canRunImport} importOpen={importOpen} onToggleImport={() => setImportOpen(v => !v)}
            hasFile={!!importWizard.file} />
        </div>
      }>

        {/* TABBLADEN-1 (Danny 27-08): free-switching tabs replace the old long
            scroll — the house DrawerTabs bar, own tab ids, i18n labels x5.
            Panes stay MOUNTED and are only hidden (never unmounted) while
            inactive, so typed values and any in-flight card state survive a
            switch without re-wiring anything in useAddVacancyForm. */}
        <div style={{ padding: '0 22px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <DrawerTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* EXCEL-VACATURES-1 (Danny 14-08): the import flow opens from the header
              toggle and renders as the FIRST card only while open, above every tab —
              a rare, optional path stays out of the way until deliberately summoned
              (KLANT-LAYOUT-3 mirror). One row = one vacancy here, never a linked
              multi-record tree, so wholeTree stays false (the EntityImportCard/
              PreviewStep default). */}
          {importOpen && (
            <div style={{ ...cardBox, padding: 16 }}>
              <div style={cardHead}>{f.t('modal.import.title')}</div>
              <EntityImportCard wizard={importWizard} canView={canViewImportTemplate} canImport={canRunImport}
                entity={VACANCY_IMPORT_ENTITY} intro={f.t('modal.import.intro')} />
            </div>
          )}

          {/* General — title/function/industry (GeneralCard), the client cascade,
              assignment/address/contract form (PlacementCard) and the recruiter. */}
          <div style={{ display: activeTab === 'general' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
            <GeneralCard
              title={f.form.title} onTitleChange={v => f.set('title', v)} titleError={f.errors.title}
              category={f.form.category} onCategoryChange={v => f.set('category', v)} functions={f.functions}
              industry={f.form.industry} onIndustryChange={v => f.set('industry', v)} industries={f.industries}
            />
            <ClientCascadeCard
              lockCustomerId={lockCustomerId} lockCustomerName={lockCustomerName}
              clientId={f.form.clientId} onClientChange={f.handleClientChange} customerOptions={f.customerOptions}
              locationPicker={f.locationPicker} departmentPicker={f.departmentPicker} contactPicker={f.contactPicker}
            />
            <PlacementCard
              contractTypes={f.form.contractTypes} candidateTypes={f.candidateTypes} onToggleType={f.toggleContractType}
              startDate={f.form.startDate} endDate={f.form.endDate}
              onStartDateChange={v => f.set('startDate', v)} onEndDateChange={v => f.set('endDate', v)}
              street={f.form.street} houseNumber={f.form.houseNumber} houseNumberSuffix={f.form.houseNumberSuffix}
              postalCode={f.form.postalCode} city={f.form.city} province={f.form.province} country={f.form.country}
              onFieldChange={f.onAddressChange} provinces={f.provinces}
              branchId={f.form.branchId} onBranchChange={f.handleBranchChange} branchOptions={f.branchOptions}
            />
            <RecruiterCard ownerId={f.form.ownerId} onOwnerChange={v => f.set('ownerId', v)} userOptions={f.userOptions} />
          </div>

          {/* Conditions & requirements — what the job requires and offers. */}
          <div style={{ display: activeTab === 'requirements' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
            <RequirementsCard
              seniority={f.form.seniority} onSeniorityChange={v => f.set('seniority', v)} seniorityLevels={f.seniorityLevels}
              education={f.form.education} onEducationChange={v => f.set('education', v)} educationLevels={f.educationLevels}
              skills={f.skills} onAddSkill={f.addSkill} onEditSkill={f.editSkill} onRemoveSkill={f.removeSkill}
            />
            <ConditionsCard
              salaryMin={f.form.salaryMin} salaryMax={f.form.salaryMax} salaryPeriod={f.form.salaryPeriod}
              hoursMin={f.form.hoursMin} hoursMax={f.form.hoursMax}
              onChange={f.onConditionsChange}
            />
          </div>

          {/* Vacancy text — the free-text description card, own tab (rich text needs room). */}
          <div style={{ display: activeTab === 'description' ? 'block' : 'none' }}>
            <DescriptionCard value={f.form.description} onChange={v => f.set('description', v)}
              expanded={f.descExpanded} setExpanded={f.setDescExpanded} editing={f.descEditing} setEditing={f.setDescEditing}
              genFields={f.genFields} />
          </div>

          {/* Match profile / AI agent / Publication / Documents & note — each its
              own tab now; CollapsedCard stays UNCHANGED (pure recomposition) so its
              own collapsed-by-default/filled-dot behaviour is untouched. */}
          <div style={{ display: activeTab === 'matching' ? 'block' : 'none' }}>
            <CollapsedCard title={f.t('modal.fields.cardMatching')} filled={!!f.matchWeightTemplateId || !!f.matchWeights}>
              <MatchProfileCard templateId={f.matchWeightTemplateId} onTemplateChange={f.setMatchWeightTemplateId}
                onWeightsChange={f.setMatchWeights} />
            </CollapsedCard>
          </div>
          {/* Punt 19: rendered as NOTHING without module `aiagents` + settings.view —
              GET /ai/agents is gated on both, never a disabled tease (§3) — the tab
              itself is filtered out of `tabs` above, and its pane never mounts. */}
          {f.showAiAgentCard && (
            <div style={{ display: activeTab === 'aiAgent' ? 'block' : 'none' }}>
              <CollapsedCard title={f.t('modal.fields.cardAiAgent')} filled={!!f.aiAgentId}>
                <AiAgentCard agentId={f.aiAgentId} onAgentChange={f.setAiAgentId} showSuggestion={f.showAgentSuggestion} />
              </CollapsedCard>
            </div>
          )}
          <div style={{ display: activeTab === 'publication' ? 'block' : 'none' }}>
            <CollapsedCard title={f.t('modal.fields.cardPublication')}
              filled={f.published || f.channels.some(c => c.published) || f.applicationSettingsTouched}>
              <PublicationCard published={f.published} onPublishedChange={f.setPublished}
                channels={f.channels} onToggleChannel={f.toggleChannel}
                applicationSettings={f.applicationSettings} onSettingChange={f.setApplicationSetting} />
            </CollapsedCard>
          </div>
          {/* Punten 21+22: both POST .../documents and .../notes need vacancies.update
              next to vacancies.create (measured) — the tab is filtered out of `tabs`
              entirely without it, so its pane never mounts either. */}
          {f.showAttachmentCards && (
            <div style={{ display: activeTab === 'attachments' ? 'block' : 'none' }}>
              <CollapsedCard title={f.t('modal.attachments.cardTitle')} filled={attachments.hasPending}>
                <AttachmentsCard files={attachments.files} onAddFile={attachments.addFile} onRemoveFile={attachments.removeFile}
                  noteText={attachments.noteText} onNoteChange={attachments.setNoteText} />
              </CollapsedCard>
            </div>
          )}
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {f.createError && (
          <div role="alert" style={{ margin: '0 22px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
            border: tintBorder('var(--color-danger)', true), flexShrink: 0 }}>
            {f.createError}
          </div>
        )}

        {/* Footer — Button owns the height (sm, 28px) for every text/action button, everywhere. */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>
            {f.t('modal.cancel')}
          </Button>
          <Button variant="primary" onClick={f.handleSubmit} disabled={!canSubmit || f.saving}>
            {f.saving ? f.t('modal.creating') : f.t('modal.create')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
