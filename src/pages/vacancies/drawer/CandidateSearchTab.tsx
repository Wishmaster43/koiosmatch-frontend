import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X } from 'lucide-react'
import MatchExplorerLayout from '@/components/match/MatchExplorerLayout'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import RadiusMapPanel from '@/components/map/RadiusMapPanel'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import SearchSelect from '@/components/ui/SearchSelect'
import StatusPill from '@/components/ui/StatusPill'
import { useCandidateSearch } from '../hooks/useCandidateSearch'
import { useFunctions } from '@/lib/useFunctions'
import { useLookups } from '@/context/LookupsContext'
import { notify, notifyError } from '@/lib/notify'
import { toCoord } from '@/lib/coords'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

const filterLabel: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }

// Row-level LIVE score pill — same thresholds as the shared MatchScoreBlock's
// scoreColor (≥75 success / ≥50 warning / else danger), soft-tinted per §4.
// Duplicated (not imported): MatchScoreBlock keeps its threshold helper private
// and is outside this task's file scope — keep both in sync if they ever change.
function ScorePill({ score }: { score: number }) {
  const color = score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, flexShrink: 0,
      color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      borderRadius: 99, padding: '1px 7px',
    }}>{Math.round(score)}%</span>
  )
}

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

  // Honest empty state — no dead map/filters when the vacancy has no coordinates yet.
  if (noLocation) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('candidateSearch.noLocation')}</div>
  }

  const selectedRow = rows.find(r => r.id === selectedId) ?? null
  const selectCandidate = (id: Id) => setSelectedId(id)

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

  const mapPane = (
    <RadiusMapPanel padded={false} points={points} center={center} radiusKm={radiusKm}
      mapHeight={'clamp(320px, calc(100vh - 580px), 680px)'}
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
        <button onClick={() => setSelectedId(null)} aria-label={t('common:close')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0, display: 'flex' }}>
          <X size={14} />
        </button>
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
      <button onClick={retry} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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
            {(r.score != null || r.distanceKm != null) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {r.score != null && <ScorePill score={r.score} />}
                {r.distanceKm != null && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.distanceKm.toFixed(1)} km
                  </span>
                )}
              </div>
            )}
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
        fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-bg)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)', borderRadius: 8,
        padding: '6px 12px', cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1 }}>
      <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
      {t('candidateSearch.refreshAdvice')}
    </button>
  )

  const listPane = <div>{refreshButton}{summaryCard}{listBody}</div>

  return <MatchExplorerLayout filters={filtersRow} map={mapPane} list={listPane} />
}
