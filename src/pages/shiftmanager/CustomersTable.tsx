import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import DataTable from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import Avatar from '../../components/ui/Avatar'
import StatusPill from '../../components/ui/StatusPill'

// Mapped SM customer row (camelCase, ready for the table).
interface SmCustomerRow {
  id?: string | number
  name?: string
  initials?: string
  debtorNumber?: string
  status?: string
  accountManager?: string
  amInitials?: string
  locations?: Array<{ departments?: unknown[] }>
  contacts?: unknown[]
  city?: string
  [k: string]: unknown
}

const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }

const STATUS_COLORS: Record<string, string> = {
  actief:     'var(--color-success)',
  prospect:   'var(--color-secondary)',
  inactief:   'var(--color-warning)',
  geblokkeerd:'var(--color-danger)',
}

const deptCount = (c: SmCustomerRow) => (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)

interface CustomersTableProps {
  rows: SmCustomerRow[]
  loading?: boolean
  selectedId?: string | number | null
  onSelect?: (row: SmCustomerRow) => void
}

/**
 * CustomersTable — customer list, mirrors CandidatesTable: only declares columns,
 * the generic DataTable handles rendering/sorting/selection/empty states.
 */
export default function CustomersTable({ rows, loading, selectedId, onSelect }: CustomersTableProps) {
  const { t } = useTranslation('customers')

  const columns: Column<SmCustomerRow>[] = [
    {
      key: 'name', header: t('cols.name'), sortable: true, sortValue: c => c.name ?? '',
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={c.initials} size={26} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
        </div>
      ),
    },
    { key: 'debtorNumber', header: t('cols.debtorNumber'), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.debtorNumber ?? '', render: c => c.debtorNumber || '—' },
    {
      key: 'status', header: t('cols.status'), sortable: true, sortValue: c => c.status ?? '',
      render: c => <StatusPill label={t(`status.${c.status}`, c.status ?? '')} color={STATUS_COLORS[c.status ?? ''] ?? '#9CA3AF'} />,
    },
    {
      key: 'accountManager', header: t('cols.accountManager'), sortable: true, sortValue: c => c.accountManager ?? '',
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {c.accountManager && <Avatar initials={c.amInitials} size={20} />}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.accountManager || '—'}</span>
        </div>
      ),
    },
    { key: 'locations',   header: t('cols.locations'),   nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => (c.locations ?? []).length, render: c => (c.locations ?? []).length },
    { key: 'departments', header: t('cols.departments'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => deptCount(c),                render: c => deptCount(c) },
    { key: 'contacts',    header: t('cols.contacts'),    nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => (c.contacts ?? []).length,  render: c => (c.contacts ?? []).length },
    { key: 'city',        header: t('cols.city'),        nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.city ?? '', render: c => c.city || '—' },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      loading={loading}
      loadingText={t('page.loading')}
      emptyText={t('page.empty')}
    />
  )
}
