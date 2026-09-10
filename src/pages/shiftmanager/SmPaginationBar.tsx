/**
 * SmPaginationBar — thin wrapper around the shared PaginationBar that binds
 * the page-size change to the "reset to page 1" behaviour every Shiftmanager
 * list page repeats (DRY round 11, SHIFTMANAGER — the list-tail consolidation).
 */
import PaginationBar from '@/components/ui/PaginationBar'

export function SmPaginationBar({ page, totalPages, totalRows, pageSize, onPageChange, setPage, setPageSize }: {
  page: number
  totalPages: number
  totalRows: number
  pageSize: number
  onPageChange: (page: number) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}) {
  return (
    <PaginationBar page={page} totalPages={totalPages} totalRows={totalRows} pageSize={pageSize}
      onPageChange={onPageChange} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
  )
}
