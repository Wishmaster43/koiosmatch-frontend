import type { CSSProperties, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronRight } from 'lucide-react'
import MatchExplorerLayout from '@/components/match/MatchExplorerLayout'
import ScorePill from '@/components/match/ScorePill'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import RadiusMapPanel from '@/components/map/RadiusMapPanel'
import DrillPager from '@/components/drawer/DrillPager'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import GeocodeButton from '@/components/ui/GeocodeButton'
import StatusPill from '@/components/ui/StatusPill'
import DrawerAddButton from './DrawerAddButton'
import AddApplicationModal from './AddApplicationModal'
import VacancySearchFilters from './VacancySearchFilters'
import api, { unwrap } from '@/lib/api'
import { useVacancySearch } from '../hooks/useVacancySearch'
import { useFunctions } from '@/lib/useFunctions'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { toCoord } from '@/lib/coords'
import { formatCurrency } from '@/lib/formatters'
// HUISSTIJL-1: the shared JetBrains Mono atom + the muted-caption atom (identity-only swaps).
import { Mono, Caption } from '@/components/ui/typography'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// A tenant-lookup value carried on the FROZEN vacancyShape detail (education/
// seniority) — either the resolved {value,label,color} object or absent.
interface LookupChip { value?: string; label?: string; color?: string | null }

// P8-result-cards: the extra detail fields the lazy GET /vacancies/{id} fetch
// now also reads (FROZEN vacancyShape, CMBE wave 3) — salary/experience/hours
// are tolerant numeric coercions (Laravel decimal-as-string, §10), education/
// seniority arrive as {value,label,color}|null straight from the resource.
interface VacancyDetail {
  description?: string
  salaryMin: number | null
  salaryMax: number | null
  salaryPeriod: string | null
  experienceMin: number | null
  experienceMax: number | null
  education: LookupChip | null
  seniority: LookupChip | null
}

// Renders a min/max pair as a compact range string ("20–32", "≥ 20", "≤ 32"),
// or null when neither bound is present — the caller then omits the line entirely.
function formatRange(min: number | null, max: number | null, format: (n: number) => string): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${format(min)}–${format(max)}`
  return format((min ?? max) as number)
}

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }
// Snippet length cap (2-3 lines of plain text) — a short teaser, not the full description.
const SNIPPET_MAX_LENGTH = 220

/**
 * VacancySearchTab — Match-zoeker fase 1b (candidate side): the MIRROR of
 * vacancies/drawer/CandidateSearchTab — the candidate's own geocoded home
 * location as the search origin, OPEN vacancies within a radius plotted on the
 * shared RadiusMap + listed side by side (§3A blueprint: thin container, all
 * data via the hook, one small component per tab). Wraps its own
 * VacancyLookupsProvider (mirrors applications/drawer/VacancyTab.tsx) because
 * that context is only mounted page-scoped around VacanciesPage, not around
 * the candidate drawer.
 */
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
  // straight away (Danny 23-07, point 5) — state lives here in the tab.
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  // Reset the selection on a candidate switch (adjust-during-render, mirrors the hook's idiom).
  const [prevCandidateId, setPrevCandidateId] = useState(candidate.id)
  if (candidate.id !== prevCandidateId) { setPrevCandidateId(candidate.id); setSelectedId(null) }

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

  const selectedRow = rows.find(r => r.id === selectedId) ?? null
  const selectVacancy = (id: Id) => setSelectedId(id)

  // Browse (Danny 05-08, point 3): prev/next through the CURRENT result list,
  // reusing the shared DrillPager anatomy (mirrors LocationDetail/ContactDetail).
  // Disabled at the ends — no cycling, and undefined (never a no-op handler) is
  // what makes DrillPager itself render the button disabled.
  const selectedIndex = rows.findIndex(r => r.id === selectedId)
  const goPrev = selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined
  const goNext = selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined

  const center = { lat: toCoord(candidate.lat) as number, lng: toCoord(candidate.lng) as number }
  const points = rows
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({ id: r.id, lat: r.lat as number, lng: r.lng as number, label: r.title, sub: [r.customer, r.city].filter(Boolean).join(' · ') }))

  // Filter bar (own component — the tab stays a thin container, §3): every value
  // and setter comes straight from the hook, including the reset action.
  const filtersRow: ReactNode = (
    <VacancySearchFilters
      candidateTitle={candidate.title}
      statusOptions={statusOptions} statuses={selectedStatuses} onStatusesChange={setStatuses}
      functionOptions={functionOptions} functions={selectedFunctions} onFunctionsChange={setFunctions}
      functionNotInLookup={functionNotInLookup}
      contractvormOptions={contractvormOptions} contractvorm={contractvorm} onContractvormChange={setContractvorm}
      hasHoursData={hasHoursData} hoursRange={hoursRange} hoursRangeMax={hoursRangeMax} onHoursRangeChange={setHoursRange}
      hasAvailableFromData={hasAvailableFromData} availableFrom={availableFrom} onAvailableFromChange={setAvailableFrom}
      filtersDirty={filtersDirty} onReset={resetFilters}
    />
  )

  // GEO-DEGRADE-1 (Danny 08-08): an un-geocoded candidate used to blank the WHOLE tab
  // — filters, list and all. Only the map genuinely needs coordinates, so the notice
  // takes the map's place (with the shared geocode trigger) and everything else works.
  const mapPane: ReactNode = noLocation ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, border: '1px dashed var(--border)', borderRadius: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('vacancySearch.noLocation')}</span>
      <GeocodeButton endpoint={`/candidates/${candidate.id}/geocode`} permission="candidates.update"
        variant="row" disabled={!candidate.address} />
    </div>
  ) : (
    <RadiusMapPanel padded={false} points={points} center={center} radiusKm={radiusKm}
      // Larger viewport offset (Danny 23-07, live feedback) — the drawer chrome
      // above the tab was pushing the map tall enough to force page scroll;
      // matches the vacancy-side CandidateSearchTab's own map height 1:1.
      mapHeight={'clamp(340px, calc(100vh - 540px), 720px)'}
      centerMarker={{ label: candidate.name ?? '', sub: t('vacancySearch.centerHome') }}
      onRadiusChange={setRadiusKm}
      // The candidate's home pin stays fixed — re-centring by clicking the map must
      // never move the search origin away from the candidate's own address.
      onCenterChange={() => {}}
      onPick={selectVacancy}
      pointsLabel={t('vacancySearch.onMap', { count: points.length })} />
  )

  // Compact summary card for the SELECTED vacancy — shown before navigating away,
  // never an immediate jump (Danny 23-07, point 5).
  const summaryCard: ReactNode = selectedRow && (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          {/* The title IS the link (Danny 23-07): Match-style EntityLink — orange
              name opens in-app, trailing icon a new tab. No separate action row. */}
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            <EntityLink page="vacancies" id={selectedRow.id}>{selectedRow.title}</EntityLink>
          </div>
          {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
          <Caption as="div">{[selectedRow.customer, selectedRow.city].filter(Boolean).join(' · ') || '—'}</Caption>
        </div>
        {/* Right column (Danny 13-08 screenshot): pager+close on top, Solliciteren
            BENEATH them — the title row keeps its full width so long vacancy names
            no longer truncate against the primary action. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Browse through the current result list (Danny 05-08, point 3) — same
                corner as every other detail pager (ContactDetail/LocationDetail). */}
            <DrillPager index={selectedIndex + 1} total={rows.length} onPrev={goPrev} onNext={goNext} />
            <button onClick={() => setSelectedId(null)} aria-label={t('common:close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
          {/* Solliciteren (Danny 06-08): the primary action for this open score panel —
              opens the shared AddApplicationModal with this vacancy prefilled. */}
          <DrawerAddButton onClick={() => setShowApply(true)} label={t('vacancySearch.apply')} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* HUISSTIJL-1: identical fontFamily/size/colour render. */}
        {selectedRow.distanceKm != null && (
          <Mono style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedRow.distanceKm.toFixed(1)} km</Mono>
        )}
        <StatusPill label={statusMeta(selectedRow.status).label} color={statusMeta(selectedRow.status).color} />
        {/* Already-fetched search-row fields (hours + contract form) — render on
            the card too, no extra request needed. */}
        {selectedRow.employmentType && <StatusPill label={selectedRow.employmentType} color="var(--text-muted)" />}
        {/* HUISSTIJL-1: identical fontFamily/size/colour render. */}
        {formatRange(selectedRow.hoursMin, selectedRow.hoursMax, n => String(n)) && (
          <Mono style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t('vacancySearch.cardHours', { range: formatRange(selectedRow.hoursMin, selectedRow.hoursMax, n => String(n)) })}
          </Mono>
        )}
      </div>
      {/* P8-result-cards: the lazily-fetched detail line (salary/experience) +
          education/seniority soft-chips — summary card ONLY, list rows stay calm. */}
      {detail && (formatRange(detail.salaryMin, detail.salaryMax, n => formatCurrency(n, 'EUR', 'nl-NL', 0)) || formatRange(detail.experienceMin, detail.experienceMax, n => String(n)) || detail.education || detail.seniority) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* HUISSTIJL-1: identical fontFamily/size/colour render. */}
          {formatRange(detail.salaryMin, detail.salaryMax, n => formatCurrency(n, 'EUR', 'nl-NL', 0)) && (
            <Mono style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('vacancySearch.cardSalary', {
                range: formatRange(detail.salaryMin, detail.salaryMax, n => formatCurrency(n, 'EUR', 'nl-NL', 0)),
                period: detail.salaryPeriod ? t(`vacancySearch.salaryPeriod.${detail.salaryPeriod}`, { defaultValue: detail.salaryPeriod }) : '',
              })}
            </Mono>
          )}
          {formatRange(detail.experienceMin, detail.experienceMax, n => String(n)) && (
            // HUISSTIJL-1: identical 11/400/var(--text-muted) render.
            <Caption>
              {t('vacancySearch.cardExperience', { range: formatRange(detail.experienceMin, detail.experienceMax, n => String(n)) })}
            </Caption>
          )}
          {/* Seniority uses its lookup colour (§4); education mirrors the same soft-chip look. */}
          {detail.seniority?.label && <StatusPill label={detail.seniority.label} color={detail.seniority.color} />}
          {detail.education?.label && <StatusPill label={detail.education.label} color={detail.education.color} />}
        </div>
      )}
      {description && <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{description}</p>}
      {/* Read-only LIVE score (CMBE MATCH-EXPLORER-1 fase 2+3) — no onSave, so
          MatchScoreBlock renders without its edit/adjust controls. */}
      {selectedRow.score != null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <MatchScoreBlock score={selectedRow.score} criteria={selectedRow.criteria} />
        </div>
      )}
      {selectedRow.aiAdviceReason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <KoiosAiMark size={16} title={t('vacancySearch.aiAdvised')} />
          <span>{selectedRow.aiAdviceReason}</span>
        </div>
      )}
    </div>
  )

  // Four explicit states: loading, error (+ retry), empty, success list.
  const listBody: ReactNode = loading ? (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
  ) : error ? (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('common:error.body')}</span>
      <button onClick={retry} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {t('common:error.retry')}
      </button>
    </div>
  ) : rows.length === 0 ? (
    // GEO-EMPTY-1 (Danny 14-08 "bij de demo vind ik geen vacatures terwijl die er wel
    // zijn"): the radius filter runs against the candidate's own coordinates, so an
    // un-geocoded candidate can NEVER match — blaming the filters there sends the user
    // hunting in the wrong place. Name the real cause and offer the geocode action.
    <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {noLocation ? t('vacancySearch.noLocationResults') : t('vacancySearch.empty')}
      </span>
      {noLocation && (
        <GeocodeButton endpoint={`/candidates/${candidate.id}/geocode`} permission="candidates.update"
          variant="row" disabled={!candidate.address} />
      )}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* The selected vacancy renders as the card above — drop its list row (no duplicate). */}
      {rows.filter(r => r.id !== selectedId).map(r => {
        const isSelected = r.id === selectedId
        return (
          // Row = div[role=button] (not <button>: the title nests EntityLink's own
          // button+anchor, and interactive-inside-interactive is invalid HTML).
          // Danny 23-07: row click = summary card HERE; the title link/icon (Match-tab
          // style: primary name in-app, trailing icon new tab) navigates instead.
          <div key={String(r.id)} role="button" tabIndex={0}
            onClick={() => selectVacancy(r.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectVacancy(r.id) } }}
            style={{ ...rowStyle, width: '100%',
              background: isSelected ? 'var(--color-primary-bg)' : 'transparent' }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
            <div style={{ minWidth: 0 }}>
              {/* Title clicks must not ALSO flip the summary selection; the AI mark
                  signals a Koios-advised match (MATCH-EXPLORER-1 fase 2+3). */}
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}
                onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                {r.aiAdvised && <KoiosAiMark size={16} title={r.aiAdviceReason ?? t('vacancySearch.aiAdvised')} />}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  <EntityLink page="vacancies" id={r.id} title={t('vacancySearch.openInApp')}>{r.title}</EntityLink>
                </span>
              </div>
              {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
              <Caption as="div" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[r.customer, r.city].filter(Boolean).join(' · ') || '—'}
              </Caption>
              {/* V-search-1: per-row meta chips — hours + employment type, only when
                  the row really carries them (salary is detail-only, stays on the
                  summary card). Mono for the numbers (§4). */}
              {(formatRange(r.hoursMin, r.hoursMax, n => String(n)) || r.employmentType) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                  {/* HUISSTIJL-1: identical fontFamily/size/colour + chip-frame render. */}
                  {formatRange(r.hoursMin, r.hoursMax, n => String(n)) && (
                    <Mono style={{ fontSize: 10.5, color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                      {t('vacancySearch.cardHours', { range: formatRange(r.hoursMin, r.hoursMax, n => String(n)) })}
                    </Mono>
                  )}
                  {r.employmentType && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--border)',
                      borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.employmentType}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {r.score != null && <ScorePill score={r.score} />}
              {/* HUISSTIJL-1: identical fontFamily/size/colour render. */}
              {r.distanceKm != null && (
                <Mono style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.distanceKm.toFixed(1)} km
                </Mono>
              )}
              {/* Expand affordance (Danny 05-08, point 2: "niet duidelijk dat je een
                  vacature kan openklappen") — a visible chevron on EVERY row, on top
                  of the row's own cursor:pointer + hover background. Decorative only
                  (the row itself already carries the click/keyboard semantics above).
                  Bold + primary-orange (Danny 06-08 screenshot feedback) — same token
                  EntityLink's title button uses, so it reads as one affordance family. */}
              <ChevronRight size={14} strokeWidth={3} aria-hidden="true" style={{ color: 'var(--color-primary-text)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )

  const listPane: ReactNode = <div>{summaryCard}{listBody}</div>

  return (
    <>
      <MatchExplorerLayout filters={filtersRow} map={mapPane} list={listPane} />
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
