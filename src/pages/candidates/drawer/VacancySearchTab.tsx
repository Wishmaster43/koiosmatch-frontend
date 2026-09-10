/**
 * VacancySearchTab — Match-zoeker ("Match finder") phase 1b (candidate side):
 * the MIRROR of vacancies/drawer/CandidateSearchTab — the candidate's own
 * geocoded home location as the search origin, OPEN vacancies within a radius
 * plotted on the shared RadiusMap + listed side by side (§3A blueprint: thin
 * container, all data via the hook, one small component per tab).
 */
import type { ReactNode } from 'react'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import GeoSearchShell from '@/components/search/GeoSearchShell'
// audit scalability-3: Leaflet only downloads when this tab actually renders the map —
// the static import used to pull it into the page chunk via the drawer's tab list (§9).
const RadiusMap = lazy(() => import('@/components/map/RadiusMap'))
import GeocodeButton from '@/components/ui/GeocodeButton'
import GeocodeMissingRow from '@/components/drawer/GeocodeMissingRow'
import AddApplicationModal from './AddApplicationModal'
import VacancySearchFilters, { VacancySearchActiveFilters } from './VacancySearchFilters'
import VacancySearchSummaryCard from './VacancySearchSummaryCard'
import type { VacancyDetail, LookupChip } from './VacancySearchSummaryCard'
import VacancySearchResultRow from './VacancySearchResultRow'
import { SearchListBody } from '@/components/drawer/search/SearchListBody'
import { useSearchSelection } from '@/components/drawer/search/useSearchSelection'
import api, { unwrap } from '@/lib/api'
import { useVacancySearch } from '../hooks/useVacancySearch'
import { useFunctions } from '@/lib/useFunctions'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { toCoord } from '@/lib/coords'
import type { Candidate } from '@/types/candidate'

// Snippet length cap (2-3 lines of plain text) — a short teaser, not the full description.
const SNIPPET_MAX_LENGTH = 220

// Wraps its own VacancyLookupsProvider (mirrors applications/drawer/VacancyTab.tsx)
// because that context is only mounted page-scoped around VacanciesPage, not
// around the candidate drawer.
export default function VacancySearchTab({ candidate }: { candidate: Candidate }) {
  return (
    <VacancyLookupsProvider>
      <VacancySearchTabInner candidate={candidate} />
    </VacancyLookupsProvider>
  )
}

// Strip HTML to a short plain-text snippet — tolerant: an empty/unparsable body
// just yields '' (the caller then omits the snippet entirely, never an error wall).
function toSnippet(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return trimmed.length > SNIPPET_MAX_LENGTH ? `${trimmed.slice(0, SNIPPET_MAX_LENGTH)}…` : trimmed
}

// Inner component: rendered inside the local VacancyLookupsProvider so
// useVacancyLookups() (the tenant vacancy-status colours/labels) resolves.
function VacancySearchTabInner({ candidate }: { candidate: Candidate }) {
  const { t } = useTranslation('candidates')
  const { functions: functionOptions } = useFunctions()
  const { statuses: statusOptions, statusMeta } = useVacancyLookups()
  const {
    rows, loading, error, retry, radiusKm, setRadiusKm,
    functions: selectedFunctions, setFunctions, functionNotInLookup,
    statuses: selectedStatuses, setStatuses,
    contractvorm, setContractvorm, contractvormOptions,
    hoursRange, setHoursRange, hoursRangeMax, hasHoursData,
    availableFrom, setAvailableFrom, hasAvailableFromData,
    filtersDirty, resetFilters,
    noLocation,
  } = useVacancySearch(candidate)

  // A row/marker pick now SELECTS a vacancy (summary card) instead of navigating
  // straight away (Danny 23-07, point 5) — shared selection state resets on candidate switch.
  const { selectedId, selectedRow, selectId, clearSelection } = useSearchSelection(candidate.id, rows)

  // "Solliciteren" (Danny 06-08 screenshot): opens AddApplicationModal for THIS
  // candidate with the open panel's vacancy prefilled. Closed on any selection
  // change so browsing prev/next never leaves a stale modal pinned to the old row.
  const [showApply, setShowApply] = useState(false)
  useEffect(() => { setShowApply(false) }, [selectedId])

  // Lazily fetch the description snippet AND the summary-card detail fields
  // (salary/experience/education/seniority, P8-result-cards) for the SELECTED
  // vacancy only, once per selection — abortable so a fast re-select never lets
  // a stale response win. Quiet-404 + tolerant: a failed/empty fetch just omits
  // the extra fields, never an error wall.
  const [description, setDescription] = useState<string | null>(null)
  const [detail, setDetail] = useState<VacancyDetail | null>(null)
  // Resets, then (re)fetches for the newly selected vacancy — see the comment
  // above for the abort/quiet-404 contract this follows.
  useEffect(() => {
    setDescription(null)
    setDetail(null)
    if (selectedId == null) return
    const ctrl = new AbortController()
    api.get(`/vacancies/${selectedId}`, { signal: ctrl.signal, quiet404: true })
      .then(res => {
        const raw = unwrap<Record<string, unknown>>(res)
        const snippet = toSnippet(String(raw?.description ?? ''))
        if (snippet) setDescription(snippet)
        setDetail({
          salaryMin: toCoord(raw?.salary_min),
          salaryMax: toCoord(raw?.salary_max),
          salaryPeriod: typeof raw?.salary_period === 'string' ? raw.salary_period : null,
          experienceMin: toCoord(raw?.experience_min_years),
          experienceMax: toCoord(raw?.experience_max_years),
          education: (raw?.education as LookupChip | null) ?? null,
          seniority: (raw?.seniority as LookupChip | null) ?? null,
        })
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [selectedId])


  // Browse (Danny 05-08, point 3): prev/next through the CURRENT result list,
  // reusing the shared DrillPager anatomy (mirrors LocationDetail/ContactDetail).
  // Disabled at the ends — no cycling, and undefined (never a no-op handler) is
  // what makes DrillPager itself render the button disabled.
  const selectedIndex = rows.findIndex(r => r.id === selectedId)
  const goPrev = selectedIndex > 0 ? () => selectId(rows[selectedIndex - 1].id) : undefined
  const goNext = selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => selectId(rows[selectedIndex + 1].id) : undefined

  const center = { lat: toCoord(candidate.lat) as number, lng: toCoord(candidate.lng) as number }
  const points = rows
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({ id: r.id, lat: r.lat as number, lng: r.lng as number, label: r.title, sub: [r.customer, r.city].filter(Boolean).join(' · ') }))

  // GEOSEARCH-1: the trigger row + the situational chips row are now two
  // separate slots on the shared GeoSearchShell (own component — the tab
  // stays a thin container, §3): every value/setter comes straight from the hook.
  const triggersRow: ReactNode = (
    <VacancySearchFilters
      candidateTitle={candidate.title}
      statusOptions={statusOptions} statuses={selectedStatuses} onStatusesChange={setStatuses}
      functionOptions={functionOptions} functions={selectedFunctions} onFunctionsChange={setFunctions}
      functionNotInLookup={functionNotInLookup}
      contractvormOptions={contractvormOptions} contractvorm={contractvorm} onContractvormChange={setContractvorm}
      hasHoursData={hasHoursData} hoursRange={hoursRange} hoursRangeMax={hoursRangeMax} onHoursRangeChange={setHoursRange}
      hasAvailableFromData={hasAvailableFromData} availableFrom={availableFrom} onAvailableFromChange={setAvailableFrom}
    />
  )
  const chipsRow: ReactNode = (
    <VacancySearchActiveFilters
      hasHoursData={hasHoursData} hoursRange={hoursRange} hoursRangeMax={hoursRangeMax} onHoursRangeChange={setHoursRange}
      hasAvailableFromData={hasAvailableFromData} availableFrom={availableFrom} onAvailableFromChange={setAvailableFrom}
      filtersDirty={filtersDirty} onReset={resetFilters}
    />
  )

  // GEO-DEGRADE-1 (Danny 08-08): an un-geocoded candidate used to blank the WHOLE tab
  // — filters, list and all. Only the map genuinely needs coordinates, so the notice
  // takes the map's place (with the shared geocode trigger) and everything else works;
  // the radius chrome (GeoSearchShell's own `radius` prop) is omitted entirely too —
  // there is nothing to measure a radius from.
  const mapPane: ReactNode = noLocation ? (
    <GeocodeMissingRow message={t('vacancySearch.noLocation')}
      endpoint={`/candidates/${candidate.id}/geocode`} permission="candidates.update"
      disabled={!candidate.address} />
  ) : (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
      <RadiusMap points={points} center={center} radiusKm={radiusKm} height="100%"
      centerMarker={{ label: candidate.name ?? '', sub: t('vacancySearch.centerHome') }}
      // The candidate's home pin stays fixed — re-centring by clicking the map must
      // never move the search origin away from the candidate's own address.
      onCenterChange={() => {}}
      onPickPoint={selectId} />
    </Suspense>
  )

  // Compact summary card for the SELECTED vacancy — shown before navigating away,
  // never an immediate jump (Danny 23-07, point 5). Extracted to VacancySearchSummaryCard.
  const summaryCard: ReactNode = selectedRow && (
    <VacancySearchSummaryCard
      selectedRow={selectedRow} selectedIndex={selectedIndex} total={rows.length}
      goPrev={goPrev} goNext={goNext} onClose={() => clearSelection()} onApply={() => setShowApply(true)}
      description={description} detail={detail} statusMeta={statusMeta}
    />
  )

  // Four explicit states: loading, error (+ retry), empty, success list — delegated to shared component.
  const listBody: ReactNode = (
    <SearchListBody
      loading={loading}
      error={error}
      rows={rows}
      onRetry={retry}
      noLocation={noLocation}
      emptyMessage={t('vacancySearch.empty')}
      noLocationMessage={t('vacancySearch.noLocationResults')}
      noLocationButton={
        <GeocodeButton endpoint={`/candidates/${candidate.id}/geocode`} permission="candidates.update"
          variant="row" disabled={!candidate.address} />
      }
      selectedId={selectedId}
      onSelect={selectId}
      renderRow={(r, isSelected) => (
        <VacancySearchResultRow key={String(r.id)} row={r} isSelected={isSelected} onSelect={selectId} />
      )}
    />
  )

  const listPane: ReactNode = <div>{summaryCard}{listBody}</div>

  return (
    <>
      <GeoSearchShell
        triggers={triggersRow} chips={chipsRow}
        radius={noLocation ? undefined : {
          value: radiusKm, onChange: setRadiusKm,
          countLabel: t('vacancySearch.onMap', { count: points.length }),
        }}
        // Larger viewport offset (Danny 23-07, live feedback) — the drawer chrome
        // above the tab was pushing the map tall enough to force page scroll;
        // matches the vacancy-side CandidateSearchTab's own map height 1:1.
        mapHeight={'clamp(340px, calc(100vh - 540px), 720px)'}
        map={mapPane} results={listPane}
      />
      {/* Solliciteren modal — only reachable while a vacancy is selected (the button
          itself lives inside summaryCard, so selectedRow is always set here too).
          onCreated re-triggers the same hook `retry` the error state already uses —
          no new refetch contract, just the existing reload path. */}
      {showApply && selectedRow && (
        <AddApplicationModal
          candidateId={candidate.id}
          candidateOwnerId={candidate.ownerId}
          candidateOwnerName={candidate.owner}
          initialVacancyId={selectedRow.id}
          onClose={() => setShowApply(false)}
          onCreated={retry}
        />
      )}
    </>
  )
}
