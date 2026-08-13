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
 * CARD-STACK-LABEL-LEFT (Danny 13-08, two live complaints — "alles onder elkaar
 * en niet naast elkaar" + "Match opmerkingen is heel klein"): rebuilt onto the
 * PlanIntakeModal/AddApplicationModal canon instead of the old wide two-column
 * frame. Every field is now its own label-LEFT row (P33, `match/styles` +
 * `FormField`) — the label sits at the shared CANON_LABEL_WIDTH, the field
 * takes the rest, so a row reads left-to-right instead of stacking label-above-
 * field. The panel opens WIDE by default (1060px — Danny 14-08 "scherm moet
 * breder, anders past de klantnaam niet eens"; the brief 640px default truncated
 * every picker label) and the four
 * sections stack as single-column titled cards — Relaties, Contract,
 * Financieel, Opmerkingen — mirroring PlanIntakeModal's own scrollBody={false}
 * + own scroll area (padding 22) + a pinned footer with borderTop, instead of
 * the previous inline-scrolling wide panel.
 *
 * This is a thin container (audit R1 item 1, MUST-SPLIT — used to be 532 lines
 * with 4 inline api-calls): all state/effects/submit/422-mapping now live in
 * `match/useMatchForm`, and the JSX splits into
 * `match/{RelationsSection,ContractSection,FinancialSection}`. This file
 * only wires the hook to the shared drawer chrome (overlay/panel/focus-trap) and
 * composes the sections + footer.
 *
 * Each section renders as a titled CARD — the shared `@/components/ui/modalCards`
 * chrome (`cardHead`/`cardBox`, CLAUDE.md §11: one source instead of a per-entity
 * copy) — instead of a bare uppercase label over an unbordered block.
 *
 * Opmerkingen is the GROWING element (RESIZE-GROWS-EDITOR, mirrors
 * NoteComposer.tsx's docblock): its card carries a taller default footprint
 * (minHeight 160) than the other cards so the rich-text block reads as the
 * form's own note, not an afterthought — the collapsed-ghost-start and the
 * pop-out icon are untouched (shared `CollapsibleRichText`, out of this file's
 * scope to restyle further).
 *
 * VACANCY-PREFILL-1 (Danny's ten-point round): picking a vacancy prefills the
 * Relaties/Contract fields it knows (useVacancyPrefillApply), the recruiter/owner
 * defaults from the candidate's own owner (RECRUITER-DEFAULT-1), and a calm
 * duplicate/overlap banner (`MatchConflictBanners`, points 5/6) warns — never
 * blocks — on the candidate's own existing matches, right under the AXIS-MATRIX
 * preflight so it's visible before the recruiter fills in the rest.
 */
import { RateDeviationWarning } from './RateProposalNotice'
import { useDateFormat } from '@/lib/datetime'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
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
import FloatingPanel from '@/components/ui/FloatingPanel'
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
  const title = t(editing ? 'placement.editTitle' : 'placement.title')
  // DD-MM-YYYY everywhere (§3B) — used only for the overlap banner's period text.
  const { formatDate } = useDateFormat()

  // MATCH-REMARKS-POPOUT (batch 5, P34): the SAME second-screen recipe
  // ProfileTab's profile text uses (useTextPopoutHost), keyed by the candidate
  // id — a match may not exist as a record yet, so there is nothing else to key
  // the sync channel on. Guarded to the fixed/picked candidate id; the icon
  // only renders once one is known (see ContractSection's sibling card below).
  const remarksCandidateId = form.fixedCandidateId ?? form.pickedCandidateId
  const remarksPopout = useTextPopoutHost({
    entity: 'candidate', id: remarksCandidateId ?? '', field: 'matchRemarks',
    value: form.remarks, dirty: form.remarks !== '',
    onDraft: html => { form.setRemarks(html); form.setRemarksEditing(true) },
    onSaved: html => { form.setRemarks(html) },
  })
  // Publish every local edit (typing, dictation, Koios assist) to the popped-
  // out window, mirroring ProfileTab's changeSummary.
  const changeRemarks = (html: string) => { form.setRemarks(html); remarksPopout.publishDraft(html) }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position. Narrowed to the ~640px single-column
    // card-stack footprint (Danny 13-08); scrollBody={false} + the modal's own
    // scroll area below mirrors PlanIntakeModal/AddApplicationModal exactly, so
    // the footer buttons stay pinned instead of scrolling with the form.
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="candidate-match" width={1060} maxWidth="92vw" scrollBody={false} bodyStyle={{ padding: 0 }}>

      {/* Fields scroll in their own area so the footer buttons stay pinned (mirrors PlanIntakeModal, Danny 13-08). */}
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: 22 }}>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter fills in the rest. */}
        {form.matchRuleDecision && form.matchRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 10 }}><ActionRuleBanner decision={form.matchRuleDecision} /></div>
        )}

        {/* Duplicate + overlap preflight (points 5/6, Danny's ten-point round) —
            calm, non-blocking heads-up over the candidate's OWN existing matches. */}
        {/* Hours-sum escalation (Danny 1.11): the drafted hours feed the overlap check —
            2×20 stays a mild note, together above 40 escalates the wording. */}
        <MatchConflictBanners duplicateMatch={form.duplicateMatch} overlappingMatches={form.overlappingMatches} formatDate={formatDate}
          draftHours={form.hours ? Number(form.hours) : null} />

        {/* ── Titled card stack (Danny 13-08, "alles onder elkaar en niet naast
            elkaar"): Relaties / Contract / Financieel / Opmerkingen, single
            column, each a bordered `cardBox` under an 11px uppercase `cardHead`
            — the addmodal card idiom, now stacked instead of paired columns.
            Every field inside a card is its own label-LEFT row (P33). ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
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

          <div>
            <div style={cardHead}>{t('placement.matchRemarks')}</div>
            {/* GROWING element (RESIZE-GROWS-EDITOR, mirrors NoteComposer.tsx):
                a taller default footprint than the other cards — "Match
                opmerkingen is heel klein" (Danny 13-08) — so the rich-text
                block reads as the form's own note. The collapsed-ghost-start
                and the pop-out icon are untouched (shared CollapsibleRichText). */}
            <div style={{ ...cardBox, minHeight: 160 }}>
              {/* ACTIONS-SCOPE-DEFAULT-FLIP: "Match opmerkingen" reads as a
                  conversation (like a note), not a description — keep all
                  three Koios modes, including Actiepunten, explicitly.
                  onPopout only wires when a candidate id is known — the
                  remarks sync channel is keyed on it (see the hook above). */}
              <CollapsibleRichText
                t={t} value={form.remarks} onChange={changeRemarks}
                expanded={form.remarksExpanded} setExpanded={form.setRemarksExpanded}
                editing={form.remarksEditing} setEditing={form.setRemarksEditing}
                placeholder={t('placement.remarksAdd')}
                assistModes={['improve', 'summarize', 'actions']}
                onPopout={remarksCandidateId ? remarksPopout.open : undefined}
                // RESIZE-GROWS-EDITOR (Danny 13-08 "heel klein"): the open editor is
                // the growing element of the panel, with a real writing floor.
                fill minHeight={160}
              />
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

      </div>

      {/* Pinned footer — buttons stay visible whatever the content height (mirrors PlanIntakeModal). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={form.handleSubmitClick} disabled={form.saving || !form.customerId || !form.func}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: (form.customerId && form.func) ? 'pointer' : 'default', opacity: (form.customerId && form.func) ? 1 : 0.4 }}>
            {form.saving ? t('common:saving') : (form.deviatesFromProposal && form.confirmDeviation ? t('placement.rateProposal.deviationConfirm') : t(editing ? 'common:save' : 'placement.create'))}
          </button>
        </div>
    </FloatingPanel>
  )
}
