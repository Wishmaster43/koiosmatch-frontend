/**
 * OverviewTab — M9 of the overzicht-layout cluster: the ONE tab that carries
 * ALL match information, so the Relaties tab can go (its candidate/vacancy/
 * client hyperlinks are folded in below, unchanged in behaviour — EntityLink
 * degrades to plain text when an id is absent), plus the MATCH-ORDINAL-1
 * (M14/M15) ordinal footnote that used to sit under those same relations.
 * Stays read-only for the
 * derived facts (a match is the continuation of a Hired application, §3B);
 * the editable contract/financial layer remains its own tab
 * (MatchContractSection). Added on top of the facts card: the contract
 * window's duration + progress (M25/M26, MatchDurationBar — renders only once
 * both dates are set), the Koios AI advice block (M18, a pure FE heuristic —
 * buildMatchAdviceInsights, no AI/API call, mirrors every other entity's
 * KoiosAdviceBlock usage), Matchtekst (M17/optie A, MatchTextBlock — customer-
 * facing rich text, OFFERED-IFF-READ: hidden until the fetched payload
 * actually carries the not-yet-existing `match_text` key, ticket
 * MATCH-TEXT-FIELD-1) and — until it is emptied — the RETIRED Opmerkingen
 * field (REMARKS-INTO-NOTES-1, MatchRemarksBlock: read-only legacy content with
 * a move-into-notes action; see that file's header for the decision).
 *
 * OVERZICHT-DATA-1 (overzicht-data cluster follow-up wave): adds the facts
 * that already ride on the LIST row (mapMatch) but never surfaced here —
 * contract form (M1), the literal begin/end dates (M2, next to the M25/26
 * duration bar which only shows elapsed/remaining, never the dates
 * themselves) and branch/vestiging (M19). A second card covers what is
 * DETAIL-only (§8 data minimization, never on the list row): hours/week +
 * cost centre + billing e-mail (M3/M28) and the HelloFlex last-sync
 * timestamp (M12) — fetched here via useMatchContract, the same lazy
 * per-tab fetch every other tab already does on its own (NotesTab/
 * ChangelogTab/BackofficeLinksTab). Overview is the default active tab, so
 * this fires once on open, and again only if the user also opens the
 * Contract tab — an accepted duplicate fetch; no shared-fetch plumbing
 * between tabs exists yet.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import SharedBranchSection from '@/components/drawer/BranchSection'
import { Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useMatchAdvice } from '@/lib/useMatchAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import ScorePill from '../ScorePill'
import SelectMenu from '@/components/ui/SelectMenu'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useMatchContract } from '../hooks/useMatchContract'
import { buildMatchAdviceInsights } from './matchAiInsights'
import MatchDurationBar from './MatchDurationBar'
import MatchTextBlock from './MatchTextBlock'
import MatchRemarksBlock from './MatchRemarksBlock'
import type { MatchRow } from '@/types/match'
import type { MatchOrdinals } from '../matchOrdinals'

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
  onSetStatus?: (status: string) => void
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // MATCH-ORDINAL-1 (M14/M15): this match's position among the tenant's other
  // matches per axis — omitting it just hides the ordinal footnote.
  ordinals?: MatchOrdinals
  // REMARKS-INTO-NOTES-1: switches the drawer to the Notes tab after a legacy
  // remark was moved into a note, so the recruiter sees where it landed.
  onOpenNotes?: () => void
}

export default function OverviewTab({ match, onSetStatus, onUpdate, ordinals, onOpenNotes }: OverviewTabProps) {
  const { t } = useTranslation(['matches', 'candidates'])
  const { formatDate } = useDateFormat()
  // KOIOS-ADVIES-OVERAL-1: the SAME resolver the matches table's Koios column
  // uses — the advisory block below prepends its advice so the two never disagree.
  const resolveAdvice = useMatchAdvice()
  // Lifecycle status from the tenant lookup — the is_closed FLAG ends the match (R-1b).
  const { statuses, metaOf } = useMatchStatuses()
  const statusMeta = metaOf(match.status)
  // M3/M28/M12: hours/week + cost centre + billing e-mail are DETAIL-only fields
  // (§8 — never on the list row), so this tab fetches them itself, same as every
  // other lazy per-tab fetch in this drawer (§0.19 abort/alive-guard lives inside the hook).
  // ONE instance for the whole tab: MatchRemarksBlock (M29) and MatchTextBlock
  // (M17) both reuse this same data/save pair (for `remarks` and `match_text`)
  // instead of opening a second GET /matches/{id} — all three now live on
  // Overview together, so a second hook instance here would be a genuine
  // duplicate fetch, not the "one per tab" pattern the comment above describes.
  const { data: contract, loading: contractLoading, save: saveContract, matchTextPresent } = useMatchContract(match.id, onUpdate)

  // Ordinal footnote lines — one per axis, only when that axis actually has data
  // (folded in from the old RelationsTab, unchanged — M9).
  const ordinalLines = ordinals ? [
    ordinals.candidate  && t('drawer.ordinal.candidate', { position: ordinals.candidate.position, total: ordinals.candidate.total }),
    ordinals.client     && t('drawer.ordinal.client', { position: ordinals.client.position, total: ordinals.client.total }),
    ordinals.location   && t('drawer.ordinal.location', { position: ordinals.location.position, total: ordinals.location.total }),
    ordinals.department && t('drawer.ordinal.department', { position: ordinals.department.position, total: ordinals.department.total }),
  ].filter(Boolean) as string[] : []

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
          <Field label={t('drawer.fields.stage')}>
            {match.stage
              ? <StatusPill label={match.stage} color={match.stageColor} />
              : dash}
          </Field>
          {/* Lifecycle status — editable from the tenant lookup; closing statuses end the match. */}
          <Field label={t('drawer.fields.status')}>
            {onSetStatus ? (
              <SelectMenu value={match.status || null} onChange={onSetStatus}
                placeholder={t('drawer.fields.status')}
                options={statuses.map(o => ({ value: o.value, label: o.label }))} />
            ) : statusMeta ? (
              <StatusPill label={statusMeta.label} color={statusMeta.color} />
            ) : dash}
          </Field>
          <Field label={t('drawer.fields.created')}>{formatDate(match.date)}</Field>
          {/* M1: contract form — MatchListResource already ships `contract_type` on
              every list row; the mapper just never picked it up before this wave. */}
          <Field label={t('drawer.contract.contractType')}>{textOrDash(match.contractType ?? '')}</Field>
          {/* M2: the literal begin/end dates — the duration bar below only shows
              elapsed/remaining, never the dates themselves. */}
          <Field label={t('drawer.contract.startDate')}>{match.startDate ? formatDate(match.startDate) : dash}</Field>
          <Field label={t('drawer.contract.endDate')}>{match.endDate ? formatDate(match.endDate) : dash}</Field>
        </div>
        {/* MATCH-ORDINAL-1 (M14/M15): this match's position among the tenant's
            other matches sharing the same candidate/client/location/department —
            an axis with no id on this match stays null, never a fake "1/1". */}
        {ordinalLines.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ordinalLines.map((line, i) => (
              <Caption as="div" key={i}>{line}</Caption>
            ))}
          </div>
        )}
      </SectionCard>

      {/* M25/M26: contract window duration + progress — only once both dates are set. */}
      <MatchDurationBar startDate={match.startDate} endDate={match.endDate} />

      {/* M3/M28/M12: DETAIL-only facts (§8) — hours/week, cost centre, billing
          e-mail (reuse the Contract tab's own labels, one source per label §11)
          and the HelloFlex last-sync timestamp. Loading is a quiet skeleton state,
          never a blank card — an unconfigured integration/never-synced match just
          reads as an honest dash, not an error. */}
      <SectionCard title={t('drawer.detailSection')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Field label={t('drawer.contract.hoursPerWeek')}>
            {contractLoading ? dash : (contract.hours_per_week != null ? contract.hours_per_week : dash)}
          </Field>
          <Field label={t('drawer.contract.costCenter')}>
            {contractLoading ? dash : textOrDash(contract.cost_center ?? '')}
          </Field>
          <Field label={t('drawer.contract.billingEmails')}>
            {contractLoading ? dash : (contract.billing_emails.length > 0 ? contract.billing_emails.join(', ') : dash)}
          </Field>
        </div>
      </SectionCard>

      {/* DRILLDOWN-VOLGORDE-CANON (Danny 21-08): informatie → TEKST met pop-out
          → Koios AI → vestiging. De matchtekst staat dus vóór het Koios-blok. */}
      {/* M17/optie A: Matchtekst — OFFERED-IFF-READ, hidden until the backend
          payload actually carries the `match_text` key (see file header). Koios
          assist + dictation ride the editor's own toolbar (RichTextAssistBar),
          so no per-block AI wiring is needed here anymore. */}
      <MatchTextBlock matchId={match.id} value={contract.match_text} present={matchTextPresent} loading={contractLoading} save={saveContract} />

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
