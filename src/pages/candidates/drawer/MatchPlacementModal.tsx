/**
 * MatchPlacementModal — the full "+ Match" form on the candidate Match tab
 * (MATCH-PLACEMENT-1, fase 1). A placement IS the Match (one record), so this
 * POSTs to /matches with the contract/financial layer. The customer→location→
 * department→contact cascade, function + contract-type dropdowns, dates/hours and
 * the purchase/sell/margin block all work now; /matches tolerates the extra fields
 * (ignored until the backend model lands, then persisted). Rates propose from a
 * price agreement / conversion factor once customer + function are picked
 * (MATCH-PLACEMENT-2, useRateProposal) — the margin is shown live. The
 * long-list relational pickers (klant/locatie/afdeling/contactpersoon/functie/
 * vacature) are typeable searchable comboboxes via the shared CreatableSelect
 * with `allowCreate={false}` — never a hardcoded free-text create for a
 * relational id (job 18). Cost centre + billing email propose from whichever
 * picked level (afdeling > locatie > klant) carries a value, and freeze the
 * moment the recruiter edits them by hand (job 21/22).
 *
 * Widened again to a 900px panel (Danny kandidaten-ronde-2, punt C.2.1 — "lang en
 * smal, kan dit niet breder?"): Relaties stays full-width (its pickers are the
 * ones that needed to breathe), Contract + Financieel now sit side by side below
 * it so the form reads less like a tall scrolling strip.
 *
 * This is a thin container (audit R1 item 1, MUST-SPLIT — used to be 532 lines
 * with 4 inline api-calls): all state/effects/submit/422-mapping now live in
 * `matchPlacement/useMatchPlacementForm`, and the JSX splits into
 * `matchPlacement/{RelationsSection,ContractSection,FinancialSection}`. This file
 * only wires the hook to the shared drawer chrome (overlay/panel/focus-trap) and
 * composes the sections + footer.
 */
import { X } from 'lucide-react'
import { RateDeviationWarning } from './RateProposalNotice'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { ActionRuleBanner } from '@/components/actionrules'
import { useMatchPlacementForm } from './matchPlacement/useMatchPlacementForm'
import RelationsSection from './matchPlacement/RelationsSection'
import ContractSection from './matchPlacement/ContractSection'
import FinancialSection from './matchPlacement/FinancialSection'
import { overlay, panel, sectionTitle, twoColSections } from './matchPlacement/styles'
import type { Id } from '@/types/common'

export default function MatchPlacementModal({ candidateId: fixedCandidateId, onClose, onCreated }: {
  // Fixed when opened from a candidate's Match tab; absent on the Matches page —
  // then a candidate picker appears at the top of RELATIES (Danny 2026-07-13).
  candidateId?: Id
  onClose: () => void
  onCreated: () => void
}) {
  // All state, effects, submit + 422-mapping live in the hook — this component
  // only wires it to the shared chrome and the three section components below.
  const form = useMatchPlacementForm({ candidateId: fixedCandidateId, onClose, onCreated })
  const { t } = form
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('placement.title')} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('placement.title')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter fills in the rest. */}
        {form.matchRuleDecision && form.matchRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 10 }}><ActionRuleBanner decision={form.matchRuleDecision} /></div>
        )}

        {/* ── Relaties ── */}
        <div style={sectionTitle}>{t('placement.relations')}</div>
        <RelationsSection
          t={t} errors={form.errors}
          fixedCandidateId={form.fixedCandidateId} pickedCandidateId={form.pickedCandidateId} setPickedCandidateId={form.setPickedCandidateId}
          candidateOptions={form.candidateOptions}
          customerId={form.customerId} setCustomerId={form.setCustomerId} customerOptions={form.customerOptions}
          locationId={form.locationId} setLocationId={form.setLocationId} locations={form.locations}
          departmentId={form.departmentId} setDepartmentId={form.setDepartmentId} departments={form.departments}
          contactId={form.contactId} setContactId={form.setContactId} contacts={form.contacts}
          creatingContact={form.creatingContact} setCreatingContact={form.setCreatingContact} nc={form.nc} setNc={form.setNc} saveContact={form.saveContact}
          func={form.func} setFunc={form.setFunc} functions={form.functions}
          ownerId={form.ownerId} setOwnerId={form.setOwnerId} users={form.users}
          vacancyId={form.vacancyId} setVacancyId={form.setVacancyId} vacancyOptions={form.vacancyOptions}
          branchMismatch={form.branchMismatch} candBranch={form.candBranch} detail={form.detail}
          mismatchChoice={form.mismatchChoice} setMismatchChoice={form.setMismatchChoice}
        />

        {/* ── Contract + Financieel side by side (punt C.2.1) — Relaties above keeps
            the full panel width for its searchable pickers; these two shorter,
            plain-input-heavy sections pair up fine in half the width each. ── */}
        <div style={twoColSections}>
          <div>
            <div style={sectionTitle}>{t('placement.contract')}</div>
            <ContractSection
              t={t} errors={form.errors}
              contractType={form.contractType} setContractType={form.setContractType} contractTypes={form.contractTypes}
              cao={form.cao} setCao={form.setCao}
              startDate={form.startDate} setStartDate={form.setStartDate}
              endDate={form.endDate} setEndDate={form.setEndDate}
              hours={form.hours} setHours={form.setHours}
            />
          </div>
          <div>
            <div style={sectionTitle}>{t('placement.financial')}</div>
            <FinancialSection
              t={t} errors={form.errors}
              scale={form.scale} setScale={form.setScale} step={form.step} setStep={form.setStep}
              purchase={form.purchase} setPurchase={form.setPurchase} sell={form.sell} setSell={form.setSell}
              margin={form.margin} hasRates={form.hasRates} proposal={form.proposal}
              costCenter={form.costCenter} setCostCenter={form.setCostCenter} setCostCenterDirty={form.setCostCenterDirty}
              billingEmails={form.billingEmails} setBillingEmails={form.setBillingEmails} setBillingDirty={form.setBillingDirty}
              remarks={form.remarks} setRemarks={form.setRemarks} remarksExpanded={form.remarksExpanded} setRemarksExpanded={form.setRemarksExpanded}
            />
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {form.submitErr && (
          <div role="alert" style={{ marginTop: 12, padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {form.submitErr}
          </div>
        )}

        {/* Deviation guard (Danny's "weet je het zeker?"): the entered rates differ from a
            FOUND agreement proposal — calm inline confirm, one extra click, no hard block. */}
        {form.deviatesFromProposal && form.confirmDeviation && (
          <RateDeviationWarning proposal={form.proposal} purchase={form.purchase} sell={form.sell} onCancel={() => form.setConfirmDeviation(false)} />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={form.handleSubmitClick} disabled={form.saving || !form.customerId || !form.func}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: (form.customerId && form.func) ? 'pointer' : 'default', opacity: (form.customerId && form.func) ? 1 : 0.4 }}>
            {form.saving ? t('common:saving') : (form.deviatesFromProposal && form.confirmDeviation ? t('placement.rateProposal.deviationConfirm') : t('placement.create'))}
          </button>
        </div>
      </div>
    </>
  )
}
