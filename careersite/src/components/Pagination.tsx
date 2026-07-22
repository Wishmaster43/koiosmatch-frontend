import { strings } from '../strings'

interface PaginationProps {
  currentPage: number
  lastPage: number
  onPageChange: (page: number) => void
}

// Simple prev/next pager — enough for a public vacancy list; no page-number jump list.
export function Pagination({ currentPage, lastPage, onPageChange }: PaginationProps) {
  if (lastPage <= 1) return null

  return (
    <nav className="pagination" aria-label={strings.list.pagination.pageOf(currentPage, lastPage)}>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        {strings.list.pagination.previous}
      </button>
      <span className="pagination__label">{strings.list.pagination.pageOf(currentPage, lastPage)}</span>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= lastPage}
      >
        {strings.list.pagination.next}
      </button>
    </nav>
  )
}
