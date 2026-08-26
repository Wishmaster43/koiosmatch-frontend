/**
 * MatchesTab — the customer's matches, mirroring the candidate drawer's own
 * MatchesTab 1:1 (§3A/§3B): read-only cards (a match's own FIELDS are opened/
 * edited in its own drawer, never here — no pencil on the card), same row
 * labels, same empty state. The one swap: the candidate card's "Client" row
 * becomes "Candidate" here, since the customer is already the fixed side of
 * every row. The card BODY is the shared `MatchCard` (Danny's ten-point round,
 * point 2/4/5/6) — extracted so this tab, the candidate drawer's own MatchesTab
 * and the scoped Matches sub-tab can never again drift into three different
 * card bodies.
 *
 * Point 1 (Danny): "+ Match" creates a DIRECT match already scoped to this
 * customer — MatchModal's candidate-less mode (proven at MatchesPage.tsx:374),
 * with `initialCustomerId` threaded into useMatchForm's cascade as an INITIAL
 * value (a prefill, never a lock — the recruiter can still change it).
 *
 * TOOLBAR (Danny 03-08: "bij Matches wil ik ook een zoekbalk en statussen
 * hebben", i.e. "on Matches I also want a search bar and statuses"): search
 * (vacancy title + candidate name) + the shared StatusFilterSelect keyed on
 * the SAME match-status vocabulary the title's own fase already resolves via
 * useMatchStatuses. House order (Danny, live 04-08: "Nieuwe Match is
 * rechts!!! en status in het midden", i.e. "New Match is on the right!!! and
 * status in the middle"): search left, status filter middle, "+ Match" last —
 * same left-to-right reading as every other sub-entity list (Locaties/
 * Afdelingen/Contactpersonen).
 *
 * Lazily fetched (§9): only mounts — and only then fires GET /matches?customer_id=
 * — when this tab is the active one, same as every other customer drawer tab.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useApps } from '@/context/AppsContext'
import { MatchCard, MatchListHeaderBar } from '@/pages/matches/shared'
import { MatchModal } from '@/pages/candidates/shared'
import { useCustomerMatches } from '../hooks/useCustomerDrawerData'
import type { CustomerMatchRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

// Customer-scoped read-only matches tab (see the module doc above): lazily mounted, with the same search+status toolbar order as the sibling sub-entity lists.
export default function MatchesTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation(['customers', 'candidates', 'matches'])
  // Match lifecycle lookup (R-1b) — resolves the title's fase from the status
  // slug, same source the candidate card and the matches page table use.
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  // Backoffice coupling glyph — gated on the tenant's own enabled apps, mirrors MatchesTable.
  const apps = useApps()
  const showHelloflex = apps?.isAppEnabled('hf') ?? false
  const showShiftmanager = apps?.isAppEnabled('shiftmanager') ?? false
  const { rows, loading, error, reload } = useCustomerMatches(customerId)
  const [search, setSearch] = useState('')
  // Point 1: "+ Match" — the modal shares state with the read-only list below.
  const [adding, setAdding] = useState(false)

  // Status filter — same shared component/hook as every other sub-entity list,
  // keyed on the match's own status SLUG (the row carries no separate id, only
  // the value useMatchStatuses already resolves the title's fase from).
  const { value: statusFilter, toggle: toggleStatus, filtered: statusRows } =
    useStatusFilter(rows, matchStatuses, (r: CustomerMatchRow) => r.status ?? '')

  // Free-text search on top of the status filter — vacancy title + candidate name.
  const q = search.trim().toLowerCase()
  const matches = q ? statusRows.filter(m => [m.vacancy, m.candidate].some(v => String(v ?? '').toLowerCase().includes(q))) : statusRows

  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('customers:page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('customers:matches.loadError')}</div></SectionCard>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar in the house order (Danny, live 04-08): search left, status
          filter middle, "+ Match" right (point 1: a match CAN now be created
          from this list) — mirrors Locaties/Afdelingen/Contactpersonen. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('customers:matches.searchPlaceholder')} aria-label={t('customers:matches.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={matchStatuses} />
        {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short — this is "Nieuwe match" (new
            record), unlike WorkTab's bare "Match" named-action button which stays
            full (see DrawerAddButton's own docblock). */}
        <DrawerAddButton onClick={() => setAdding(true)} label={t('customers:matches.add')} short />
      </div>
      <SectionCard>
      {/* KLANTEN 4 (Danny 21-08 "Weergeven zoals bij de kandidaat"): the same
          shared column-header bar + collapsed flat rows the candidate tab has. */}
      <MatchListHeaderBar otherPartyLabel={t('matches:cols.candidate')} />
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
            contractType={m.contractType} contractStatus={m.contractStatus}
            functionTitle={m.functionTitle} branchName={m.branchName} ownerName={m.owner}
            startDate={m.startDate} endDate={m.endDate}
            isClosed={statusMeta?.is_closed} archived={m.archived}
            collapsible flatRow
          />
        )
      })}
      </SectionCard>
      {/* Point 1: direct match, already scoped to this customer (a prefill, never
          a lock — the cascade pickers below stay fully editable). */}
      {adding && (
        <MatchModal initialCustomerId={customerId} onClose={() => setAdding(false)} onCreated={reload} />
      )}
    </div>
  )
}
