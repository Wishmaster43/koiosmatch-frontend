/**
 * DepartmentsTable — department list, mirrors CustomersTable/CandidatesTable:
 * only declares columns and hands them to the shared DataTable (sticky header,
 * sorting, selection, hover + empty state). Status renders as a soft-chip
 * StatusPill so the colours match every other entity list.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { MapPin } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import { ac, Avatar } from './departmentParts'
import type { SmDepartmentRow } from '@/types/shiftmanager'

const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }

// Status → soft-chip colour (tenant values; unknown falls back to neutral grey).
const STATUS_COLORS: Record<string, string> = { actief: 'var(--color-success)', inactief: 'var(--color-warning)' }

// Number cell: emphasised when > 0, muted when zero/empty.
const numCell = (n?: number) => (
  <span style={{ fontWeight: (n ?? 0) > 0 ? 600 : 400, color: (n ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n ?? 0}</span>
)

export default function DepartmentsTable({ rows, loading, selectedId, onSelect }: {
  rows: SmDepartmentRow[]
  loading?: boolean
  selectedId?: string | number | null
  onSelect?: (row: SmDepartmentRow) => void
}) {
  const { t } = useTranslation('shiftmanager')

  const columns: Column<SmDepartmentRow>[] = [
    {
      key: 'name', header: t('departmentsPage.cols.department'), sortable: true, sortValue: d => d.name ?? '',
      render: d => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar label={d.name} size={28} radius={6} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{d.name}</span>
        </div>
      ),
    },
    {
      key: 'customer', header: t('departmentsPage.cols.customer'), sortable: true, sortValue: d => d.customer ?? '', nowrap: true,
      render: d => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: ac(d.customer), display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
            {d.customer?.charAt(0)}
          </div>
          <span style={{ color: 'var(--text)' }}>{d.customer || '—'}</span>
        </div>
      ),
    },
    {
      key: 'location', header: t('departmentsPage.cols.location'), sortable: true, sortValue: d => d.location ?? '', nowrap: true,
      render: d => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{d.location || '—'}</span>
        </div>
      ),
    },
    { key: 'employees', header: t('departmentsPage.cols.employees'), align: 'right', nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: d => d.employees ?? 0, render: d => numCell(d.employees) },
    { key: 'shifts',    header: t('departmentsPage.cols.shifts'),    align: 'right', nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: d => d.shifts ?? 0,    render: d => numCell(d.shifts) },
    {
      key: 'status', header: t('departmentsPage.cols.status'), sortable: true, sortValue: d => d.status ?? '',
      render: d => d.status
        ? <StatusPill label={d.status} color={STATUS_COLORS[d.status.toLowerCase()]} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      loading={loading}
      emptyText={t('departmentsPage.empty')}
      stickyHeader
    />
  )
}
