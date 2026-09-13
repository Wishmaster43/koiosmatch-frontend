/**
 * SmTableSection — the shared table+pagination tail of every Shiftmanager mirror
 * page (Contacts/Departments/Locations): the scroll wrapper, the SmLoadErrorBanner
 * and the SmPaginationBar, wrapped around whatever table the caller renders as
 * children (DRY round P4 — the three pages repeated this shell verbatim).
 */
import type { ReactNode } from 'react'
import { SmLoadErrorBanner } from './SmLoadErrorBanner'
import { SmPaginationBar } from './SmPaginationBar'

interface SmTableSectionProps {
  // Table content — each page passes its own <XTable> so this stays table-agnostic.
  children: ReactNode
  isError: boolean
  onRetry: () => unknown
  page: number
  totalPages: number
  totalRows: number
  pageSize: number
  onPageChange: (page: number) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

// Renders the scrollable table area (error banner + table) followed by the shared pagination bar.
export function SmTableSection({ children, isError, onRetry, page, totalPages, totalRows, pageSize, onPageChange, setPage, setPageSize }: SmTableSectionProps) {
  return (
    <>
      {/* Table — shared DataTable (sticky header, sorting, soft-chip colours) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
        {/* Error state (§3): the mirror fetch failed, say so and offer a retry. */}
        <SmLoadErrorBanner isError={isError} onRetry={onRetry} />
        {children}
      </div>

      <SmPaginationBar page={page} totalPages={totalPages} totalRows={totalRows} pageSize={pageSize}
        onPageChange={onPageChange} setPage={setPage} setPageSize={setPageSize} />
    </>
  )
}
