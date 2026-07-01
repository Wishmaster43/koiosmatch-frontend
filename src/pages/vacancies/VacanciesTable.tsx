import { useMemo } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import { useDateFormat } from '@/lib/datetime'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

const mutedCell = { color: 'var(--text-muted)', fontSize: 12 }

// Soft horizontal count bar (Leads / Applications) — fill is relative to the
// column max so a busy vacancy reads at a glance. Number stays legible on top.
function CountBar({ value = 0, max = 1, color = 'var(--color-primary)' }: { value?: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ position: 'relative', minWidth: 84, height: 22, borderRadius: 6,
      background: 'var(--hover-bg)', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', insetBlock: 0, left: 0, width: `${pct}%`, background: `${color}26` }} />
      <span style={{ position: 'relative', fontSize: 11, fontWeight: 600, color: 'var(--text)', padding: '0 8px' }}>
        {value}
      </span>
    </div>
  )
}

interface VacanciesTableProps {
  rows: Vacancy[]
  loading?: boolean
  selectedId?: Id | null
  onSelect?: (row: Vacancy) => void
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

/**
 * VacanciesTable — vacancy list as a loose component. Only declares the columns;
 * sorting, selection and the loading/empty states live in the shared DataTable.
 * Mirrors CandidatesTable / ApplicationsTable.
 */
export default function VacanciesTable({ rows, loading, selectedId, onSelect, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef }: VacanciesTableProps) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat()
  const { statusMeta } = useVacancyLookups()

  // Column maxima so the Leads/Applications bars are relative to the page.
  const maxLeads = useMemo(() => Math.max(1, ...rows.map(r => r.leadsCount || 0)), [rows])
  const maxApps  = useMemo(() => Math.max(1, ...rows.map(r => r.applicationsCount || 0)), [rows])

  const columns: Column<Vacancy>[] = [
    {
      key: 'title', header: t('columns.title'), sortable: true, sortValue: r => r.title,
      render: r => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span>,
    },
    {
      key: 'code', header: t('columns.code'), nowrap: true, sortable: true, sortValue: r => r.code,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' },
      render: r => r.code || '—',
    },
    {
      key: 'status', header: t('columns.status'), sortable: true, sortValue: r => r.statusLabel || (r.statusValue ?? ''),
      render: r => {
        // Prefer the resolved label/colour from the row; fall back to the lookup.
        const m = r.statusLabel ? { label: r.statusLabel, color: r.statusColor } : statusMeta(r.statusValue != null ? String(r.statusValue) : null)
        return m.label ? <StatusPill label={m.label} color={m.color} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>
      },
    },
    {
      key: 'leads', header: t('columns.leads'), align: 'left', sortable: true, sortValue: r => r.leadsCount,
      render: r => <CountBar value={r.leadsCount} max={maxLeads} color="var(--color-warning)" />,
    },
    {
      key: 'applications', header: t('columns.applications'), sortable: true, sortValue: r => r.applicationsCount,
      render: r => <CountBar value={r.applicationsCount} max={maxApps} color="var(--color-primary)" />,
    },
    {
      key: 'published', header: t('columns.published'), nowrap: true, sortable: true, sortValue: r => (r.published ? 1 : 0),
      render: r => r.published
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
            padding: '3px 8px', borderRadius: 99, background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <Globe size={12} /> {t('publishedState.yes')}
          </span>
        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('publishedState.no')}</span>,
    },
    {
      key: 'owner', header: t('columns.owner'), sortable: true, sortValue: r => r.owner?.name ?? '',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {r.owner?.name && <Avatar initials={r.owner.initials} size={22} color={r.owner.color} />}
          <span style={mutedCell}>{r.owner?.name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'client', header: t('columns.client'), nowrap: true, sortable: true, sortValue: r => r.clientName,
      render: r => r.clientName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={(r.clientName[0] ?? '?').toUpperCase()} size={20} soft />
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{r.clientName}</span>
        </div>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'createdAt', header: t('columns.createdAt'), nowrap: true, cellStyle: mutedCell,
      sortable: true, sortValue: r => r.createdSort ?? r.created, render: r => formatDate(r.created),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      loading={loading}
      loadingText={t('page.loading')}
      emptyText={t('page.empty')}
      stickyHeader={stickyHeader}
      scrollParentRef={scrollParentRef}
    />
  )
}
