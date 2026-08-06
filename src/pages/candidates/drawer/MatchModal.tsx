/**
 * MatchModal — the full "+ Match" form on the candidate Match tab
 * (MATCH-PLACEMENT-1, fase 1). A match IS the Match (one record), so this
 * POSTs to /matches with the contract/financial layer. The customer→location→
 * department→contact cascade, function + contract-type dropdowns, dates/hours and
 * the purchase/sell/margin block all work now, and /matches PERSISTS every one of
 * them (the match columns are real — StoreMatchRequest validates them via the
 * shared PlacementRules trait; this used to say they were "ignored until the backend
 * model lands"). Contract type + CAO are validated against their tenant lookups
 * server-side, so a value the dropdown never offered is a 422, not a phantom row.
 * Rates propose from a price agreement / conversion factor once customer + function are picked
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
 * `match/useMatchForm`, and the JSX splits into
 * `match/{RelationsSection,ContractSection,FinancialSection}`. This file
 * only wires the hook to the shared drawer chrome (overlay/panel/focus-trap) and
 * composes the sections + footer.
 *
 * Danny 24-07 points 3/6: the panel now shares its exact frame footprint with
 * AddCandidateModal (modalMetrics.ts, via match/styles' panel), and each
 * section renders as a titled CARD — the shared `@/components/ui/modalCards`
 * chrome (`cardHead`/`cardBox`, CLAUDE.md §11: one source instead of a per-entity
 * copy) — instead of a bare uppercase label over an unbordered block. Opmerkingen
 * is its OWN card, left column, stacked under Contract — Financieel (the tallest
 * section) sits alone on the right so the two columns balance visually (Danny
 * 24-07 layout point).
 *
 * VACANCY-PREFILL-1 (Danny's ten-point round): picking a vacancy prefills the
 * Relaties/Contract fields it knows (useVacancyPrefillApply), the recruiter/owner
 * defaults from the candidate's own owner (RECRUITER-DEFAULT-1), and a calm
 * duplicate/overlap banner (`MatchConflictBanners`, points 5/6) warns — never
 * blocks — on the candidate's own existing matches, right under the AXIS-MATRIX
 * preflight so it's visible before the recruiter fills in the rest.
 */
import { X } from 'lucide-react'
import { RateDeviationWarning } from './RateProposalNotice'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useDateFormat } from '@/lib/datetime'
import { ActionRuleBanner } from '@/components/actionrules'
import { useMatchForm } from './match/useMatchForm'
import RelationsSection from './match/RelationsSection'
import ContractSection from './match/ContractSection'
import FinancialSection from './match/FinancialSection'
import MatchConflictBanners from './match/MatchConflictBanners'
// COLLAPSIBLE-TEXT-1 (Danny 02-08): RemarksSection moved to a shared, entity-
// agnostic component (components/ui) so candidate/customer/location/department
// create modals get the same collapsed-ghost prose block — see its own docblock.
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { overlay, panel, twoColSections } from './match/styles'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import type { Id } from '@/types/common'

export default function MatchModal({
  candidateId: fixedCandidateId, editMatchId, onClose, onCreated,
  initialCustomerId, initialCustomerLocationId, initialCustomerDepartmentId,
  candidateOwnerId,
}: {
  // Fixed when opened from a candidate's Match tab; absent on the Matches page —
  // then a candidate picker appears at the top of RELATIES (Danny 2026-07-13).
  candidateId?: Id
  // Set (point 2, Danny live P1) when opened from a MatchesTab row's pencil —
  // prefills every field from the full record and PATCHes on submit instead of POST.
  editMatchId?: Id
  onClose: () => void
  onCreated: () => void
  // Point 1 (Danny's ten-point round): opened from a customer/location/department
  // drill-down's own "+ Match" — a PREFILL of the Relaties cascade, never a lock
  // (the recruiter can still change customer/location/department by hand).
  initialCustomerId?: Id
  initialCustomerLocationId?: Id
  initialCustomerDepartmentId?: Id
  // RECRUITER-DEFAULT-1 (point 3): the candidate's own owner, passed down from an
  // already-loaded drawer record (WorkTab's `c.ownerId`) — mirrors
  // AddApplicationModal/PlanIntakeModal's identical prop, never refetched.
  candidateOwnerId?: Id | null
}) {
  // All state, effects, submit + 422-mapping live in the hook — this component
  // only wires it to the shared chrome and the three section components below.
  const form = useMatchForm({
    candidateId: fixedCandidateId, editMatchId, onClose, onCreated,
    initialCustomerId, initialCustomerLocationId, initialCustomerDepartmentId,
    candidateOwnerId,
  })
  const { t, editing } = form
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const title = t(editing ? 'placement.editTitle' : 'placement.title')
  // DD-MM-YYYY everywhere (§3B) — used only for the overlap banner's period text.
  const { formatDate } = useDateFormat()

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter fills in the rest. */}
        {form.matchRuleDecision && form.matchRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 10 }}><ActionRuleBanner decision={form.matchRuleDecision} /></div>
        )}

        {/* Duplicate + overlap preflight (points 5/6, Danny's ten-point round) —
            calm, non-blocking heads-up over the candidate's OWN existing matches. */}
        <MatchConflictBanners duplicateMatch={form.duplicateMatch} overlappingMatches={form.overlappingMatches} formatDate={formatDate} />

        {/* ── Titled cards (Danny 24-07 point 3) — the addmodal card idiom: an
            11px uppercase muted heading above a bordered surface, mirroring the
            drill-down ProfileTab exactly so both "wide form" modals read as one
            system. Relaties stays full-width; Contract + Financieel pair up
            side by side below it (kept from punt C.2.1). ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
          <div>
            <div style={cardHead}>{t('placement.relations')}</div>
            <div style={cardBox}>
              <RelationsSection
                t={t} errors={form.errors} editing={editing}
                fixedCandidateId={form.fixedCandidateId} pickedCandidateId={form.pickedCandidateId} setPickedCandidateId={form.setPickedCandidateId}
                candidateOptions={form.candidateOptions}
                customerId={form.customerId} setCustomerId={form.setCustomerId} customerOptions={form.customerOptions}
                locationId={form.locationId} setLocationId={form.setLocationId} locations={form.locations}
                departmentId={form.departmentId} setDepartmentId={form.setDepartmentId} departments={form.departments}
                contactId={form.contactId} setContactId={form.setContactId} contacts={form.contacts}
                creatingContact={form.creatingContact} setCreatingContact={form.setCreatingContact} nc={form.nc} setNc={form.setNc} saveContact={form.saveContact}
                duplicateContact={form.duplicateContact} setDuplicateContact={form.setDuplicateContact}
                contactFunctions={form.contactFunctions} contactFunctionsAllowFreeEntry={form.contactFunctionsAllowFreeEntry}
                func={form.func} setFunc={form.setFunc} functions={form.functions}
                ownerId={form.ownerId} setOwnerId={form.setOwnerId} users={form.users}
                branchId={form.branchId} setBranchId={form.setBranchId} setBranchDirty={form.setBranchDirty} branchLocations={form.branchLocations}
                vacancyId={form.vacancyId} setVacancyId={form.setVacancyId} vacancyOptions={form.vacancyOptions}
                branchMismatch={form.branchMismatch} candBranch={form.candBranch} detail={form.detail}
                mismatchChoice={form.mismatchChoice} setMismatchChoice={form.setMismatchChoice}
              />
            </div>
          </div>

          <div style={twoColSections}>
            {/* Left column: Contract + Opmerkingen stacked — Opmerkingen collapsed
                by default keeps this column's height close to Financieel's. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={cardHead}>{t('placement.contract')}</div>
                <div style={cardBox}>
                  <ContractSection
                    t={t} errors={form.errors}
                    contractType={form.contractType} setContractType={form.setContractType} contractTypes={form.contractTypes}
                    cao={form.cao} setCao={form.setCao} caoOptions={form.caoOptions}
                    startDate={form.startDate} setStartDate={form.setStartDate}
                    endDate={form.endDate} setEndDate={form.setEndDate} setEndDateDirty={form.setEndDateDirty}
                    hours={form.hours} setHours={form.setHours}
                  />
                </div>
              </div>
              <div>
                <div style={cardHead}>{t('placement.remarks')}</div>
                <div style={cardBox}>
                  <CollapsibleRichText
                    t={t} value={form.remarks} onChange={form.setRemarks}
                    expanded={form.remarksExpanded} setExpanded={form.setRemarksExpanded}
                    editing={form.remarksEditing} setEditing={form.setRemarksEditing}
                    placeholder={t('placement.remarksAdd')}
                  />
                </div>
              </div>
            </div>
            <div>
              <div style={cardHead}>{t('placement.financial')}</div>
              <div style={cardBox}>
                <FinancialSection
                  t={t} errors={form.errors}
                  scale={form.scale} setScale={form.setScale} step={form.step} setStep={form.setStep}
                  purchase={form.purchase} setPurchase={form.setPurchase} sell={form.sell} setSell={form.setSell}
                  margin={form.margin} hasRates={form.hasRates} proposal={form.proposal}
                  costCenter={form.costCenter} setCostCenter={form.setCostCenter} setCostCenterDirty={form.setCostCenterDirty}
                  billingEmails={form.billingEmails} setBillingEmails={form.setBillingEmails} setBillingDirty={form.setBillingDirty}
                />
              </div>
            </div>
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
            {form.saving ? t('common:saving') : (form.deviatesFromProposal && form.confirmDeviation ? t('placement.rateProposal.deviationConfirm') : t(editing ? 'common:save' : 'placement.create'))}
          </button>
        </div>
      </div>
    </>
  )
}
