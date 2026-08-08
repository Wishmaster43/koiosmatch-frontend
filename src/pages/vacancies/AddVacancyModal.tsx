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
 */
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { BTN_H } from '@/config/buttonMetrics'
import { modalColumns } from '@/components/ui/modalCards'
import CollapsedCard from '@/components/ui/CollapsedCard'
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

interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

export default function AddVacancyModal({
  onClose, onCreated, users = [], customers = [], lockCustomerId, lockCustomerName,
  initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
  initialIndustry,
}: {
  onClose: () => void; onCreated?: (v: Vacancy) => void; users?: ModalUser[]; customers?: ModalCustomer[]
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

  // Punten 21+22: the vacancy already exists once this is true — show the
  // per-item post-create outcome instead of the form, Close is the recruiter's call.
  if (f.postCreatePhase) {
    return (
      // POPUP-SLEEP-1: the post-create results dialog rides the same shared
      // FloatingPanel shell (its own persistKey — it is its own window).
      <FloatingPanel open onClose={onClose} title={f.t('modal.attachments.resultsTitle')}
        ariaLabel={f.t('modal.attachments.resultsTitle')} persistKey="add-vacancy-results"
        scrollBody={false} width="min(calc(100vw - 48px), 1060px)" maxWidth={`${WIDE_MODAL.maxWidth}px`}>
          <PostCreateResultsPanel files={attachments.files} noteText={attachments.noteText}
            noteStatus={attachments.noteStatus} noteError={attachments.noteError} running={attachments.running}
            onRetryFile={attachments.retryFile} onRetryNote={attachments.retryNote} onClose={onClose} />
      </FloatingPanel>
    )
  }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position; same WIDE_MODAL footprint. The
    // bespoke ModalHeader (title + status pills + its own X) fills the drag
    // handle via negative margins, so the panel's built-in X is hidden.
    <FloatingPanel open onClose={onClose} ariaLabel={f.t('modal.title')}
      persistKey="add-vacancy" scrollBody={false} hideClose
      // WIDER (Danny 08-08: "Nieuwe vacature mag breder zijn dus knoppen naar
      // rechts"): the shared 1060px cap squeezed the header so the title wrapped
      // onto two lines and the status pills sat right against it. This form has
      // three column groups, so it gets its own, wider cap — the shared
      // WIDE_MODAL stays untouched for every other modal.
      width="94vw" maxWidth="1320px"
      header={
        <div style={{ flex: 1, margin: '-12px -16px -13px' }}>
          <ModalHeader status={f.form.status} statusOptions={f.statusOptions}
            onSelectStatus={v => f.set('status', v)} onClose={onClose} />
        </div>
      }>

        {/* Form — A+D layout (Danny 03-08 decision, shared primitives from
            components/ui/modalCards + CollapsedCard, commit 4845a6ee): required-core
            cards (Algemeen/Klant/Inzet/Recruiter) sit LEFT, content cards
            (Functie-eisen/Voorwaarden/Vacaturetekst) sit RIGHT via the shared
            modalColumns two-column grid (falls back to one column at narrow widths,
            mirrors AddLocationModal's exact idiom); the four secondary/optional
            cards (Matchprofiel/AI-agent/Publicatie/Documenten+notitie) collapse
            full-width below — never a required field inside a CollapsedCard. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={modalColumns('repeat(auto-fit, minmax(340px, 1fr))')}>
            {/* LEFT — required core: what/who/where/whom this vacancy is for. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                branchId={f.form.branchId} onBranchChange={v => f.set('branchId', v)} branchOptions={f.branchOptions}
              />
              <RecruiterCard ownerId={f.form.ownerId} onOwnerChange={v => f.set('ownerId', v)} userOptions={f.userOptions} />
            </div>

            {/* RIGHT — content: what the job requires, offers, and reads like. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RequirementsCard
                seniority={f.form.seniority} onSeniorityChange={v => f.set('seniority', v)} seniorityLevels={f.seniorityLevels}
                education={f.form.education} onEducationChange={v => f.set('education', v)} educationLevels={f.educationLevels}
                skills={f.skills} newSkill={f.newSkill} onNewSkillChange={f.setNewSkill} onAddSkill={f.addSkill} onRemoveSkill={f.removeSkill}
              />
              <ConditionsCard
                salaryMin={f.form.salaryMin} salaryMax={f.form.salaryMax} salaryPeriod={f.form.salaryPeriod}
                hoursMin={f.form.hoursMin} hoursMax={f.form.hoursMax}
                onChange={f.onConditionsChange}
              />
              <DescriptionCard value={f.form.description} onChange={v => f.set('description', v)}
                expanded={f.descExpanded} setExpanded={f.setDescExpanded} editing={f.descEditing} setEditing={f.setDescEditing}
                genFields={f.genFields} />
            </div>
          </div>

          {/* Secondary/optional — collapsed by default (A+D decision): each card's
              `filled` dot lights up once it holds a real value, so a recruiter can
              tell at a glance what still needs a look without expanding everything. */}
          <CollapsedCard title={f.t('modal.fields.cardMatching')} filled={!!f.matchWeightTemplateId || !!f.matchWeights}>
            <MatchProfileCard templateId={f.matchWeightTemplateId} onTemplateChange={f.setMatchWeightTemplateId}
              onWeightsChange={f.setMatchWeights} />
          </CollapsedCard>
          {/* Punt 19: rendered as NOTHING without module `aiagents` + settings.view —
              GET /ai/agents is gated on both, never a disabled tease (§3) — the
              CollapsedCard itself must not exist without access, not just its body. */}
          {f.showAiAgentCard && (
            <CollapsedCard title={f.t('modal.fields.cardAiAgent')} filled={!!f.aiAgentId}>
              <AiAgentCard agentId={f.aiAgentId} onAgentChange={f.setAiAgentId} />
            </CollapsedCard>
          )}
          <CollapsedCard title={f.t('modal.fields.cardPublication')}
            filled={f.published || f.channels.some(c => c.published) || f.applicationSettingsTouched}>
            <PublicationCard published={f.published} onPublishedChange={f.setPublished}
              channels={f.channels} onToggleChannel={f.toggleChannel}
              applicationSettings={f.applicationSettings} onSettingChange={f.setApplicationSetting} />
          </CollapsedCard>
          {/* Punten 21+22: both POST .../documents and .../notes need vacancies.update
              next to vacancies.create (measured) — hidden entirely without it. */}
          {f.showAttachmentCards && (
            <CollapsedCard title={f.t('modal.attachments.cardTitle')} filled={attachments.hasPending}>
              <AttachmentsCard files={attachments.files} onAddFile={attachments.addFile} onRemoveFile={attachments.removeFile}
                noteText={attachments.noteText} onNoteChange={attachments.setNoteText} />
            </CollapsedCard>
          )}
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {f.createError && (
          <div role="alert" style={{ margin: '0 22px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {f.createError}
          </div>
        )}

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {f.t('modal.cancel')}
          </button>
          <button onClick={f.handleSubmit} disabled={!f.canSubmit || f.saving}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: (f.canSubmit && !f.saving) ? 'var(--color-primary)' : 'var(--border)',
              color: (f.canSubmit && !f.saving) ? 'var(--color-on-accent)' : 'var(--text-muted)',
              cursor: (f.canSubmit && !f.saving) ? 'pointer' : 'not-allowed' }}>
            {f.saving ? f.t('modal.creating') : f.t('modal.create')}
          </button>
        </div>
    </FloatingPanel>
  )
}
