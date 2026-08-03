import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import MatchCard from '@/pages/matches/MatchCard'
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
 */
export default function MatchesTab({ c, onEdit }: { c: Candidate
  // Opens the match in MatchModal as an edit (WorkTab owns the modal state).
  onEdit?: (matchId: Id) => void }) {
  const { t } = useTranslation('candidates')
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
  const matches = q ? statusMatches.filter(m => [m.vacancyTitle, m.client].some(v => String(v ?? '').toLowerCase().includes(q))) : statusMatches

  return (
    // No title here (Danny addendum 4): this only ever renders inside the Match
    // tab's own "Matches" sub-tab — a second "Matches" heading would just repeat
    // the sub-tab bar right above it.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar mirrors the customer's own Matches tab — search left, status
          filter right, no add trigger (read-only list). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('matchesView.searchPlaceholder')} aria-label={t('matchesView.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={matchStatuses} />
      </div>
      <SectionCard>
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
            otherPartyLabel={t('matchesView.client')} otherPartyValue={m.client || '—'}
            contractType={m.contractType} contractStatus={m.contractStatus}
            functionTitle={m.functionTitle} startDate={m.startDate} endDate={m.endDate}
            isClosed={statusMeta?.is_closed}
          />
        )
      })}
      </SectionCard>
    </div>
  )
}
