/**
 * ScopedMatchesTab — the department/location "Matches" sub-tab (SCOPED-LIST-TAB-1).
 * Thin adapter over the shared ScopedListTab: picks the right scope param and
 * reuses the shared match mapper (mapMatch) + the matches page's own column
 * shape (candidate/vacancy links) — never a forked copy. Read-only rows: a
 * match's own fields are opened/edited in its own drawer (§3B).
 *
 * Point 2 (Danny's ten-point round): the vacancy + stage columns merge into ONE
 * "{vacature} — {fase}" cell (mirrors MatchCard's own title) — no separate Fase
 * column. Point 4: a Periode column (start – end, DD-MM-YYYY) carries the same
 * expiry chip (point 6) MatchCard renders, inline next to the date range — this
 * stays a DataTable (not a card) per SCOPED-LIST-TAB-1, so the chip rides in the
 * date cell rather than a new column. Function/Vestiging/Eigenaar (the rest of
 * point 5) are deliberately NOT added as extra columns here — three more columns
 * would overflow this narrow drawer panel with no existing precedent (every
 * other scoped list — ScopedVacanciesTab — stays at three columns too); that
 * info is one click away in the match's own drawer.
 *
 * Point 1: "+ Match" — a DIRECT match already scoped to this location/department
 * (and its customer, threaded down from LocationDetail/DepartmentDetail) via
 * MatchModal's candidate-less mode, prefilling the Relaties cascade.
 *
 * STATUS FILTER (Danny 05-08 live review): the same match-status lookup the
 * customer-level MatchesTab filters on (useMatchStatuses, seeded so it is never
 * empty — no `resolved` guard needed, unlike the vacancy status fetch above in
 * ScopedVacanciesTab), keyed on the row's own status slug. No separate "Status"
 * column is added: the vacancy cell already renders "{vacature} — {fase}" in the
 * status's own colour (Point 2 above) — the exact same story the customer-level
 * MatchesTab tells via MatchCard's title, never a StatusPill column there either.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import EntityLink from '@/components/ui/EntityLink'
import SoftChip from '@/components/ui/SoftChip'
import { useNavigation } from '@/context/NavigationContext'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useDateFormat } from '@/lib/datetime'
import { mapMatch } from '@/pages/matches/hooks/useMatches'
import { computeMatchExpiry } from '@/pages/matches/matchExpiry'
import MatchModal from '@/pages/candidates/drawer/MatchModal'
import ScopedListTab from './ScopedListTab'
import type { RawMatch, MatchRow } from '@/types/match'
import type { Id } from '@/types/common'
import type { Column } from '@/components/ui/DataTable'

// Two extra fields MatchRow doesn't carry — same shape as the customer-level
// CustomerMatchRow (useCustomerDrawerData.ts), read straight off the raw row.
interface ScopedMatchRow extends MatchRow {
  contractType: string | null
}

const mapRow = (raw: Record<string, unknown>): ScopedMatchRow => ({
  ...mapMatch(raw as RawMatch),
  contractType: (raw.contract_type as string) ?? null,
})

export default function ScopedMatchesTab({ scope, id, customerId }: {
  scope: 'department' | 'location'; id: Id | undefined
  // Point 1: threaded down from LocationDetail/DepartmentDetail so "+ Match" can
  // prefill the cascade even though this tab itself only ever asked for `id`.
  // No scopeName is needed here — MatchModal's own cascade pickers already show
  // the picked location/department NAME live once seeded, unlike AddVacancyModal
  // (see ScopedVacanciesTab, which has no such picker and needs the name to show).
  customerId?: Id
}) {
  const { t } = useTranslation(['customers', 'matches', 'candidates'])
  const { openEntity } = useNavigation()
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  const { formatDate } = useDateFormat()
  const queryClient = useQueryClient()
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'
  const [adding, setAdding] = useState(false)

  const columns: Column<ScopedMatchRow>[] = [
    { key: 'candidate', header: t('matches:cols.candidate'), sortable: true, sortValue: m => m.candidate,
      render: m => <EntityLink page="candidates" id={m.candidateId}>{m.candidate}</EntityLink> },
    // Point 2: vacancy + fase on one line, the fase in its own status colour —
    // mirrors MatchCard's title exactly, no separate Fase column.
    { key: 'vacancy', header: t('matches:cols.vacancy'), sortable: true, sortValue: m => m.vacancy,
      render: m => {
        const meta = matchStatusMeta(m.status ?? undefined)
        const label = meta?.label ?? m.stage
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <EntityLink page="vacancies" id={m.vacancyId}>{m.vacancy}</EntityLink>
            {label && (
              <>
                {/* Decorative separator, own element — mirrors MatchCard's title
                    exactly, so the fase label stays its own clean text match. */}
                <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}> — </span>
                <span style={{ color: meta?.color ?? m.stageColor ?? 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </>
            )}
          </span>
        )
      } },
    { key: 'contractType', header: t('candidates:matchesView.contractType'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: m => m.contractType || '—' },
    // Point 4/6: contract window + its own expiry chip (never for a closed match).
    { key: 'period', header: t('candidates:matchesView.period'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: m => {
        const isClosed = Boolean(matchStatusMeta(m.status ?? undefined)?.is_closed)
        const expiry = computeMatchExpiry(m.endDate, { closed: isClosed || m.archived })
        if (!m.startDate && !m.endDate) return '—'
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {formatDate(m.startDate)} – {formatDate(m.endDate)}
            {expiry && (
              <SoftChip
                color={expiry.kind === 'expired' ? 'var(--color-danger)' : 'var(--color-warning)'}
                label={expiry.kind === 'expired'
                  ? t('candidates:matchesView.expiredOn', { date: formatDate(m.endDate) })
                  : t('candidates:matchesView.expiresOn', { date: formatDate(m.endDate) })}
              />
            )}
          </span>
        )
      } },
  ]

  return (
    <>
      <ScopedListTab<ScopedMatchRow>
        queryKey={`${scope}-matches`} endpoint="/matches" paramName={paramName} id={id}
        mapRow={mapRow} columns={columns} searchKeys={['candidate', 'vacancy']}
        searchPlaceholder={t('common:search')} loadingText={t('customers:page.loading')}
        emptyText={t('customers:scopedList.matchesEmpty')} errorText={t('customers:scopedList.loadError')}
        onRowClick={m => m.id != null && openEntity('matches', m.id)}
        // Point 1: only offered once the caller actually knows the customer —
        // otherwise the modal would have nothing to prefill (§3, no fake affordance).
        onAdd={customerId ? () => setAdding(true) : undefined}
        addLabel={t('customers:matches.add')}
        // STATUS FILTER: mirrors the customer-level MatchesTab's own useStatusFilter call.
        statuses={matchStatuses}
        statusOf={m => m.status ?? ''}
      />
      {adding && (
        <MatchModal
          initialCustomerId={customerId}
          initialCustomerLocationId={scope === 'location' ? id : undefined}
          initialCustomerDepartmentId={scope === 'department' ? id : undefined}
          onClose={() => setAdding(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: [`${scope}-matches`, '/matches', paramName, id] })}
        />
      )}
    </>
  )
}
