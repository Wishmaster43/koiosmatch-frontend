/**
 * ScopedMatchesTab — the department/location "Matches" sub-tab (SCOPED-LIST-TAB-1).
 * Thin adapter over the shared ScopedListTab: picks the right scope param and
 * reuses the shared match mapper (mapMatch) + the matches page's own column
 * shape (candidate/vacancy links, stage pill via useMatchStatuses) — never a
 * forked copy. Read-only: a match is opened/edited in its own drawer (§3B).
 */
import { useTranslation } from 'react-i18next'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import { useNavigation } from '@/context/NavigationContext'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { mapMatch } from '@/pages/matches/hooks/useMatches'
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

export default function ScopedMatchesTab({ scope, id }: { scope: 'department' | 'location'; id: Id | undefined }) {
  const { t } = useTranslation(['customers', 'matches', 'candidates'])
  const { openEntity } = useNavigation()
  const { metaOf: matchStatusMeta } = useMatchStatuses()
  const paramName = scope === 'department' ? 'customer_department_id' : 'customer_location_id'

  const columns: Column<ScopedMatchRow>[] = [
    { key: 'candidate', header: t('matches:cols.candidate'), sortable: true, sortValue: m => m.candidate,
      render: m => <EntityLink page="candidates" id={m.candidateId}>{m.candidate}</EntityLink> },
    { key: 'vacancy', header: t('matches:cols.vacancy'), sortable: true, sortValue: m => m.vacancy,
      render: m => <EntityLink page="vacancies" id={m.vacancyId}>{m.vacancy}</EntityLink> },
    { key: 'stage', header: t('matches:cols.stage'), render: m => {
      const meta = matchStatusMeta(m.status ?? undefined)
      const label = meta?.label ?? m.stage
      return label ? <StatusPill label={label} color={meta?.color ?? m.stageColor} /> : '—'
    } },
    { key: 'contractType', header: t('candidates:matchesView.contractType'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: m => m.contractType || '—' },
  ]

  return (
    <ScopedListTab<ScopedMatchRow>
      queryKey={`${scope}-matches`} endpoint="/matches" paramName={paramName} id={id}
      mapRow={mapRow} columns={columns} searchKeys={['candidate', 'vacancy']}
      searchPlaceholder={t('common:search')} loadingText={t('customers:page.loading')}
      emptyText={t('customers:scopedList.matchesEmpty')} errorText={t('customers:scopedList.loadError')}
      onRowClick={m => m.id != null && openEntity('matches', m.id)}
    />
  )
}
