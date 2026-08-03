/**
 * AddVacancyModal — create a vacancy. SLICE 1 of Danny's 22-point spec: split
 * into `addmodal/` (mirrors pages/candidates/addmodal/) — one component per
 * card, all state/lookups/cascade/submit logic in useAddVacancyForm. This file
 * is now a thin assembler (shell + card wiring only); 20+ fields across seven
 * cards would have blown a single-file component well past the ~400-line
 * split trigger (§3). The landed prefill props (lockCustomerId/lockCustomerName,
 * initialCustomerLocationId/DepartmentId/Names) keep working exactly as before
 * — only `initialIndustry` is new (punt 4).
 */
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { BTN_H } from '@/config/buttonMetrics'
import { useAddVacancyForm } from './addmodal/useAddVacancyForm'
import ModalHeader from './addmodal/ModalHeader'
import GeneralCard from './addmodal/GeneralCard'
import ClientCascadeCard from './addmodal/ClientCascadeCard'
import PlacementCard from './addmodal/PlacementCard'
import RequirementsCard from './addmodal/RequirementsCard'
import ConditionsCard from './addmodal/ConditionsCard'
import DescriptionCard from './addmodal/DescriptionCard'
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
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const f = useAddVacancyForm({
    onClose, onCreated, users, customers, lockCustomerId,
    initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
    initialIndustry,
  })

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={f.t('modal.title')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', ...WIDE_MODAL,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <ModalHeader status={f.form.status} statusOptions={f.statusOptions}
          onSelectStatus={v => f.set('status', v)} onClose={onClose} />

        {/* Form — titled bordered cards, stacked full-width (mirrors AddCandidateModal/
            AddCustomerModal): Algemeen / Klant / Inzet / Functie-eisen / Voorwaarden /
            Beschrijving / Recruiter. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            expanded={f.descExpanded} setExpanded={f.setDescExpanded} editing={f.descEditing} setEditing={f.setDescEditing} />
          <RecruiterCard ownerId={f.form.ownerId} onOwnerChange={v => f.set('ownerId', v)} userOptions={f.userOptions} />
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
              color: (f.canSubmit && !f.saving) ? 'white' : 'var(--text-muted)',
              cursor: (f.canSubmit && !f.saving) ? 'pointer' : 'not-allowed' }}>
            {f.saving ? f.t('modal.creating') : f.t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
