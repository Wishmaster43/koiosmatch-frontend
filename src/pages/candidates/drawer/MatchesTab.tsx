import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import DrawerAddButton from './DrawerAddButton'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import MatchCard from '@/pages/matches/MatchCard'
import { MATCH_COL_STATUS, MATCH_COL_OTHER_PARTY, MATCH_COL_SCORE, MATCH_COL_ACTIONS } from '@/pages/matches/matchRowColumns'
import { rememberReturnTab } from './constants'
import type { Candidate, CandidateMatch } from '@/types/candidate'
import type { Id } from '@/types/common'

/**
 * MatchesTab — READ-ONLY view of the candidate's matches (decided model: a Match
 * is its own entity; the contract lives in HelloFlex, we only show its status).
 * Match fields (customer/contract/financial) ARE editable via the pencil
 * (point 2, Danny live P1) — it reopens the same MatchModal in EDIT mode
 * (PATCH /matches/{id}); the lifecycle status itself still isn't touched here.
 *
 * The card BODY is the shared `MatchCard` (Danny's ten-point round, point 2/4/5/6:
 * fase merges into the title, Periode/Functie/Vestiging/Eigenaar rows, expiry
 * chip) — extracted so this tab, the customer drawer's own MatchesTab and the
 * scoped Matches sub-tab can never again drift into three different card bodies.
 * Vestiging/Eigenaar always read "—" here: the candidate-embedded MatchResource
 * carries neither (see MatchCard's own docblock) — a real backend gap, not
 * dropped here.
 *
 * TOOLBAR (Danny 03-08, one look on both the customer's and this card — "bij
 * Matches wil ik ook een zoekbalk en statussen hebben"): search (vacancy title +
 * client name) + the shared StatusFilterSelect keyed on the SAME match-status
 * vocabulary the title's own fase resolves via useMatchStatuses().
 *
 * ONE-LINE TOOLBAR (Danny live review, 04-08: "Zoeken status en + match moet op
 * 1 lijn!!"): the optional `onAdd` renders the house DrawerAddButton at the END
 * of this SAME row — WorkTab used to render "+ Match" on its own flex-end row
 * ABOVE this component; that separate row is gone, `onAdd` is how WorkTab still
 * owns the modal-open callback without this read-only tab knowing about MatchModal.
 *
 * COMPACT ROWS + NEWEST-FIRST (Danny live review, 04-08: the per-match cards
 * "meer compact in een tabel weergegeven met de optie om het open te klappen …
 * gesorteerd op nieuwste match bovenaan"): every `MatchCard` renders with its
 * opt-in `collapsible` prop — one summary row per match, expanding in place —
 * and the list is sorted by `createdAt` descending before render (see the sort
 * comment below for the field's provenance).
 */
export default function MatchesTab({ c, onEdit, onAdd }: { c: Candidate
  // Opens the match in MatchModal as an edit (WorkTab owns the modal state).
  onEdit?: (matchId: Id) => void
  // Opens the match CREATE modal (WorkTab owns the modal state) — omitted, the
  // button simply doesn't render (mirrors the onEdit pencil's own optional gate).
  onAdd?: () => void }) {
  // 'matches' is loaded for the Score column header below (matches:cols.score),
  // reused from MatchesTable's own "Match" column label rather than a new key.
  const { t } = useTranslation(['candidates', 'matches'])
  // Match lifecycle lookup (R-1b) — resolves the title's fase + the "Contract"
  // row from the status slug, same as MatchesTable/MatchDrawer; the backend-
  // resolved stage/stageColor stay the fallback for payloads without the slug yet.
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  const allMatches = c.matches ?? []
  const [search, setSearch] = useState('')

  // Status filter — same shared component/hook as the customer's own Matches tab.
  const { value: statusFilter, toggle: toggleStatus, filtered: statusMatches } =
    useStatusFilter(allMatches, matchStatuses, (m: CandidateMatch) => m.status ?? '')

  // Free-text search on top of the status filter — vacancy title + client name.
  const q = search.trim().toLowerCase()
  const filteredMatches = q ? statusMatches.filter(m => [m.vacancyTitle, m.client].some(v => String(v ?? '').toLowerCase().includes(q))) : statusMatches

  // Sort newest match first (Danny live review, 04-08: "gesorteerd... op nieuwste
  // match bovenaan"). CandidateMatch.createdAt (mapCandidate.ts MATCH-EMBED-1)
  // carries the row's own created_at — Candidate/MatchResource.php:34 ships it on
  // every candidate-embedded match, so no field is invented here. A row missing
  // it (should not happen given the backend always sends it) sorts LAST, never
  // reordered ahead of a dated row.
  const matches = [...filteredMatches].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : -Infinity
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : -Infinity
    return bt - at
  })

  return (
    // No title here (Danny addendum 4): this only ever renders inside the Match
    // tab's own "Matches" sub-tab — a second "Matches" heading would just repeat
    // the sub-tab bar right above it.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar mirrors the customer's own Matches tab — search left (grows),
          status filter, then "+ Match" (when the host wires onAdd) — ALL ON ONE
          LINE (Danny live review, 04-08). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('matchesView.searchPlaceholder')} aria-label={t('matchesView.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={matchStatuses} />
        {/* "+ Match" stays a FULL-label named action (05-08 short-label decision
            list) — never the drawer sub-tab's shortened "Nieuw". */}
        {onAdd && <DrawerAddButton onClick={onAdd} label={t('work.addMatch')} />}
      </div>
      <SectionCard>
      {/* Column header bar (Danny 09-08: "Match heeft geen titelbalk en
          sollicitaties wel" — mirrors WorkTab's own header bar, same style, so
          both lists read as one system). SECOND LOOK (Danny 09-08, "Open heeft
          geen kopje??"): the status pill used to ride glued onto the title
          behind an em-dash and the score pill sat as an unlabeled dash between
          the client name and the icon cluster — both are real columns now,
          reading their widths from the SAME matchRowColumns.ts MatchCard's own
          cells use (never two loose numbers — this header used to hardcode its
          own `width: 140` literals instead of importing them, the exact bug
          this shared module exists to prevent). Column order: Vacature ·
          Status · Klant · Match(score) · actions (empty header — pure
          click-icons + chevron only, mirrors WorkTab's own actions column). */}
      {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- table-header BAR: the 11/600 muted typography inherits into its column cells; a text atom cannot be this flex container */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8,
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
        {/* minWidth:0 lets this shrink, so it MUST clip — without overflow the
            label paints straight over the next column when space runs short
            (Danny 09-08 saw "VacatuStatus" printed on top of each other). */}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('work.vacancy')}</span>
        {/* Reuses the SAME key ApplicationRow's own status column uses (WorkTab.tsx) —
            "de sollicitatielijst gebruikt er een voor zijn eigen statuskop". */}
        <span data-testid="match-col-status-header" style={MATCH_COL_STATUS}>{t('work.colStatus')}</span>
        <span data-testid="match-col-client-header" style={MATCH_COL_OTHER_PARTY}>{t('matchesView.client')}</span>
        {/* Reuses MatchesTable's own score-column label ("Match") rather than a new key. */}
        <span data-testid="match-col-score-header" style={MATCH_COL_SCORE}>{t('matches:cols.score')}</span>
        <span aria-hidden="true" data-testid="match-col-actions-header" style={MATCH_COL_ACTIONS} />
      </div>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('matchesView.empty')}</div>
      ) : matches.map((m, i) => {
        const statusMeta = matchStatusMeta(m.status ?? undefined)
        return (
          <MatchCard
            key={m.id ?? i}
            id={m.id} vacancyId={m.vacancyId} vacancyTitle={m.vacancyTitle || m.client || '—'} vacancyUrl={m.vacancyUrl}
            // NAV-BACK-1: remember this subtab (Work/Match) so BACK from the
            // opened match lands on the same drawer tab instead of Profile.
            onBeforeOpen={() => rememberReturnTab(c.id, 'work')}
            stageLabel={statusMeta?.label ?? m.stage} stageColor={statusMeta?.color ?? m.stageColor}
            score={m.score}
            helloflexGuid={m.helloflex_contract_guid}
            // Point 2 (Danny live P1): reopens MatchModal in EDIT mode.
            onEdit={onEdit && m.id != null ? () => onEdit(m.id as Id) : undefined}
            otherPartyLabel={t('matchesView.client')}
            otherParty={{ page: 'customers', id: m.customerId ?? null, label: m.client || '' }}
            contractType={m.contractType} contractForm={m.contractForm} contractStatus={m.contractStatus}
            functionTitle={m.functionTitle} startDate={m.startDate} endDate={m.endDate}
            isClosed={statusMeta?.is_closed}
            // Compact mode (Danny live review, 04-08): collapsed by default, one
            // summary row per match, expanding in place — see MatchCard's own prop doc.
            collapsible
            // Flat row background (Danny 09-08): matches ApplicationRow's own flat
            // rows now that this list has its own tinted column-header bar above —
            // see MatchCard's own prop doc for why this is opt-in.
            flatRow
          />
        )
      })}
      </SectionCard>
    </div>
  )
}
