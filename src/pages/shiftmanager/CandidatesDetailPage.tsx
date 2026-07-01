/**
 * CandidatesDetailPage — paginated detail list of all ShiftManager candidates.
 * Renders CandidatesTable + PaginationBar; the data layer lives in useSmCandidatesList.
 */
import { useSmCandidatesList } from './hooks/useSmCandidatesList'
import CandidatesTable from '@/components/reports/CandidatesTable'
import PaginationBar   from '@/components/ui/PaginationBar'

export default function CandidatesDetailPage() {
  const { candidates, loading, page, pageSize, total, lastPage, setPage, handlePageSizeChange } = useSmCandidatesList()

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CandidatesTable candidates={candidates} loading={loading} />
      </div>
      <PaginationBar
        page={page}
        totalPages={lastPage}
        totalRows={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
