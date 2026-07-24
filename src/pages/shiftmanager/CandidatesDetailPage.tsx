/**
 * CandidatesDetailPage — ShiftManager candidates list, restyled onto the native
 * candidate-page blueprint (§3A/§4): a 9-slot KPI row, one toolbar row with the
 * shared HeaderSearch on the left, then the table + pagination. No reports-panel
 * chrome (title/border) around the table — this page reads like the native
 * Kandidaten page. The table stays server-paginated (useSmCandidatesList); the
 * KPI counts come from the full set (useReportCandidates) so they are
 * server-wide, not per-page. Status cards/donut filter the table in place;
 * attention/new/no-shows/cancellations/ending-soon open the rich drill-down.
 */
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useKpiSettings } from '@/lib/useKpiSettings'
import { useSmCandidatesList } from './hooks/useSmCandidatesList'
import { useReportCandidates } from '@/components/reports/useReportCandidates'
import SmCandidatesInsightsRow from './SmCandidatesInsightsRow'
import SmCandidatesTable from './SmCandidatesTable'
import DrillDownDrawer from '@/components/reports/DrillDownDrawer'
import CandidateDetailDrawer from '@/components/reports/CandidateDetailDrawer'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import PaginationBar from '@/components/ui/PaginationBar'
import { filterSmCandidates } from './data/smCandidateFilters'
import { featureNamesOf, registrationYearOf } from './data/smCandidateFields'
import { useRightPanel } from '@/context/RightPanelContext'
import type { ReportCandidate } from '@/types/reports'

export default function CandidatesDetailPage() {
  const { t } = useTranslation('reports')
  const { candidates_per_page } = useKpiSettings()
  const { candidates, loading, page, pageSize, total, lastPage, setPage, handlePageSizeChange } = useSmCandidatesList()
  // Full set for server-wide KPI counts (independent of the table's page). While
  // loading this is simply empty — the shared InsightsRow has no loading prop, so
  // the donut/cards show zero/"—" until the stats arrive, same as the native page.
  const { candidates: allCandidates } = useReportCandidates(candidates_per_page)

  // Controlled status filter so a KPI/donut click can drive the table.
  const [statusFilter, setStatusFilter] = useState<Array<string | number>>(['actief'])
  const [search, setSearch] = useState('')
  // Remount-key for HeaderSearch so "wis alle filters" also empties the input
  // (the native CandidatesToolbar idiom — HeaderSearch owns its own text state).
  const [searchEpoch, setSearchEpoch] = useState(0)
  // RightPanel filter axes (jaar/functie/kenmerken) — restored from the old
  // reports table (its registerFilters left the page with the restyle; the native
  // blueprint keeps the right filter drawer, so these come back page-level).
  const { registerFilters, unregisterFilters } = useRightPanel()
  const [selectedYears, setSelectedYears] = useState<Array<string | number>>([])
  const [selectedPositions, setSelectedPositions] = useState<Array<string | number>>([])
  const [selectedFeatures, setSelectedFeatures] = useState<Array<string | number>>([])
  // Attention/new/no-shows/… cards open the rich drill-down with their own filtered subset.
  const [drill, setDrill] = useState<{ title: string; candidates: ReportCandidate[] } | null>(null)
  // Row click opens the rich per-candidate drill-down (Danny 24-07: "ik mis de
  // drill down" — the old reports table opened this drawer; restored blueprint-side).
  const [detail, setDetail] = useState<ReportCandidate | null>(null)

  // Single-value status toggle — clicking the same status again clears it (mirrors
  // the native candidates page's donut/KPI pick-one behaviour).
  const pickStatus = (status: string) =>
    setStatusFilter(prev => (prev.length === 1 && String(prev[0]).toLowerCase() === status) ? [] : [status])

  // Client-side refine over the loaded page only: useSmCandidatesList has no
  // server-side search/status param yet (see smCandidateFilters' doc comment) —
  // a full cross-page filter needs a backend query param.
  const filtered = useMemo(() => {
    const base = filterSmCandidates(candidates, statusFilter, search)
    return base.filter(c => {
      if (selectedYears.length && !selectedYears.includes(registrationYearOf(c) as number)) return false
      if (selectedPositions.length && !selectedPositions.includes(c.position as string)) return false
      if (selectedFeatures.length) {
        const names = featureNamesOf(c)
        if (!selectedFeatures.some(f => names.includes(f as string))) return false
      }
      return true
    })
  }, [candidates, statusFilter, search, selectedYears, selectedPositions, selectedFeatures])

  // Filter options come from the FULL set so an axis never hides its own values.
  const toggle = (setter: (fn: (prev: Array<string | number>) => Array<string | number>) => void) => (value: string | number) =>
    setter(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  const filterGroups = useMemo(() => {
    const src = allCandidates.length ? allCandidates : candidates
    const years = [...new Set(src.map(registrationYearOf).filter((y): y is number => y != null))].sort((a, b) => b - a)
    const positions = [...new Set(src.map(c => c.position).filter((x): x is string => Boolean(x)))].sort()
    const features = [...new Set(src.flatMap(featureNamesOf))].sort()
    return [
      { key: 'jaar', label: t('candidates.filters.year'), options: years.map(y => ({ value: y, label: String(y) })), selected: selectedYears, onToggle: toggle(setSelectedYears) },
      { key: 'functie', label: t('candidates.filters.position'), options: positions.map(p => ({ value: p, label: p })), selected: selectedPositions, onToggle: toggle(setSelectedPositions) },
      { key: 'kenmerken', label: t('candidates.filters.features'), options: features.map(k => ({ value: k, label: k })), selected: selectedFeatures, onToggle: toggle(setSelectedFeatures) },
    ]
  }, [t, allCandidates, candidates, selectedYears, selectedPositions, selectedFeatures])
  useEffect(() => {
    registerFilters('candidates-table', filterGroups)
    return () => unregisterFilters('candidates-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  // "Wis alle filters" — shows only while the view is NARROWED (Danny 24-07:
  // an empty status pick = show everything = nothing filtered). The initial
  // 'actief' preselection honestly counts as a filter; clearing shows all.
  const anyFilterActive = Boolean(search) || selectedYears.length > 0 || selectedPositions.length > 0
    || selectedFeatures.length > 0 || statusFilter.length > 0
  const clearFilters = () => {
    setStatusFilter([]); setSearch(''); setSearchEpoch(e => e + 1)
    setSelectedYears([]); setSelectedPositions([]); setSelectedFeatures([])
  }

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* KPI row — status donut/cards filter the table, the rest drill down */}
      <SmCandidatesInsightsRow
        candidates={allCandidates}
        statusFilter={statusFilter}
        onStatusPick={pickStatus}
        onStatusClear={() => setStatusFilter([])}
        onDrillDown={(title, items) => setDrill({ title, candidates: items })}
      />

      {/* Toolbar row — the one shared spacing spec (§4): identical KPI-row→button
          gap on every page. Search on the left, no other chrome. */}
      <div style={{ padding: '0 24px 12px', minHeight: 36, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <HeaderSearch key={searchEpoch} onSearch={setSearch} placeholder={t('candidates.search')} width={300} />
        <ClearFiltersButton active={anyFilterActive} onClear={clearFilters} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 24px 16px', overflow: 'auto' }}>
        <SmCandidatesTable rows={filtered} loading={loading} onRowClick={setDetail} />
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
      {detail && (
        <CandidateDetailDrawer candidate={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
