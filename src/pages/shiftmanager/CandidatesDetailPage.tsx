/**
 * CandidatesDetailPage — paginated detail list of all ShiftManager candidates,
 * with a KPI row on top (§3A blueprint). The table stays server-paginated
 * (useSmCandidatesList); the KPI counts come from the full set (useReportCandidates)
 * so they are server-wide, not per-page. Status cards filter the table in place;
 * Attention/New open the rich drill-down.
 */
import { useState } from 'react'
import { useKpiSettings } from '@/lib/useKpiSettings'
import { useSmCandidatesList } from './hooks/useSmCandidatesList'
import { useReportCandidates } from '@/components/reports/useReportCandidates'
import CandidatesKpiRow from '@/components/reports/CandidatesKpiRow'
import CandidatesTable  from '@/components/reports/CandidatesTable'
import DrillDownDrawer  from '@/components/reports/DrillDownDrawer'
import PaginationBar    from '@/components/ui/PaginationBar'
import type { ReportCandidate } from '@/types/reports'

export default function CandidatesDetailPage() {
  const { candidates_per_page } = useKpiSettings()
  const { candidates, loading, page, pageSize, total, lastPage, setPage, handlePageSizeChange } = useSmCandidatesList()
  // Full set for server-wide KPI counts (independent of the table's page).
  const { candidates: allCandidates, loading: statsLoading } = useReportCandidates(candidates_per_page)
  // Controlled status filter so a KPI status card can drive the table.
  const [statusFilter, setStatusFilter] = useState<Array<string | number>>(['actief'])
  // Attention/New cards open the rich drill-down with their own filtered subset.
  const [drill, setDrill] = useState<{ title: string; candidates: ReportCandidate[] } | null>(null)

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* KPI row — status cards filter the table, attention/new drill down */}
      <CandidatesKpiRow
        candidates={allCandidates}
        loading={statsLoading}
        onStatusFilter={s => setStatusFilter([s])}
        onDrillDown={(title, items) => setDrill({ title, candidates: items })}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CandidatesTable candidates={candidates} loading={loading}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
      </div>
      <PaginationBar
        page={page}
        totalPages={lastPage}
        totalRows={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />

      {drill && (
        <DrillDownDrawer title={drill.title} candidates={drill.candidates} onClose={() => setDrill(null)} />
      )}
    </div>
  )
}
