import { useState } from 'react'
import { ExternalLink, Link2, Pencil, ChevronRight, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
import ContractFormChip from './ContractFormChip'
import type { MatchContractForm } from '@/types/match'
import { MATCH_COLUMN_WIDTH, MATCH_COL_STATUS, MATCH_COL_OTHER_PARTY, MATCH_COL_SCORE, MATCH_COL_ACTIONS } from './matchRowColumns'
import EntityLink, { buildEntityDeepLink } from '@/components/ui/EntityLink'
import BackofficeCouplingIndicator from '@/components/ui/BackofficeCouplingIndicator'
import ScorePill from './ScorePill'
import { computeMatchExpiry } from './matchExpiry'
import { useDateFormat } from '@/lib/datetime'
import { isSafeUrl } from '@/lib/safeUrl'
import type { BackofficeLink } from '@/lib/backofficeLink'
import type { Id } from '@/types/common'

export interface MatchCardProps {
  id?: Id | null
  vacancyId?: Id | null
  vacancyTitle: string
  // Read-only link-out to the vacancy's OWN source URL (candidate card only —
  // distinct from the in-app vacancy link/deep-link above).
  vacancyUrl?: string | null
  // Fired on any "leave this card" click (name, open-in-new, external link-out)
  // BEFORE navigation — the candidate card uses this to stash the return sub-tab.
  onBeforeOpen?: () => void
  stageLabel?: string | null
  stageColor?: string | null
  score?: number | null
  // Candidate card: a single GUID → a simple "linked" glyph, no per-system detail.
  helloflexGuid?: string | null
  // Customer/scoped card: the full per-system indicator, gated on the tenant's own
  // enabled apps (never rendered for a tenant that runs neither backoffice).
  helloflexLink?: BackofficeLink | null
  shiftmanagerLink?: BackofficeLink | null
  showHelloflex?: boolean
  showShiftmanager?: boolean
  // Candidate card only: reopens MatchModal as an edit (point 2, Danny live P1).
  onEdit?: () => void
  // The "other side" of the match — Client on the candidate card, Candidate on
  // the customer/scoped card (the one swap between the two variants, §3A).
  otherPartyLabel: ReactNode
  // Typed LINKED counterparty (heraudit F1a): a Match always links a real record
  // on its other side — a bare string cannot compile, so no MatchesTab can drop
  // the click-through again (the candidate tab shipped exactly that gap).
  // EntityLink renders plain truncated text when id is null.
  otherParty: { page: string; id: Id | null; label: string }
  contractType?: string | null
  // MATCH-SOORT-1: the Contractvorm chip — a distinct axis from contractType above.
  contractForm?: MatchContractForm | null
  contractStatus?: string | null
  functionTitle?: string | null
  branchName?: string | null
  ownerName?: string | null
  startDate?: string | null
  endDate?: string | null
  // Gates the expiry chip (point 6) — a finished match never needs the nag.
  isClosed?: boolean
  archived?: boolean
  // Opt-in COMPACT mode (Danny live review, 04-08: "meer compact in een tabel
  // weergegeven met de optie om het open te klappen"): collapses to ONE summary
  // row per match — title/stage, the other-party value, score, the open/edit
  // icons, and a chevron — expanding in place to the existing detail rows below.
  // Off by default so the customer drawer's own MatchesTab (and, in spirit, the
  // scoped Matches sub-tab) render byte-identical, unchanged.
  collapsible?: boolean
  // Opt-in FLAT row background (Danny 09-08, candidate drawer consistency sweep:
  // "achtergrondkleur van Match en sollicitatie kloppen niet" — the collapsed
  // summary line used the tinted `--bg` header tone while the candidate
  // drawer's own Sollicitaties rows are flat, so the two lists read as two
  // different components). When true, the header/summary line uses the plain
  // surface background instead — matching ApplicationRow's rows exactly. Off by
  // default: every OTHER caller (the customer drawer's own MatchesTab, which
  // never sets `collapsible` either) renders byte-identical.
  //
  // SECOND LOOK (Danny 09-08, "Open heeft geen kopje??"): flatRow now ALSO
  // splits the stage and the score out of the merged title/icon cluster into
  // their own labeled columns (Status, Match) — see the render below and
  // matchRowColumns.ts. Only flatRow gets the split, since it is the only
  // variant with a header bar above it to line columns up against.
  flatRow?: boolean
}

/**
 * MatchCard — the ONE read-only match card body, shared by the candidate
 * drawer's MatchesTab, the customer drawer's MatchesTab and (in spirit —
 * ScopedMatchesTab stays a DataTable per SCOPED-LIST-TAB-1, see that file's own
 * comment) the scoped location/department Matches sub-tab. Extracted so the
 * three call sites can never again drift into three different card bodies
 * (CLAUDE.md §11 — "extract, don't edit three copies in parallel").
 *
 * Danny's ten-point round, points 2/4/5/6:
 * (2) the header reads "{vacature} — {fase}" on one line, the stage's own
 *     colour on the stage half — the separate "Fase" row is gone.
 * (4) a "Periode" row (start – end, DD-MM-YYYY, em-dash when absent).
 * (5) Functie / Vestiging / Eigenaar rows off fields the list API already
 *     returns (MatchListResource.php:35,43-46) — see matchExpiry.ts's sibling
 *     mapMatch update. NOTE: the candidate-embedded resource (MatchResource,
 *     "no owner here — that needs a central lookup the candidate detail does
 *     not perform") never carries branch/owner, so those two rows read "—" on
 *     every candidate card — a real backend gap, not a frontend omission.
 * (6) an expiry chip (soft warning <30 days, danger once past) — pure FE, off
 *     the already-loaded row; never rendered for a closed/archived match.
 */
export default function MatchCard({
  id, vacancyId, vacancyTitle, vacancyUrl, onBeforeOpen,
  stageLabel, stageColor, score,
  helloflexGuid, helloflexLink, shiftmanagerLink, showHelloflex = false, showShiftmanager = false,
  onEdit,
  otherPartyLabel, otherParty,
  contractType, contractForm, contractStatus, functionTitle, branchName, ownerName, startDate, endDate,
  isClosed = false, archived = false,
  collapsible = false, flatRow = false,
}: MatchCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const { formatDate } = useDateFormat()
  // Compact mode's own expand state — collapsed by default (Danny: "collapsed
  // by default … click expands"); a per-card independent toggle, purely
  // presentational, never touched when collapsible is off.
  const [expanded, setExpanded] = useState(false)

  // Period row value — a single em-dash when NEITHER date is known, otherwise
  // formatDate's own '—' fallback covers a one-sided range (mirrors CommunicationTab).
  const periodValue = !startDate && !endDate ? '—' : `${formatDate(startDate)} – ${formatDate(endDate)}`
  // Point 6: never nag on a closed or archived match.
  const expiry = computeMatchExpiry(endDate, { closed: isClosed || archived })

  const rows: Array<{ key: string; label: ReactNode; value: ReactNode }> = [
    { key: 'otherParty', label: otherPartyLabel, value: <EntityLink page={otherParty.page} id={otherParty.id}>{otherParty.label || '—'}</EntityLink> },
    { key: 'functionTitle', label: t('matchesView.functionTitle'), value: functionTitle || '—' },
    { key: 'contractType', label: t('matchesView.contractType'), value: contractType || '—' },
    // MATCH-SOORT-1: the Contractvorm chip — one shared component, never a
    // per-screen restyle (§3A/§4).
    { key: 'contractForm', label: t('matchesView.contractForm'), value: contractForm ? <ContractFormChip contractForm={contractForm} /> : '—' },
    { key: 'period', label: t('matchesView.period'), value: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {periodValue}
        {expiry && (
          <SoftChip
            color={expiry.kind === 'expired' ? 'var(--color-danger)' : 'var(--color-warning)'}
            label={expiry.kind === 'expired'
              ? t('matchesView.expiredOn', { date: formatDate(endDate) })
              : t('matchesView.expiresOn', { date: formatDate(endDate) })}
          />
        )}
      </span>
    ) },
    { key: 'branch', label: t('matchesView.branch'), value: branchName || '—' },
    { key: 'owner', label: t('matchesView.owner'), value: ownerName || '—' },
    { key: 'contractStatus', label: t('matchesView.contract'), value: t(`matchesView.contractStatus.${contractStatus ?? 'none'}`, { defaultValue: contractStatus || t('matchesView.contractStatus.none') }) },
  ]

  // Title block: "{vacature} — {fase}" (point 2) — shared verbatim between the
  // default header and the compact summary row, never a second copy.
  const titleBlock = (
    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
      <span onClickCapture={onBeforeOpen} onClick={e => e.stopPropagation()} style={{ minWidth: 0, overflow: 'hidden' }}>
        {/* hideIcon: the explicit "Open match" ⧉ right after this is the ONE
            open-in-new icon for this row (Danny: "twee keer een icoon met
            open-in-nieuw-venster"). */}
        <EntityLink page="vacancies" id={vacancyId} title={vacancyTitle || '—'} hideIcon tone="neutral">{vacancyTitle || '—'}</EntityLink>
      </span>
      {stageLabel && (
        <>
          {/* Decorative separator, own element: keeps the fase label itself as a
              clean text match (getByText) and out of the screen-reader run. */}
          <span aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }}> — </span>
          <span style={{ color: stageColor || 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {stageLabel}
          </span>
        </>
      )}
    </span>
  )

  // Title-only block (STATUS-COLUMN-1, Danny 09-08 second look): the flatRow
  // (header-barred) variant below gives the stage its OWN column instead of the
  // " — {fase}" suffix titleBlock carries, so this drops that suffix. Every other
  // caller has no header bar to line the stage up against and keeps titleBlock.
  // minWidth 140, not 0: with 0 the title collapsed to a single letter in a narrow
  // drawer while the fixed columns kept their full width (Danny 09-08).
  const titleOnly = (
    <span style={{ flex: 1, minWidth: 140, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden' }}>
      <span onClickCapture={onBeforeOpen} onClick={e => e.stopPropagation()} style={{ minWidth: 0, overflow: 'hidden' }}>
        <EntityLink page="vacancies" id={vacancyId} title={vacancyTitle || '—'} hideIcon tone="neutral">{vacancyTitle || '—'}</EntityLink>
      </span>
    </span>
  )

  // Right-side icons: open-in-new / edit / backoffice / vacancy-URL — shared
  // verbatim between the default header and the compact summary row.
  const iconsBlock = (
    <>
      {id != null && (
        <a href={buildEntityDeepLink('matches', id)} target="_blank" rel="noopener noreferrer" onClick={onBeforeOpen}
          title={t('matchesView.openMatch')} aria-label={t('matchesView.openMatch')}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact match-card glyph control: deliberate bare 12–14px icon in a dense row; Button iconOnly’s 28px chrome would break the card metrics
          style={{ display: 'flex', color: 'var(--color-primary-text)', padding: 2 }}>
          <ExternalLink size={12} />
        </a>
      )}
      {/* Point 2 (Danny live P1): edit this match's contract fields — candidate card only. */}
      {onEdit && id != null && (
        <button type="button" onClick={onEdit} title={t('common:edit')} aria-label={t('common:edit')}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact match-card glyph control: deliberate bare 12–14px icon in a dense row; Button iconOnly’s 28px chrome would break the card metrics
          style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
          <Pencil size={12} />
        </button>
      )}
      {helloflexGuid ? (
        <span title={t('matchesView.backofficeLinked')} style={{ display: 'flex', color: 'var(--color-primary-text)' }}><Link2 size={13} /></span>
      ) : null}
      {(showHelloflex || showShiftmanager) && (
        <BackofficeCouplingIndicator helloflexLink={helloflexLink} shiftmanagerLink={shiftmanagerLink}
          showHelloflex={showHelloflex} showShiftmanager={showShiftmanager} />
      )}
      {isSafeUrl(vacancyUrl) ? (
        <a href={vacancyUrl ?? undefined} target="_blank" rel="noopener noreferrer" title={t('work.openVacancy')}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact match-card glyph control: deliberate bare 12–14px icon in a dense row; Button iconOnly’s 28px chrome would break the card metrics
          style={{ display: 'flex', color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
      ) : null}
    </>
  )
  const scorePill = <ScorePill value={score ?? null} />

  // Compact mode toggles on any click landing on the header's own empty space
  // (title/icons/score each stop propagation above so they keep working
  // independently) — the chevron button stays the explicit, keyboard-reachable
  // control (aria-expanded), the row click is a mouse convenience on top of it.
  const toggle = () => setExpanded(x => !x)
  // ACTIONS-COLUMN-1 (Danny 09-08 second look): a shared element so the flatRow
  // variant can render it INSIDE the fixed actions column below (it used to sit
  // OUTSIDE every column entirely, so the row ran wider than the header's own
  // trailing cell) while every other caller keeps it as its own trailing element.
  const chevronButton = (
    <button type="button" onClick={e => { e.stopPropagation(); toggle() }}
      title={expanded ? t('common:collapse') : t('common:expand')}
      aria-label={expanded ? t('common:collapse') : t('common:expand')}
      aria-expanded={expanded}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact match-card glyph control: deliberate bare 12–14px icon in a dense row; Button iconOnly’s 28px chrome would break the card metrics
      style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}>
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  )
  const showRows = !collapsible || expanded

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header: "{vacature} — {fase}" one-liner (point 2) + score + coupling
          glyphs. Compact mode (collapsible) additionally shows the other-party
          value inline and a chevron. flatRow order (Danny 09-08 second look,
          own labeled columns replacing the two headerless dashes): vacature,
          status, other party, score, actions+chevron. */}
      <div onClick={collapsible ? toggle : undefined} data-testid="match-card-header"
        style={{ padding: '8px 12px', background: flatRow ? 'var(--surface)' : 'var(--bg)', borderBottom: collapsible && !expanded ? 'none' : '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, cursor: collapsible ? 'pointer' : undefined }}>
        {flatRow ? titleOnly : titleBlock}
        {collapsible ? (
          <>
            {/* STATUS COLUMN (Danny 09-08 second look: "de status zit niet eens
                in een eigen kolom" — it used to ride glued onto the title behind
                an em-dash, see titleOnly above). flatRow-only, same as the two
                columns below: no header bar elsewhere to line it up against. */}
            {flatRow && (
              <span onClick={e => e.stopPropagation()} data-testid="match-col-status" style={MATCH_COL_STATUS}>
                {stageLabel && <StatusPill label={stageLabel} color={stageColor} />}
              </span>
            )}
            {/* Other-party value inline in the summary row (Danny: "vacancy title —
                status, client, score %, …") — stops propagation so clicking the
                value itself (may be an EntityLink) doesn't also toggle the row. */}
            {/* COLUMN-ALIGN-1 (Danny 09-08): under a header BAR these two cells must
                occupy a FIXED column, not shrink to their content — a maxWidth cell
                slides left as soon as the value is short, and the label above it
                stops pointing at anything. Only the header-bar caller (flatRow) pins
                them; every other caller keeps the content-width summary row it had. */}
            <span onClick={e => e.stopPropagation()} data-testid={flatRow ? 'match-col-client' : undefined}
              style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0,
              ...(flatRow ? MATCH_COL_OTHER_PARTY : { maxWidth: MATCH_COLUMN_WIDTH }),
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <EntityLink page={otherParty.page} id={otherParty.id}>{otherParty.label || '—'}</EntityLink>
            </span>
            {/* SCORE COLUMN (Danny 09-08 second look, point 3): the score is a DATA
                value ("82%" or a muted dash), not a click action, so it gets its
                own labeled column ("Match", matches:cols.score) instead of sitting
                as an unlabeled dash between the client name and the icon cluster —
                that dash was the SECOND headerless column Danny flagged. Only the
                pure click-actions below keep the shared empty header, mirroring
                ApplicationRow's own actions column. flatRow-only, same reasoning
                as the Status column above. */}
            {flatRow && (
              <span onClick={e => e.stopPropagation()} data-testid="match-col-score" style={MATCH_COL_SCORE}>{scorePill}</span>
            )}
            <span onClick={e => e.stopPropagation()} data-testid={flatRow ? 'match-col-actions' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              ...(flatRow ? MATCH_COL_ACTIONS : {}), justifyContent: flatRow ? 'flex-end' : undefined }}>
              {!flatRow && scorePill}
              {iconsBlock}
              {/* The chevron rides INSIDE this same fixed column for flatRow — see
                  ACTIONS-COLUMN-1 above. Every other caller keeps it as its own
                  trailing element (below). */}
              {flatRow && chevronButton}
            </span>
            {!flatRow && chevronButton}
          </>
        ) : (
          <>
            {iconsBlock}
            {scorePill}
          </>
        )}
      </div>

      {showRows && rows.map(({ key, label, value }) => (
        <div key={key} style={{ display: 'flex', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
