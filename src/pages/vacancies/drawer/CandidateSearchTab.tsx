import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X, ChevronRight } from 'lucide-react'
import MatchExplorerLayout from '@/components/match/MatchExplorerLayout'
import ScorePill from '@/components/match/ScorePill'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import RadiusMapPanel from '@/components/map/RadiusMapPanel'
import DrillPager from '@/components/drawer/DrillPager'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import SearchSelect from '@/components/ui/SearchSelect'
import GeocodeButton from '@/components/ui/GeocodeButton'
import StatusPill from '@/components/ui/StatusPill'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
// Reuse the candidate-anchored "+ Solliciteren" flow (mirrors ApplicantsTab's own
// CandidateAddApplicationModal reuse, §2 sanctioned cross-entity import for this
// exact shared flow) — never a second apply form.
import CandidateAddApplicationModal from '@/pages/candidates/drawer/AddApplicationModal'
import { useCandidateSearch } from '../hooks/useCandidateSearch'
import { useFunctions } from '@/lib/useFunctions'
import { useLookups } from '@/context/LookupsContext'
import { notify, notifyError } from '@/lib/notify'
import { toCoord } from '@/lib/coords'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

const filterLabel: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }

/**
 * CandidateSearchTab — the LIVE scored match search (MATCH-EXPLORER-1 fase
 * 2+3): candidates matching radius/function/status/contract-form filters,
 * scored best-first by the backend, plotted on the shared RadiusMap + listed
 * side by side (§3A blueprint: thin container, all data via the hook, one
 * small component per tab). Mirrors candidates/drawer/VacancySearchTab's
 * summary-card idiom 1:1 (Danny 23-07): a row/marker pick SELECTS a candidate
 * (a card above the list) instead of navigating away immediately.
 */
export default function CandidateSearchTab({ vacancy }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { functions: functionOptions } = useFunctions()
  const { statuses: statusOptions, candidateTypes } = useLookups()
  const {
    rows, loading, error, retry, radiusKm, setRadiusKm,
    functions: selectedFunctions, setFunctions,
    statuses: selectedStatuses, setStatuses,
    contractForms: selectedContractForms, setContractForms,
    noLocation, refreshAdvice,
  } = useCandidateSearch(vacancy)

  // A row/marker pick SELECTS a candidate (summary card) instead of navigating
  // straight away — mirrors candidates/drawer/VacancySearchTab (Danny 23-07).
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  // Reset the selection on a vacancy switch (adjust-during-render, mirrors the hook's own idiom).
  const [prevVacancyId, setPrevVacancyId] = useState(vacancy.id)
  if (vacancy.id !== prevVacancyId) { setPrevVacancyId(vacancy.id); setSelectedId(null) }

  // The refresh-advice button's own busy flag (separate from the list's loading state).
  const [refreshing, setRefreshing] = useState(false)

  const selectedRow = rows.find(r => r.id === selectedId) ?? null
  const selectCandidate = (id: Id) => setSelectedId(id)

  // "Solliciteren" (point 18, mirrors VacancySearchTab): opens the shared
  // candidate-anchored apply flow for the SELECTED candidate with this vacancy
  // prefilled. Closed on any selection change so browsing prev/next never
  // leaves a stale modal pinned to the old row.
  const [showApply, setShowApply] = useState(false)
  useEffect(() => { setShowApply(false) }, [selectedId])

  // Browse (point 19, mirrors VacancySearchTab): prev/next through the CURRENT
  // result list via the shared DrillPager — undefined at the ends disables the
  // matching button, never a cycle.
  const selectedIndex = rows.findIndex(r => r.id === selectedId)
  const goPrev = selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined
  const goNext = selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined

  const toggleFunction = (name: string) =>
    setFunctions(selectedFunctions.includes(name) ? selectedFunctions.filter(f => f !== name) : [...selectedFunctions, name])
  const toggleStatus = (value: string) =>
    setStatuses(selectedStatuses.includes(value) ? selectedStatuses.filter(s => s !== value) : [...selectedStatuses, value])
  const toggleContractForm = (value: string) =>
    setContractForms(selectedContractForms.includes(value) ? selectedContractForms.filter(c => c !== value) : [...selectedContractForms, value])

  // Queue a batched Koios advice refresh; the hook auto-refetches once ~10s later.
  const handleRefreshAdvice = async () => {
    if (refreshing) return
    setRefreshing(true)
    const queued = await refreshAdvice()
    setRefreshing(false)
    // 'info' (not 'success'): a 202 only means "queued" — it never guarantees the
    // advice actually lands (§3 honesty; no Anthropic credit configured = a silent no-op).
    if (queued) notify('info', t('candidateSearch.adviceQueued'))
    else notifyError(t('common:actionFailed'))
  }

  const center = { lat: toCoord(vacancy.lat) as number, lng: toCoord(vacancy.lng) as number }
  const points = rows
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({ id: r.id, lat: r.lat as number, lng: r.lng as number, label: r.name, sub: [r.functionTitle, r.city].filter(Boolean).join(' · ') }))

  // Searchable checklist dropdowns (shared SearchSelect, §3A — never a hand-rolled
  // chip row), side by side: three filters wrap onto a new line only when narrow
  // (Danny 23-07: filters must sit next to each other, never stacked).
  //
  // NOT ADDED (verified 08-08, KAND-FILTERS-1 relocation): hours-per-week +
  // available-before were asked for here too, mirrored after candidates/drawer/
  // VacancySearchTab's own "offered-iff-read" hours/available-from filters. That
  // mirror works because MatchExplorerService::vacancyShape() already returns
  // hours_min/hours_max/start_date per row (VACANCY-MATCHES-FIELDS-1), so the tab
  // can filter client-side once the data is present. The reverse direction has
  // no such data: MatchExplorerService::candidateShape() (this tab's GET
  // /vacancies/{id}/candidate-matches) returns no candidate preference fields at
  // all, and MatchExplorerRequest doesn't accept hours_per_week_min/max or
  // available_from_before as filter params either — unlike /candidates, this
  // endpoint is NOT built on CandidateQuery. Wiring a filter here would either
  // silently no-op (fake affordance, §3) or need a backend addition (shape +
  // params) PLUS changes to ../hooks/useCandidateSearch.ts, which sits outside
  // this task's file scope. Left out rather than shipped disabled/dead.
  const filtersRow = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ minWidth: 180 }}>
        <span style={filterLabel}>{t('candidateSearch.functions')}</span>
        <SearchSelect
          triggerLabel={<>{t('candidateSearch.functions')}{selectedFunctions.length > 0 && ` (${selectedFunctions.length})`}</>}
          options={functionOptions} selected={selectedFunctions} onToggle={toggleFunction} width={240} />
      </div>
      <div style={{ minWidth: 180 }}>
        <span style={filterLabel}>{t('candidateSearch.statuses')}</span>
        <SearchSelect
          triggerLabel={<>{t('candidateSearch.statuses')}{selectedStatuses.length > 0 && ` (${selectedStatuses.length})`}</>}
          options={statusOptions.map(s => ({ value: s.value, label: s.label }))} selected={selectedStatuses} onToggle={toggleStatus} width={240} />
      </div>
      <div style={{ minWidth: 180 }}>
        <span style={filterLabel}>{t('candidateSearch.contractForms')}</span>
        <SearchSelect
          triggerLabel={<>{t('candidateSearch.contractForms')}{selectedContractForms.length > 0 && ` (${selectedContractForms.length})`}</>}
          options={candidateTypes.map(c => ({ value: c.value, label: c.label }))} selected={selectedContractForms} onToggle={toggleContractForm} width={240} />
      </div>
    </div>
  )

  // GEO-DEGRADE-1 (Danny 08-08) — mirrors candidates/drawer/VacancySearchTab: only the
  // map needs coordinates, so an un-geocoded vacancy shows the notice in the map's
  // place instead of blanking the whole tab. The candidate search itself keeps working.
  const mapPane = noLocation ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, border: '1px dashed var(--border)', borderRadius: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('candidateSearch.noLocation')}</span>
      <GeocodeButton endpoint={`/vacancies/${vacancy.id}/geocode`} permission="vacancies.update" variant="row" />
    </div>
  ) : (
    <RadiusMapPanel padded={false} points={points} center={center} radiusKm={radiusKm}
      mapHeight={'clamp(340px, calc(100vh - 540px), 720px)'}
      centerMarker={{ label: vacancy.title ?? '', sub: t('candidateSearch.centerVacancy') }}
      onRadiusChange={setRadiusKm}
      // The vacancy pin stays fixed — re-centring by clicking the map must never
      // move the search origin away from the vacancy's own address.
      onCenterChange={() => {}}
      onPick={selectCandidate}
      pointsLabel={t('candidateSearch.onMap', { count: points.length })} />
  )

  // Compact summary card for the SELECTED candidate — shown before navigating
  // away, never an immediate jump (mirrors VacancySearchTab's card 1:1).
  const summaryCard = selectedRow && (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          {/* The title IS the link (Match-tab style): orange name opens in-app,
              trailing icon a new tab. No separate action row. */}
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            <EntityLink page="candidates" id={selectedRow.id}>{selectedRow.name}</EntityLink>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[selectedRow.functionTitle, selectedRow.city].filter(Boolean).join(' · ') || '—'}</div>
        </div>
        {/* Right column (mirrors VacancySearchTab's own layout): pager+close on top,
            Solliciteren beneath — the title row keeps its full width so long
            candidate names never truncate against the primary action. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DrillPager index={selectedIndex + 1} total={rows.length} onPrev={goPrev} onNext={goNext} />
            <button onClick={() => setSelectedId(null)} aria-label={t('common:close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
          {/* Solliciteren (point 18): the primary action for this candidate score
              panel — opens the shared candidate-anchored apply flow with this
              vacancy prefilled (reuses candidates:vacancySearch.apply's label —
              same action, one i18n key, no vacancies.json duplicate). */}
          <DrawerAddButton onClick={() => setShowApply(true)} label={t('candidates:vacancySearch.apply')} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {selectedRow.distanceKm != null && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>{selectedRow.distanceKm.toFixed(1)} km</span>
        )}
        <StatusPill label={selectedRow.statusLabel || selectedRow.status} color={selectedRow.statusColor} />
      </div>
      {/* Read-only LIVE score — no onSave, so MatchScoreBlock renders without its edit controls. */}
      {selectedRow.score != null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <MatchScoreBlock score={selectedRow.score} criteria={selectedRow.criteria} />
        </div>
      )}
      {selectedRow.aiAdviceReason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <KoiosAiMark size={16} title={t('candidateSearch.aiAdvised')} />
          <span>{selectedRow.aiAdviceReason}</span>
        </div>
      )}
    </div>
  )

  // Four explicit states: loading, error (+ retry), empty, success list.
  const listBody = loading ? (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
  ) : error ? (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('common:error.body')}</span>
      <button onClick={retry} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {t('common:error.retry')}
      </button>
    </div>
  ) : rows.length === 0 ? (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('candidateSearch.empty')}</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* The selected candidate renders as the card above — drop its list row (no duplicate). */}
      {rows.filter(r => r.id !== selectedId).map(r => {
        const isSelected = r.id === selectedId
        return (
          // Row = div[role=button]: the title nests EntityLink's own button+anchor
          // (Match-tab style — primary name opens in-app, trailing icon a new tab),
          // and interactive-inside-interactive is invalid HTML. Row click selects
          // the summary card; the title link/icon navigate instead.
          <div key={String(r.id)} role="button" tabIndex={0}
            onClick={() => selectCandidate(r.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCandidate(r.id) } }}
            style={{ ...rowStyle, width: '100%', background: isSelected ? 'var(--color-primary-bg)' : 'transparent' }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
            <div style={{ minWidth: 0 }}>
              {/* Title clicks must not ALSO flip the summary selection; the AI mark
                  signals a Koios-advised match (MATCH-EXPLORER-1 fase 2+3). */}
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}
                onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                {r.aiAdvised && <KoiosAiMark size={14} title={r.aiAdviceReason ?? t('candidateSearch.aiAdvised')} />}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  <EntityLink page="candidates" id={r.id}>{r.name}</EntityLink>
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[r.functionTitle, r.city].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {r.score != null && <ScorePill score={r.score} />}
              {r.distanceKm != null && (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.distanceKm.toFixed(1)} km
                </span>
              )}
              {/* Expand affordance (point 17, mirrors VacancySearchTab): a visible
                  chevron on EVERY row signals the row opens a preview, on top of
                  the row's own cursor:pointer + hover background. */}
              <ChevronRight size={14} strokeWidth={3} aria-hidden="true" style={{ color: 'var(--color-primary-text)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )

  // Calm secondary button (soft primary tint, §4 — never a solid fill) above the
  // list: queues a batched Koios advice refresh (fase 3) for this vacancy's best matches.
  const refreshButton = (
    <button type="button" onClick={handleRefreshAdvice} disabled={refreshing}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
        fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)', background: 'var(--color-primary-bg)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)', borderRadius: 8,
        padding: '6px 12px', cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1 }}>
      <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
      {t('candidateSearch.refreshAdvice')}
    </button>
  )

  const listPane = <div>{refreshButton}{summaryCard}{listBody}</div>

  return (
    <>
      <MatchExplorerLayout filters={filtersRow} map={mapPane} list={listPane} />
      {/* Solliciteren modal — only reachable while a candidate is selected (the
          button itself lives inside summaryCard, so selectedRow is always set
          here too). onCreated re-triggers the same hook `retry` the error state
          already uses — no new refetch contract, just the existing reload path. */}
      {showApply && selectedRow && (
        <CandidateAddApplicationModal
          candidateId={selectedRow.id}
          initialVacancyId={vacancy.id}
          onClose={() => setShowApply(false)}
          onCreated={retry}
        />
      )}
    </>
  )
}
