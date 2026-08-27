/**
 * OverviewTab — M9 of the overzicht-layout cluster: the ONE tab that carries
 * ALL match information, so the Relaties tab can go (its candidate/vacancy/
 * client hyperlinks are folded in below, unchanged in behaviour — EntityLink
 * degrades to plain text when an id is absent). MOVED-FROM-OVERVIEW-1
 * (Danny 22-08, "AKKOORD"): the MATCH-ORDINAL-1 (M14/M15) ordinal footnote
 * that used to sit under those relations MOVED to its own Statistieken tab
 * (StatisticsTab), which also shows WHO/WHAT the other matches on each axis
 * are — a bare "2 van 2" told nobody which other match that was.
 * Stays read-only for the DERIVED facts (candidate/vacancy/client/owner/score/
 * stage/created — a match is the continuation of a Hired application, §3B,
 * and owner is already editable via the header's own picker, MATCH-OWNER-1 —
 * making it editable here too would put one field in two places again).
 * Added on top of the facts card: the contract window's duration + progress
 * (M25/M26, MatchDurationBar — renders only once both dates are set), the
 * Koios AI advice block (M18, a pure FE heuristic — buildMatchAdviceInsights,
 * no AI/API call, mirrors every other entity's KoiosAdviceBlock usage),
 * Matchtekst (M17/optie A, MatchTextBlock — customer-facing rich text,
 * OFFERED-IFF-READ: hidden until the fetched payload actually carries the
 * not-yet-existing `match_text` key, ticket MATCH-TEXT-FIELD-1) and — until
 * it is emptied — the RETIRED Opmerkingen field (REMARKS-INTO-NOTES-1,
 * MatchRemarksBlock: read-only legacy content with a move-into-notes action;
 * see that file's header for the decision).
 *
 * OVERZICHT-DATA-1 (overzicht-data cluster follow-up wave): adds branch/
 * vestiging (M19, the DRILLDOWN-VOLGORDE-CANON's own last block, unchanged).
 *
 * MATCH-EDIT-1 (Danny 22-08, "waar is het potlootje bij een match? ik kan
 * niets wijzigen???", i.e. "where is the little pencil on a match? I can't
 * change anything???"): contract_type/start_date/end_date/hours_per_week
 * (M1/M2/M3) and cost_center/billing_emails (M28) are now EDITABLE here, in
 * one EditableFieldTable card (Contract/Financieel groups, mirroring the
 * Contract tab's own group titles since these are exactly the fields that
 * used to live there) — and they LEAVE MatchContractSection, so no field
 * renders in two places (§3A). Persisted via the SAME useMatchContract
 * instance/PATCH /matches/{id} the Contract tab uses (measured: the only path
 * that reaches the match's contract layer) — never a second save route. A
 * successful save also patches the parent row's contractType/startDate/
 * endDate (via onUpdate) so the list row never goes stale — MatchDurationBar
 * below is DETAIL-FIRST though: it reads `contract.start_date ?? match.startDate`
 * (same for end_date), so a fresher contract fetch always wins over the possibly
 * stale match.* prop, not the other way round. The other Overview fields
 * (candidate/vacancy/client/owner/score/stage/created) stay read-only: some
 * have no server path in MatchRules at all (candidate/vacancy — a match's
 * relations aren't reassignable via PATCH), owner already has its OWN editable
 * path in the header, and client (customer_id) DOES have a server path but
 * reassigning a placement's customer is a materially bigger, guarded operation
 * (guardCustomerApplicability) that nobody asked for here — flagged for Danny
 * rather than built silently (§3A cell-doorklik-canon: inventory, don't decide).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Unplug } from 'lucide-react'
import Button from '@/components/ui/Button'
import SectionCard from '@/components/ui/SectionCard'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import SharedBranchSection from '@/components/drawer/BranchSection'
import { useDateFormat } from '@/lib/datetime'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useMatchAdvice } from '@/lib/useMatchAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { useContractTypes } from '@/lib/useContractTypes'
import { notifySuccess, notifyError } from '@/lib/notify'
import ScorePill from '../ScorePill'
import { useMatchStopReasons } from '../hooks/useMatchStopReasons'
import { useMatchContract } from '../hooks/useMatchContract'
import type { MatchContract } from '../hooks/useMatchContract'
import { parseEmails, numOrNull } from './matchContractFieldUtils'
import { buildMatchAdviceInsights } from './matchAiInsights'
import MatchDurationBar from './MatchDurationBar'
import MatchTextBlock from './MatchTextBlock'
import MatchRemarksBlock from './MatchRemarksBlock'
import type { MatchRow } from '@/types/match'

// One read-only field row: label LEFT (canon width), value right — the
// DRILLDOWN-VOLGORDE-CANON (Danny 21-08 "tekst links waarde rechts") applied:
// the same EditableFieldTable/FieldRow look every candidate card uses.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

// Render a plain text value, or an em dash when empty (never blank per §3 states).
function textOrDash(value: string): ReactNode {
  return value && value !== '—' ? value : <span style={{ color: 'var(--text-muted)' }}>—</span>
}

const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

interface OverviewTabProps {
  match: MatchRow
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // REMARKS-INTO-NOTES-1: switches the drawer to the Notes tab after a legacy
  // remark was moved into a note, so the recruiter sees where it landed.
  onOpenNotes?: () => void
}

// See the file's top doc above; the one overview tab carrying all match facts, read-only except where noted.
export default function OverviewTab({ match, onUpdate, onOpenNotes }: OverviewTabProps) {
  const { t } = useTranslation(['matches', 'candidates'])
  const { formatDate } = useDateFormat()
  // KOIOS-ADVIES-OVERAL-1: the SAME resolver the matches table's Koios column
  // uses — the advisory block below prepends its advice so the two never disagree.
  const resolveAdvice = useMatchAdvice()
  // MATCH-EDIT-1: contract_type is a tenant lookup (mirrors the Contract tab's
  // own dropdown) — never a hardcoded option list.
  const { types: contractTypes } = useContractTypes()
  // MATCH-DRILL-2: the tenant's termination-reason lookup, to resolve the raw
  // stop_reason slug to its label — falls back to the label the read-back
  // itself already carries, then the raw slug, so a stale/deleted lookup entry
  // never blanks the line (§3B "nothing hardcoded", but never a dead end either).
  const { reasons: stopReasons } = useMatchStopReasons()
  // M3/M28/M12 + MATCH-EDIT-1: the contract/financial layer is DETAIL-only (§8 —
  // never on the list row), so this tab fetches (and now edits) it itself, same
  // as every other lazy per-tab fetch in this drawer (§0.19 abort/alive-guard
  // lives inside the hook). ONE instance for the whole tab: MatchRemarksBlock
  // (M29), MatchTextBlock (M17) and the Contract/Financieel card below all
  // reuse this same data/save pair instead of opening a second GET
  // /matches/{id} — a second hook instance here would be a genuine duplicate
  // fetch, not the "one per tab" pattern the comment above describes.
  const { data: contract, loading: contractLoading, error: contractError, unavailable: contractUnavailable,
    retry: retryContract, revertTick, save: saveContract, matchTextPresent,
    termination } = useMatchContract(match.id, onUpdate)

  // MATCH-EDIT-1: the six fields that used to live on the Contract tab — now
  // editable here, grouped under that tab's OWN "Contract"/"Financieel" titles
  // (one source per label §11 — these are exactly the fields that moved)
  // contract_type is optional → the real VAC-CLEAR-1 clear-cross via the table's
  // `clearable` passthrough (Opus round 22-08: the earlier injected "none" option
  // leaked its label into read mode where every sibling empty renders a dash).
  const contractFields: FieldRow[] = [
    { key: 'contract_type', label: t('drawer.contract.contractType'), type: 'select', clearable: true,
      options: contractTypes.map(c => ({ value: c, label: c })),
      group: t('drawer.contract.groupContract') },
    { key: 'start_date', label: t('drawer.contract.startDate'), type: 'date', group: t('drawer.contract.groupContract') },
    { key: 'end_date', label: t('drawer.contract.endDate'), type: 'date', group: t('drawer.contract.groupContract') },
    { key: 'hours_per_week', label: t('drawer.contract.hoursPerWeek'), inputType: 'number', group: t('drawer.contract.groupContract') },
    { key: 'cost_center', label: t('drawer.contract.costCenter'), group: t('drawer.contract.groupFinancial') },
    // billing_emails is a multi-line LIST (one address per line) — the shared
    // textarea row deliberately renders label-above/full-width (same as it did on
    // the Contract tab); the label-left canon governs single-value field rows.
    { key: 'billing_emails_text', label: t('drawer.contract.billingEmails'), type: 'textarea', group: t('drawer.contract.groupFinancial') },
  ]
  const contractValues: Record<string, unknown> = {
    contract_type: contract.contract_type ?? '',
    start_date: contract.start_date ?? '',
    end_date: contract.end_date ?? '',
    hours_per_week: contract.hours_per_week ?? '',
    cost_center: contract.cost_center ?? '',
    billing_emails_text: contract.billing_emails.join('\n'),
  }
  // Map the UI draft back to the PATCH body and persist through the SAME
  // useMatchContract instance the Contract tab uses (measured: the only path
  // that reaches PATCH /matches/{id} for this layer) — never a second save route.
  const handleSaveContract = async (v: Record<string, unknown>) => {
    const patch: Partial<MatchContract> = {
      contract_type:  (v.contract_type as string) || null,
      start_date:     (v.start_date as string) || null,
      end_date:       (v.end_date as string) || null,
      hours_per_week: numOrNull(v.hours_per_week),
      cost_center:    (v.cost_center as string) || null,
      billing_emails: parseEmails(String(v.billing_emails_text ?? '')),
    }
    try {
      await saveContract(patch)
      // Keep the list row in sync; MatchDurationBar below reads the contract
      // fetch DETAIL-FIRST (with match.* as fallback), so both stay fresh.
      onUpdate?.(match.id, {
        contractType: patch.contract_type ?? null,
        startDate: patch.start_date ?? null,
        endDate: patch.end_date ?? null,
      })
      notifySuccess(t('drawer.contract.saved'))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifyError(msg || t('drawer.contract.saveError'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Danny 27-07 ("achtergrond kleur???"): this card was hand-rolled with
          background --bg (the grey page tint) and its own bold title, so the match
          drawer was the only one with a tinted panel. It now uses the shared
          SectionCard — same border/radius, --surface background, grey uppercase
          title outside the block — exactly like every other drawer. */}
      <SectionCard title={t('drawer.sectionDetails')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Field label={t('drawer.fields.candidate')}>
            {match.candidate && match.candidate !== '—'
              ? <EntityLink page="candidates" id={match.candidateId} title={t('drawer.openCandidate')}>{match.candidate}</EntityLink>
              : dash}
          </Field>
          <Field label={t('drawer.fields.vacancy')}>
            {match.vacancy && match.vacancy !== '—'
              ? <EntityLink page="vacancies" id={match.vacancyId} title={t('drawer.openVacancy')}>{match.vacancy}</EntityLink>
              : dash}
          </Field>
          <Field label={t('drawer.fields.client')}>
            {match.client && match.client !== '—'
              ? <EntityLink page="customers" id={match.clientId} title={t('drawer.openClient')}>{match.client}</EntityLink>
              : dash}
          </Field>
          <Field label={t('drawer.fields.owner')}>{textOrDash(match.owner)}</Field>
          <Field label={t('drawer.fields.score')}><ScorePill value={match.score} /></Field>
          {/* MATCHES 18 + punt 2 (21-08): the fase derives from the application
              this match grew out of — a DIRECT match has none, and a dash row
              that can never be filled is dead weight, so the row only renders
              when a stage actually exists. */}
          {match.stage && (
            <Field label={t('drawer.fields.stage')}>
              <StatusPill label={match.stage} color={match.stageColor} />
            </Field>
          )}
          <Field label={t('drawer.fields.created')}>{formatDate(match.date)}</Field>
          {/* MATCH-DRILL-2: a calm reason line after termination — the label
              resolves through the tenant's stop-reason lookup, falling back to
              the read-back's own label, then the raw slug (never a blank
              value once a match actually carries a stop_reason). Rendered
              only when the match was actually terminated — never a dash row
              that can never be filled. */}
          {(() => {
            // Detail payload first (the LIST row never carries the termination
            // block, MatchListResource emits only the flat label); the mapped
            // row values remain the in-session fallback right after terminating.
            const stopReason = termination?.stopReason ?? match.stopReason
            const stopLabel = termination?.stopReasonLabel ?? match.stopReasonLabel
            const when = termination?.terminatedAt ?? termination?.effectiveDate
              ?? match.terminatedAt ?? match.terminationEffectiveDate ?? null
            if (!stopReason && !stopLabel) return null
            const reason = stopReasons.find(r => r.value === stopReason)?.label ?? stopLabel ?? stopReason
            return (
              <Field label={t('drawer.fields.terminated')}>
                {when
                  ? t('drawer.terminate.reasonLine', { date: formatDate(when), reason })
                  : t('drawer.terminate.reasonLineNoDate', { reason })}
              </Field>
            )
          })()}
          {/* MATCH-DRILL-2: renewal count — canon: a counter never renders "0",
              so this row only mounts once the match has actually been renewed. */}
          {(() => {
            // Same detail-first resolution as the reason line above.
            const renewals = termination?.renewalCount ?? match.renewalCount ?? 0
            return renewals > 0 && (
              <Field label={t('drawer.fields.renewals')}>
                {t('drawer.renew.renewalCount', { count: renewals, ordinal: true })}
              </Field>
            )
          })()}
        </div>
      </SectionCard>

      {/* M25/M26: contract window duration + progress — only once both dates are set.
          WALKTHROUGH-2108: prefer the DETAIL fetch's dates once loaded (mirrors the
          termination detail-first pattern above) — the list row's match.* can be stale
          right after a date edit lands server-side, before the list itself re-fetches. */}
      <MatchDurationBar
        startDate={contract.start_date ?? match.startDate}
        endDate={contract.end_date ?? match.endDate} />

      {/* MATCH-EDIT-1: contract_type/start_date/end_date/hours_per_week (Contract)
          and cost_center/billing_emails (Financieel) — now EDITABLE here, one
          pencil governs both groups (mirrors MatchContractSection's own
          titleless-grouped pencil). FOUR states before any edit control (§3,
          Opus round 22-08): an editable card seeded from a FAILED fetch renders
          blank and one save then null-wipes all six stored fields — so the
          unavailable/error gates mirror the Contract tab's own, and the pencil
          only exists once real data is on screen. Archived matches are
          read-only here, same as every other edit surface in this drawer. */}
      {contractLoading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>{t('drawer.contract.loading')}</div>
      ) : contractUnavailable ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>
          <Unplug size={14} />
          <span>{t('drawer.contract.unavailable')}</span>
        </div>
      ) : contractError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)', padding: '10px 2px' }}>
          <span>{t('drawer.contract.error')}</span>
          <Button variant="secondary" size="sm" onClick={retryContract}>{t('common:error.retry')}</Button>
        </div>
      ) : (
        <EditableFieldTable key={`${match.id}-${revertTick}`} fields={contractFields} value={contractValues}
          onSave={match.archived ? undefined : handleSaveContract} />
      )}

      {/* DRILLDOWN-VOLGORDE-CANON (Danny 21-08): information → TEXT with pop-out
          → Koios AI → branch. So the match text sits before the Koios block. */}
      {/* M17/optie A: Matchtekst — OFFERED-IFF-READ, hidden until the backend
          payload actually carries the `description` key (see file header). Koios
          assist + dictation ride the editor's own toolbar (RichTextAssistBar),
          so no per-block AI wiring is needed here anymore. */}
      <MatchTextBlock matchId={match.id} value={contract.description} present={matchTextPresent} loading={contractLoading} save={saveContract} />

      {/* M18: Koios AI advice — the table-identical advice row first (KOIOS-ADVIES-
          OVERAL-1; [] when there is none), then the score/contract-window heuristics. */}
      <KoiosAdviceBlock namespace="matches"
        insights={[...adviceInsightRows(resolveAdvice(match)), ...buildMatchAdviceInsights(match, t)]} />

      {/* REMARKS-INTO-NOTES-1: the retired Opmerkingen field. Mounted only while it
          still holds content (read-only + move-into-notes), so Matchtekst above is
          the one free-text surface — and so the block's note-type lookup is never
          fetched for the overwhelming majority of matches that have no remark left.
          Shares the contract fetch/save above — no second GET. */}
      {contract.remarks ? (
        <MatchRemarksBlock remarks={contract.remarks} loading={contractLoading} save={saveContract}
          matchId={match.id} onOpenNotes={onOpenNotes} />
      ) : null}

      {/* DRILLDOWN-VOLGORDE-CANON: vestiging LAST — the shared branch block in
          display-only mode (M19 label reuse from the candidates namespace). */}
      <SharedBranchSection readOnly label={t('candidates:matchesView.branch')}
        emptyLabel={t('candidates:sections.branchEmpty')}
        branches={match.branchName ? [{ name: match.branchName }] : []} />
    </div>
  )
}
