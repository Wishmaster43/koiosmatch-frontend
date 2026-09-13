/**
 * ReportPagedTableShell — ReportTableShell plus the standard PaginationBar
 * footer, wired to a useReportPaging-shaped paging state. Lives OUTSIDE
 * reportTableChrome.tsx on purpose: PaginationBar reaches lib/formatters and so
 * lib/datetime and the i18n singleton, which the eagerly-loaded chrome module
 * must never pull in (DATETIME-IMPORT-LES) — only the leaf table files that
 * already import PaginationBar themselves pull this wrapper in (DRY round,
 * jscpd pair on DepartmentsTable/LocationsTable).
 */
import type { ReactNode } from 'react'
import PaginationBar from '@/components/ui/PaginationBar'
import { ReportTableShell } from './reportTableChrome'
import type { ReportTableColumn } from './reportTableChrome'
import type { SortState } from '@/types/reports'

export function ReportPagedTableShell<T extends { id?: string | number }>({
  loading, loadingLabel, empty, emptyLabel,
  columns, sort, onSort,
  rows, renderRow,
  page, totalPages, totalRows, pageSize, onPageChange, onPageSizeChange,
  drawer,
}: {
  loading: boolean
  loadingLabel: string
  empty: boolean
  emptyLabel: string
  columns: ReportTableColumn[]
  sort: SortState
  onSort: (key: string) => void
  rows: T[]
  renderRow: (row: T, index: number) => ReactNode
  page: number
  totalPages: number
  totalRows: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  drawer?: ReactNode
}) {
  return (
    <ReportTableShell
      loading={loading} loadingLabel={loadingLabel} empty={empty} emptyLabel={emptyLabel}
      columns={columns} sort={sort} onSort={onSort} rows={rows} renderRow={renderRow}
      pagination={
        <PaginationBar page={page} totalPages={totalPages} totalRows={totalRows}
          pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      }
      drawer={drawer}
    />
  )
}
