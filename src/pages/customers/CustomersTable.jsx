import { useTranslation } from 'react-i18next'
import DataTable from '../../components/ui/DataTable'
import Avatar from '../../components/ui/Avatar'
import StatusPill from '../../components/ui/StatusPill'

const mutedCell = { color: 'var(--text-muted)', fontSize: 12 }

/**
 * CustomersTable — customer list, mirrors CandidatesTable: only declares columns,
 * the generic DataTable handles rendering/sorting/selection/empty states. Status
 * label + colour come from the tenant lookup via `statusMeta` (never hardcoded).
 */
export default function CustomersTable({
  rows, loading, selectedId, onSelect, statusMeta,
  selectable = false, selectedIds, onToggleRow, onToggleAll,
  stickyHeader = false,
}) {
  const { t } = useTranslation('customers')

  const columns = [
    {
      key: 'name', header: t('cols.name'), sortable: true, sortValue: c => c.name,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={c.initials} size={26} soft />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
        </div>
      ),
    },
    { key: 'debtorNumber', header: t('cols.debtorNumber'), nowrap: true, cellStyle: { ...mutedCell, fontFamily: 'var(--font-mono, monospace)' }, sortable: true, sortValue: c => c.debtorNumber, render: c => c.debtorNumber || '—' },
    {
      key: 'status', header: t('cols.status'), sortable: true, sortValue: c => c.status,
      render: c => {
        const m = statusMeta(c.status)
        return <StatusPill label={c.statusLabel ?? m.label} color={c.statusColor ?? m.color} />
      },
    },
    {
      key: 'accountManager', header: t('cols.accountManager'), sortable: true, sortValue: c => c.owner,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {c.owner && <Avatar initials={c.ownerInitials} size={20} color={c.ownerColor} />}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.owner || '—'}</span>
        </div>
      ),
    },
    { key: 'industry',    header: t('cols.industry'),    nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.industry, render: c => c.industry || '—' },
    { key: 'locations',   header: t('cols.locations'),   nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.locationsCount,   render: c => c.locationsCount },
    { key: 'departments', header: t('cols.departments'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.departmentsCount, render: c => c.departmentsCount },
    { key: 'contacts',    header: t('cols.contacts'),    nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.contactsCount,    render: c => c.contactsCount },
    { key: 'openVacancies', header: t('cols.openVacancies'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.openVacanciesCount, render: c => c.openVacanciesCount },
    { key: 'city',        header: t('cols.city'),        nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.city, render: c => c.city || '—' },
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
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      stickyHeader={stickyHeader}
    />
  )
}
