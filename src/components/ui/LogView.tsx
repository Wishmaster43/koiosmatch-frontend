/**
 * LogView — the shared surface for every in/out log (audit, email, WhatsApp, API).
 * Wraps the shared DataTable with a toolbar (count + CSV export) and registers the
 * log's filters in the right panel. The parent owns fetching + filter state and
 * passes already-filtered rows in; LogView never knows about a specific channel.
 * Graceful: shows an empty state until the backend feed exists.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import DataTable from '@/components/ui/DataTable'
import type { Column, RowId } from '@/components/ui/DataTable'
import { escapeCsvCell } from '@/lib/csv'

export interface LogExportCol<Row> { header: string; value: (row: Row) => string }

interface LogViewProps<Row> {
  rows: Row[]
  columns: Column<Row>[]
  loading?: boolean
  error?: string | null
  filterKey: string
  filterGroups: unknown[]
  getRowId?: (row: Row) => RowId
  onRowClick?: (row: Row) => void
  totalCount?: number
  exportName: string
  exportColumns: LogExportCol<Row>[]
  emptyText?: string
}

export default function LogView<Row>({
  rows, columns, loading, error, filterKey, filterGroups, getRowId, onRowClick,
  totalCount, exportName, exportColumns, emptyText,
}: LogViewProps<Row>) {
  const { t } = useTranslation('settings')
  const { registerFilters, unregisterFilters } = useRightPanel() as {
    registerFilters: (id: string, groups: unknown) => void; unregisterFilters: (id: string) => void
  }

  // Register this log's right-panel filters while mounted.
  useEffect(() => {
    registerFilters(filterKey, filterGroups)
    return () => unregisterFilters(filterKey)
  }, [filterKey, filterGroups, registerFilters, unregisterFilters])

  // Export the shown rows to CSV (UTF-8 BOM for Excel; AVG accountability). Cells
  // are escaped via the shared escapeCsvCell, which also guards against formula
  // injection (a leading =+-@ opened as a live formula in Excel/Sheets — C-14).
  const exportCsv = () => {
    const header = exportColumns.map(c => c.header)
    const body = rows.map(r => exportColumns.map(c => c.value(r)))
    const csv = '﻿' + [header, ...body].map(r => r.map(escapeCsvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar — count + export (search/filters live in the right panel). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? t('audit.loading') : t('audit.countSummary', { shown: rows.length, total: totalCount ?? rows.length })}
        </p>
        <button onClick={exportCsv} disabled={rows.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', fontSize: 12,
            fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
            color: 'var(--text)', cursor: rows.length ? 'pointer' : 'not-allowed', opacity: rows.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
          <Download size={13} /> {t('audit.export')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-bg)',
          // eslint-disable-next-line no-restricted-syntax -- no close-enough warning-contrast token for this alert box border/text; tracked as a token-set follow-up (mirrors KoiosRadar.tsx precedent)
          border: '1px solid #FDE68A', fontSize: 13, color: '#92400E', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
        <DataTable<Row> columns={columns} rows={rows} loading={loading} getRowId={getRowId}
          onRowClick={onRowClick} emptyText={emptyText ?? t('audit.noEntries')} stickyHeader />
      </div>
    </div>
  )
}
