import { useMemo } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '@/lib/datetime'
import DataTable from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import { initialsOf } from '@/lib/initials'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

interface OpportunitiesTableProps {
  rows: Opportunity[]
  loading?: boolean
  error?: unknown
  onRowClick?: (row: Opportunity) => void
  selectedId?: Id | null
  valueInHours?: boolean
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

// Calm neutral avatar tint — colour carries no meaning here, so all bubbles match
// (mirrors the candidate table's default; per-initial colours would be noise).
const NEUTRAL_AVATAR = '#9CA3AF'

// OpportunitiesTable — declares columns only; the shared DataTable owns sorting + states.
export default function OpportunitiesTable({ rows, loading, error, onRowClick, selectedId, valueInHours = false, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef }: OpportunitiesTableProps) {
  const { t } = useTranslation('opportunities')
  const locale = useLocale()
  const { formatDate } = useDateFormat()

  // Locale-aware EUR formatter (no decimals) for the value column.
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    [locale],
  )

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: t('cols.title'), sortable: true, sticky: true, width: 220,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={r.initials} size={24} color={NEUTRAL_AVATAR} soft />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span>
        </span>
      ) },
    { key: 'client', header: t('cols.client'), sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'stage',  header: t('cols.stage'), sortable: true, sortValue: r => r.stage,
      // Shared soft-chip (C-CHIP) — identical look across every entity table.
      render: r => r.stage
        ? <SoftChip label={r.stage} color={r.stageColor} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // Value column follows the tenant setting: euro amount or hours.
    { key: 'value',  header: t('cols.value'), align: 'right', sortable: true,
      sortValue: r => (valueInHours ? r.hours : r.value) ?? -1,
      render: r => {
        const v = valueInHours ? r.hours : r.value
        if (v == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {valueInHours ? t('cols.hoursValue', { count: v }) : money.format(v)}
        </span>
      } },
    { key: 'owner',  header: t('cols.owner'), sortable: true, sortValue: r => r.owner,
      render: r => r.owner
        ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar initials={initialsOf(r.owner)} size={18} color={NEUTRAL_AVATAR} soft />
            <span style={{ color: 'var(--text)', fontSize: 12 }}>{r.owner}</span>
          </span>
        )
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'date',   header: t('cols.date'),  sortable: true, sortValue: r => r.date || '',
      render: r => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(r.date)}</span> },
  ]

  // No surface-card wrapper: the DataTable renders directly on the page background
  // so the transparent rows + the sticky column's var(--bg) match (mirrors the
  // candidate table). A wrapper with a different bg makes the sticky column mismatch.
  return (
    <DataTable columns={columns} rows={rows} loading={loading}
      onRowClick={onRowClick} selectedId={selectedId}
      selectable={selectable} selectedIds={selectedIds} onToggleRow={onToggleRow} onToggleAll={onToggleAll}
      loadingText={t('loading')} emptyText={error ? t('error') : t('empty')}
      stickyHeader={stickyHeader} scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'date', dir: 'desc' }} />
  )
}
