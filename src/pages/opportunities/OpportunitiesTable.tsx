import { useMemo } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '@/lib/datetime'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

interface OpportunitiesTableProps {
  rows: Opportunity[]
  loading?: boolean
  error?: unknown
  onRowClick?: (row: Opportunity) => void
  selectedId?: Id | null
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

// OpportunitiesTable — declares columns only; the shared DataTable owns sorting + states.
export default function OpportunitiesTable({ rows, loading, error, onRowClick, selectedId, stickyHeader = false, scrollParentRef }: OpportunitiesTableProps) {
  const { t } = useTranslation('opportunities')
  const locale = useLocale()
  const { formatDate } = useDateFormat()

  // Locale-aware EUR formatter (no decimals) for the value column.
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    [locale],
  )

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: t('cols.title'), sortable: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={r.initials} size={24} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span>
        </span>
      ) },
    { key: 'client', header: t('cols.client'), sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'stage',  header: t('cols.stage'),
      render: r => r.stage
        ? <StatusPill label={r.stage} color={r.stageColor} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'value',  header: t('cols.value'), align: 'right', sortable: true, sortValue: r => r.value ?? -1,
      render: r => r.value == null
        ? <span style={{ color: 'var(--text-muted)' }}>—</span>
        : <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{money.format(r.value)}</span> },
    { key: 'owner',  header: t('cols.owner'), sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'date',   header: t('cols.date'),  sortable: true, sortValue: r => r.date || '',
      render: r => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(r.date)}</span> },
  ]

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <DataTable columns={columns} rows={rows} loading={loading}
        onRowClick={onRowClick} selectedId={selectedId}
        loadingText={t('loading')} emptyText={error ? t('error') : t('empty')}
        stickyHeader={stickyHeader} scrollParentRef={scrollParentRef} />
    </div>
  )
}
