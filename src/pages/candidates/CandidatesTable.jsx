import { useTranslation } from 'react-i18next'
import DataTable from '../../components/ui/DataTable'
import Avatar from '../../components/ui/Avatar'
import StatusPill from '../../components/ui/StatusPill'
import { useDateFormat } from '../../lib/datetime'
import { useLookups } from '../../context/LookupsContext'

const mutedCell = { color: 'var(--text-muted)', fontSize: 12 }

/**
 * CandidatesTable — candidate list as a loose component.
 *
 * Only declares the columns; rendering, selection and the loading/empty states
 * live in the generic DataTable. Reuse that table for other entity lists with
 * their own column set.
 */
export default function CandidatesTable({ rows, loading, selectedId, onSelect }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const { funnelTypes, funnelMeta, statusMeta, typeMeta } = useLookups()
  // Sort the funnel column by lifecycle order (prospect → alumni), not alphabetically.
  const funnelOrder = Object.fromEntries(funnelTypes.map((f, i) => [f.value, i]))

  const columns = [
    {
      key: 'name', header: t('columns.name'), sortable: true, sortValue: c => c.name,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={c.initials} size={26} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
        </div>
      ),
    },
    {
      key: 'status', header: t('columns.status'), sortable: true, sortValue: c => statusMeta(c.status).label,
      render: c => { const m = statusMeta(c.status); return <StatusPill label={m.label} color={m.color} /> },
    },
    {
      key: 'funnelType', header: t('columns.funnelType'), nowrap: true,
      sortable: true, sortValue: c => funnelOrder[c.stage] ?? 99,
      render: c => {
        if (!c.stage) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const m = funnelMeta(c.stage)
        return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
          background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span>
      },
    },
    {
      key: 'title', header: t('columns.function'), nowrap: true, cellStyle: { color: 'var(--text)', fontSize: 12 },
      sortable: true, sortValue: c => c.title,
      render: c => c.title || '—',
    },
    {
      key: 'candidateType', header: t('columns.employmentType'), nowrap: true,
      sortValue: c => (c.candidateTypes ?? [])[0] ?? '', sortable: true,
      render: c => {
        const list = c.candidateTypes ?? []
        if (list.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const shown = list.slice(0, 2)
        return (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {shown.map(v => { const m = typeMeta(v); return (
              <span key={v} style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
                background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span>
            )})}
            {list.length > shown.length && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{list.length - shown.length}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'owner', header: t('columns.owner'), sortable: true, sortValue: c => c.owner,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {c.ownerInitials !== '?' && <Avatar initials={c.ownerInitials} size={20} />}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.owner || '—'}</span>
        </div>
      ),
    },
    { key: 'lastContact', header: t('columns.lastContact'), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.lastContactAt, render: c => formatDate(c.lastContactAt) },
    { key: 'city',        header: t('columns.city'),        nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.city,     render: c => c.city || '—' },
    { key: 'province',    header: t('columns.province'),    nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.province, render: c => c.province || '—' },
    { key: 'created',     header: t('columns.createdAt'),   nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.createdSort ?? c.created, render: c => formatDate(c.created) },
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
