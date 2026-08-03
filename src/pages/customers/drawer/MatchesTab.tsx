import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Search } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink, { buildEntityDeepLink } from '@/components/ui/EntityLink'
import BackofficeCouplingIndicator from '@/components/ui/BackofficeCouplingIndicator'
import ScorePill from '@/pages/matches/ScorePill'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useApps } from '@/context/AppsContext'
import { useCustomerMatches } from '../hooks/useCustomerDrawerData'
import type { CustomerMatchRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'
import type { ReactNode } from 'react'

/**
 * MatchesTab — the customer's matches, mirroring the candidate drawer's own
 * MatchesTab 1:1 (§3A/§3B): read-only cards (a match is opened/edited in its own
 * drawer, never here — no pencil, no MatchModal, no "+" trigger — a match is
 * created via the funnel/direct-match flows, never from this list), same row
 * labels, same empty state. The one swap: the candidate card's "Client" row
 * becomes "Candidate" here, since the customer is already the fixed side of
 * every row.
 *
 * TOOLBAR (Danny 03-08: "bij Matches wil ik ook een zoekbalk en statussen
 * hebben"): search (vacancy title + candidate name) + the shared
 * StatusFilterSelect keyed on the SAME match-status vocabulary the "Fase" row
 * already resolves via useMatchStatuses — never a literal status list.
 *
 * Lazily fetched (§9): only mounts — and only then fires GET /matches?customer_id=
 * — when this tab is the active one, same as every other customer drawer tab.
 */
export default function MatchesTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation(['customers', 'candidates', 'matches'])
  // Match lifecycle lookup (R-1b) — resolves the "Fase" row's label/colour from the
  // status slug, same source the candidate card and the matches page table use.
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  // Backoffice coupling glyph — gated on the tenant's own enabled apps, mirrors MatchesTable.
  const apps = useApps()
  const showHelloflex = apps?.isAppEnabled('hf') ?? false
  const showShiftmanager = apps?.isAppEnabled('shiftmanager') ?? false
  const { rows, loading, error } = useCustomerMatches(customerId)
  const [search, setSearch] = useState('')

  // Status filter — same shared component/hook as every other sub-entity list,
  // keyed on the match's own status SLUG (the row carries no separate id, only
  // the value useMatchStatuses already resolves the "Fase" chip from).
  const { value: statusFilter, toggle: toggleStatus, filtered: statusRows } =
    useStatusFilter(rows, matchStatuses, (r: CustomerMatchRow) => r.status ?? '')

  // Free-text search on top of the status filter — vacancy title + candidate name.
  const q = search.trim().toLowerCase()
  const matches = q ? statusRows.filter(m => [m.vacancy, m.candidate].some(v => String(v ?? '').toLowerCase().includes(q))) : statusRows

  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('customers:page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('customers:matches.loadError')}</div></SectionCard>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar mirrors the other sub-entity lists: search left, status filter
          right — no add trigger, a match is never created from this read-only list. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('customers:matches.searchPlaceholder')} aria-label={t('customers:matches.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={matchStatuses} />
      </div>
      <SectionCard>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('candidates:matchesView.empty')}</div>
      ) : matches.map((m, i) => {
        const statusMeta = matchStatusMeta(m.status ?? undefined)
        const stageLabel = statusMeta?.label ?? m.stage
        const stageColor = statusMeta?.color ?? m.stageColor
        return (
        <div key={m.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          {/* Header: vacancy + score + (gated) backoffice coupling glyph. */}
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {/* hideIcon: the explicit "Open match" ⧉ right after this is the ONE
                  open-in-new icon for this row (Danny: "twee keer een icoon met
                  open-in-nieuw-venster") — the vacancy name itself keeps its
                  in-app-navigate click, just without its own duplicate glyph. */}
              <EntityLink page="vacancies" id={m.vacancyId} title={m.vacancy || '—'} hideIcon>{m.vacancy || '—'}</EntityLink>
            </span>
            {m.id != null && (
              // Explicit "Open match" new-tab affordance (mirrors the candidate card).
              <a href={buildEntityDeepLink('matches', m.id)} target="_blank" rel="noopener noreferrer"
                title={t('candidates:matchesView.openMatch')} aria-label={t('candidates:matchesView.openMatch')}
                style={{ display: 'flex', color: 'var(--color-primary)', padding: 2 }}>
                <ExternalLink size={12} />
              </a>
            )}
            {/* Only shown once the tenant actually enabled a backoffice system — a bare
                "not linked" dash for every match on a tenant without either module
                would just be clutter (unlike the dedicated table column it mirrors). */}
            {(showHelloflex || showShiftmanager) && (
              <BackofficeCouplingIndicator helloflexLink={m.helloflexLink} shiftmanagerLink={m.shiftmanagerLink}
                showHelloflex={showHelloflex} showShiftmanager={showShiftmanager} />
            )}
            <ScorePill value={m.score} />
          </div>
          {([
            [t('matches:cols.candidate'),          <EntityLink key="cand" page="candidates" id={m.candidateId}>{m.candidate || '—'}</EntityLink>],
            [t('candidates:matchesView.contractType'), m.contractType || '—'],
            [t('candidates:matchesView.stage'),        stageLabel ? <StatusPill label={stageLabel} color={stageColor} /> : '—'],
            [t('candidates:matchesView.contract'),     t(`candidates:matchesView.contractStatus.${m.contractStatus ?? 'none'}`, { defaultValue: m.contractStatus || t('candidates:matchesView.contractStatus.none') })],
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
