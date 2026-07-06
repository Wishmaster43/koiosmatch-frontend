/**
 * LocationsTable — location list, mirrors CustomersTable/DepartmentsTable: only
 * declares columns and hands them to the shared DataTable (sticky header,
 * sorting, selection, empty state). Status is a soft-chip StatusPill so the
 * colours match every other entity list.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { MapPin } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import { ac, Avatar } from './locationParts'
import type { SmLocationRow } from '@/types/shiftmanager'

const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }

// Status → soft-chip colour (tenant values; unknown falls back to neutral grey).
const STATUS_COLORS: Record<string, string> = {
  actief: 'var(--color-success)', active: 'var(--color-success)', inactief: 'var(--color-warning)',
}

// Small department chip (name pill), matching the soft-chip convention.
const deptChip = (label: string) => (
  <span key={label} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--hover-bg)',
    border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
)

export default function LocationsTable({ rows, loading, selectedId, onSelect }: {
  rows: SmLocationRow[]
  loading?: boolean
  selectedId?: string | number | null
  onSelect?: (row: SmLocationRow) => void
}) {
  const { t } = useTranslation('shiftmanager')

  const columns: Column<SmLocationRow>[] = [
    {
      key: 'name', header: t('locationsPage.cols.location'), sortable: true, sortValue: l => l.name ?? '',
      render: l => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar label={l.name} size={30} />
          <div>
            <div style={{ fontWeight: 500, color: 'var(--text)' }}>{l.name}</div>
            {l.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.address}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'customer', header: t('locationsPage.cols.customer'), sortable: true, sortValue: l => l.customer ?? '', nowrap: true,
      render: l => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: ac(l.customer), display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
            {l.customer?.charAt(0)}
          </div>
          <span style={{ color: 'var(--text)' }}>{l.customer || '—'}</span>
        </div>
      ),
    },
    {
      key: 'city', header: t('locationsPage.cols.city'), sortable: true, sortValue: l => l.city ?? '', nowrap: true,
      render: l => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{l.city || '—'}</span>
        </div>
      ),
    },
    {
      key: 'departments', header: t('locationsPage.cols.departments'), sortable: true, sortValue: l => (l.departments ?? []).length,
      render: l => {
        const deps = l.departments ?? []
        if (deps.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{deps.length}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {deps.slice(0, 2).map(deptChip)}
              {deps.length > 2 && deptChip(`+${deps.length - 2}`)}
            </div>
          </div>
        )
      },
    },
    {
      key: 'shifts', header: t('locationsPage.cols.shifts'), align: 'right', nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: l => l.shifts ?? 0,
      render: l => <span style={{ fontWeight: (l.shifts ?? 0) > 0 ? 600 : 400, color: (l.shifts ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{l.shifts ?? 0}</span>,
    },
    {
      key: 'status', header: t('locationsPage.cols.status'), sortable: true, sortValue: l => l.status ?? '',
      render: l => l.status
        ? <StatusPill label={l.status} color={STATUS_COLORS[l.status.toLowerCase()] ?? '#9CA3AF'} />
        : <span style={{ color: 'var(--text-muted)' }}>{t('locationsPage.statusUnknown')}</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      loading={loading}
      emptyText={t('locationsPage.empty')}
      stickyHeader
    />
  )
}
