import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2, ExternalLink, Pencil, Search } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink, { buildEntityDeepLink } from '@/components/ui/EntityLink'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { rememberReturnTab } from './constants'
import type { ReactNode } from 'react'
import type { Candidate, CandidateMatch } from '@/types/candidate'
import type { Id } from '@/types/common'
import { isSafeUrl } from '@/lib/safeUrl'

// Match score as a soft-coloured percentage (green ≥75, amber ≥50, red below).
function ScorePill({ value }: { value?: number | null }) {
  if (value == null) return null
  const c = value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{value}%</span>
}

/**
 * MatchesTab — READ-ONLY view of the candidate's matches (decided model: a Match
 * is its own entity; the contract lives in HelloFlex, we only show its status).
 * Match fields (customer/contract/financial) ARE editable via the pencil
 * (point 2, Danny live P1) — it reopens the same MatchModal in EDIT mode
 * (PATCH /matches/{id}); the lifecycle status itself still isn't touched here.
 *
 * TOOLBAR (Danny 03-08, one look on both the customer's and this card — "bij
 * Matches wil ik ook een zoekbalk en statussen hebben"): search (vacancy title +
 * client name) + the shared StatusFilterSelect keyed on the SAME match-status
 * vocabulary the "Fase" row already resolves via useMatchStatuses.
 */
export default function MatchesTab({ c, onEdit }: { c: Candidate
  // Opens the match in MatchModal as an edit (WorkTab owns the modal state).
  onEdit?: (matchId: Id) => void }) {
  const { t } = useTranslation('candidates')
  // Match lifecycle lookup (R-1b) — resolves the "Fase" row's label/colour from the
  // status slug, same as MatchesTable/MatchDrawer; the backend-resolved stage/
  // stageColor stay the fallback for payloads that don't send the slug yet.
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
        const stageLabel = statusMeta?.label ?? m.stage
        const stageColor = statusMeta?.color ?? m.stageColor
        return (
        <div key={m.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          {/* Header: vacancy + score + (subtle) backoffice-link icon when coupled */}
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {/* Danny 16-07 (punt 15): ANY cross-entity jump from this card must return
                  to the Werk tab — the stash was only on the match button before. */}
              <span onClickCapture={() => rememberReturnTab(c.id, 'work')}>
                {/* hideIcon: the explicit "Open match" ⧉ right after this is the ONE
                    open-in-new icon for this row (Danny: "twee keer een icoon met
                    open-in-nieuw-venster") — the vacancy name keeps its in-app
                    navigate click, just without its own duplicate glyph. */}
                <EntityLink page="vacancies" id={m.vacancyId} title={m.vacancyTitle || m.client || '—'} hideIcon>{m.vacancyTitle || m.client || '—'}</EntityLink>
              </span>
            </span>
            {m.id != null && (
              // NAV-BACK-1: remember this subtab (Work/Match) so BACK from the
              // opened match lands on the same drawer tab instead of Profile.
              // Danny 21-07: this is an explicit "Open match" affordance, so it is
              // a real new-tab anchor (was a button that only navigated in-app).
              <a href={buildEntityDeepLink('matches', m.id)} target="_blank" rel="noopener noreferrer"
                onClick={() => rememberReturnTab(c.id, 'work')}
                title={t('matchesView.openMatch')} aria-label={t('matchesView.openMatch')}
                style={{ display: 'flex', color: 'var(--color-primary)', padding: 2 }}>
                <ExternalLink size={12} />
              </a>
            )}
            {/* Point 2 (Danny live P1): edit this match's contract fields — reopens
                MatchModal in EDIT mode (PATCH /matches/{id}). */}
            {onEdit && m.id != null && (
              <button type="button" onClick={() => onEdit(m.id as Id)}
                title={t('common:edit')} aria-label={t('common:edit')}
                style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                <Pencil size={12} />
              </button>
            )}
            {m.helloflex_contract_guid ? (
              <span title={t('matchesView.backofficeLinked')} style={{ display: 'flex', color: 'var(--color-primary)' }}><Link2 size={13} /></span>
            ) : null}
            {/* Read-only link out to the vacancy when the API exposes a URL. */}
            {isSafeUrl(m.vacancyUrl) ? (
              <a href={m.vacancyUrl} target="_blank" rel="noopener noreferrer" title={t('work.openVacancy')}
                style={{ display: 'flex', color: 'var(--text-muted)' }}><ExternalLink size={12} /></a>
            ) : null}
            <ScorePill value={m.score} />
          </div>
          {([
            [t('matchesView.client'),       m.client || '—'],
            [t('matchesView.contractType'), m.contractType || '—'],
            [t('matchesView.stage'),        stageLabel ? <StatusPill label={stageLabel} color={stageColor} /> : '—'],
            [t('matchesView.contract'),     t(`matchesView.contractStatus.${m.contractStatus ?? 'none'}`, { defaultValue: m.contractStatus || t('matchesView.contractStatus.none') })],
          ] as Array<[string, ReactNode]>).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
        )
      })}
      </SectionCard>
    </div>
  )
}
