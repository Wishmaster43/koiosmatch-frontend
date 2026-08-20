import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useApps } from '@/context/AppsContext'
import MatchCard from '@/pages/matches/MatchCard'
import { useVacancyMatches } from '../hooks/useVacancyMatches'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

/**
 * MatchesTab (vacancy drawer) — V-table-2: READ-ONLY view of this vacancy's
 * matches (GET /vacancies/{id}/matches). Mirrors the candidate/customer
 * drawer's own read-only MatchesTab anatomy 1:1 (§3A — "a match is the
 * continuation of an application → placement"): search + status filter
 * toolbar, the shared MatchCard body, four explicit UI states. No pencil, no
 * "+ Match" — a Match is created from the candidate/customer side, never here.
 * The one swap: the candidate/customer card's "Client"/"Candidate" row becomes
 * "Candidate" here too, since THIS vacancy is already the fixed side of every
 * row (mirrors the customer drawer's own swap for its fixed side).
 */
export default function MatchesTab({ vacancyId }: { vacancyId?: Id }) {
  const { t } = useTranslation(['vacancies', 'candidates', 'matches'])
  // Match lifecycle lookup (R-1b) — same source the candidate/customer cards use.
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  // Backoffice coupling glyph — gated on the tenant's own enabled apps, mirrors MatchesTable.
  const apps = useApps()
  const showHelloflex = apps?.isAppEnabled('hf') ?? false
  const showShiftmanager = apps?.isAppEnabled('shiftmanager') ?? false
  const { rows, loading, error } = useVacancyMatches(vacancyId)
  const [search, setSearch] = useState('')

  // Status filter — same shared component/hook as every other Matches tab.
  const { value: statusFilter, toggle: toggleStatus, filtered: statusRows } =
    useStatusFilter(rows, matchStatuses, (r: MatchRow) => r.status ?? '')

  // Free-text search on top of the status filter — candidate name only (the
  // vacancy is already fixed, unlike the customer tab which also searches it).
  const q = search.trim().toLowerCase()
  const matches = q ? statusRows.filter(m => String(m.candidate ?? '').toLowerCase().includes(q)) : statusRows

  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('matchesTab.loadError')}</div></SectionCard>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('candidates:matchesView.searchPlaceholder')} aria-label={t('candidates:matchesView.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={matchStatuses} />
      </div>
      <SectionCard>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('candidates:matchesView.empty')}</div>
      ) : matches.map((m, i) => {
        const statusMeta = matchStatusMeta(m.status ?? undefined)
        return (
          <MatchCard
            key={m.id ?? i}
            id={m.id} vacancyId={m.vacancyId} vacancyTitle={m.vacancy || '—'}
            stageLabel={statusMeta?.label ?? m.stage} stageColor={statusMeta?.color ?? m.stageColor}
            score={m.score}
            helloflexLink={m.helloflexLink} shiftmanagerLink={m.shiftmanagerLink}
            showHelloflex={showHelloflex} showShiftmanager={showShiftmanager}
            otherPartyLabel={t('matches:cols.candidate')}
            otherParty={{ page: 'candidates', id: m.candidateId ?? null, label: m.candidate || '' }}
            contractType={m.contractType} contractForm={m.contractForm}
            functionTitle={m.functionTitle} branchName={m.branchName} ownerName={m.owner}
            startDate={m.startDate} endDate={m.endDate}
            isClosed={statusMeta?.is_closed} archived={m.archived}
            collapsible flatRow
          />
        )
      })}
      </SectionCard>
    </div>
  )
}
