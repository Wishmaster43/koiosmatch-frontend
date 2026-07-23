import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MatchExplorerLayout from '@/components/match/MatchExplorerLayout'
import RadiusMapPanel from '@/components/map/RadiusMapPanel'
import EntityLink from '@/components/ui/EntityLink'
import SearchSelect from '@/components/ui/SearchSelect'
import { useCandidateSearch } from '../hooks/useCandidateSearch'
import { useFunctions } from '@/lib/useFunctions'
import { useLookups } from '@/context/LookupsContext'
import { useNavigation } from '@/context/NavigationContext'
import { toCoord } from '@/lib/coords'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

const filterLabel: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }

/**
 * CandidateSearchTab — Match-zoeker fase 1 (vacancy side): the vacancy's own
 * location as the search origin, candidates matching radius/function/status
 * filters plotted on the shared RadiusMap + listed side by side (§3A blueprint:
 * thin container, all data via the hook, one small component per tab).
 */
export default function CandidateSearchTab({ vacancy }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { functions: functionOptions } = useFunctions()
  const { statuses: statusOptions } = useLookups()
  // Cross-entity deep link (EntityLink's own mechanism — NavigationContext.openEntity):
  // this switches the app to the candidates page AND opens the record's drawer there,
  // the same path every "open X" affordance in the app already uses.
  const { openEntity } = useNavigation()
  const {
    rows, loading, error, retry, radiusKm, setRadiusKm,
    functions: selectedFunctions, setFunctions,
    statuses: selectedStatuses, setStatuses,
    noLocation,
  } = useCandidateSearch(vacancy)

  // Honest empty state — no dead map/filters when the vacancy has no coordinates yet.
  if (noLocation) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('candidateSearch.noLocation')}</div>
  }

  const openCandidate = (id: Id) => openEntity('candidates', id)
  const toggleFunction = (name: string) =>
    setFunctions(selectedFunctions.includes(name) ? selectedFunctions.filter(f => f !== name) : [...selectedFunctions, name])
  const toggleStatus = (value: string) =>
    setStatuses(selectedStatuses.includes(value) ? selectedStatuses.filter(s => s !== value) : [...selectedStatuses, value])

  const center = { lat: toCoord(vacancy.lat) as number, lng: toCoord(vacancy.lng) as number }
  const points = rows
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({ id: r.id, lat: r.lat as number, lng: r.lng as number, label: r.name, sub: [r.functionTitle, r.city].filter(Boolean).join(' · ') }))

  // Searchable checklist dropdowns (shared SearchSelect, §3A — never a hand-rolled
  // chip row) — replaces the QuickViewToggle chip rows so a long tenant function/
  // status lookup stays usable instead of wrapping across many chip lines. The
  // trigger restates the field label and appends the selected count once >0.
  const filtersRow = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span style={filterLabel}>{t('candidateSearch.functions')}</span>
        <SearchSelect
          triggerLabel={<>{t('candidateSearch.functions')}{selectedFunctions.length > 0 && ` (${selectedFunctions.length})`}</>}
          options={functionOptions} selected={selectedFunctions} onToggle={toggleFunction} width={240} />
      </div>
      <div>
        <span style={filterLabel}>{t('candidateSearch.statuses')}</span>
        <SearchSelect
          triggerLabel={<>{t('candidateSearch.statuses')}{selectedStatuses.length > 0 && ` (${selectedStatuses.length})`}</>}
          options={statusOptions.map(s => ({ value: s.value, label: s.label }))} selected={selectedStatuses} onToggle={toggleStatus} width={240} />
      </div>
    </div>
  )

  const mapPane = (
    <RadiusMapPanel padded={false} points={points} center={center} radiusKm={radiusKm}
      mapHeight={'clamp(340px, calc(100vh - 470px), 760px)'}
      centerMarker={{ label: vacancy.title ?? '', sub: t('candidateSearch.centerVacancy') }}
      onRadiusChange={setRadiusKm}
      // The vacancy pin stays fixed — re-centring by clicking the map must never
      // move the search origin away from the vacancy's own address.
      onCenterChange={() => {}}
      onPick={openCandidate}
      pointsLabel={t('candidateSearch.onMap', { count: points.length })} />
  )

  // Four explicit states: loading, error (+ retry), empty, success list.
  const listPane = loading ? (
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
      {rows.map(r => (
        // Row = div[role=button]: the title nests EntityLink's own button+anchor
        // (Match-tab style — primary name opens in-app, trailing icon a new tab),
        // and interactive-inside-interactive is invalid HTML (mirror 23-07).
        <div key={String(r.id)} role="button" tabIndex={0}
          onClick={() => openCandidate(r.id)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCandidate(r.id) } }}
          style={{ ...rowStyle, width: '100%', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <div style={{ minWidth: 0 }}>
            {/* Link clicks must not double-fire the row's own open. */}
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <EntityLink page="candidates" id={r.id}>{r.name}</EntityLink>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[r.functionTitle, r.city].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {r.distanceKm != null && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              {r.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
      ))}
    </div>
  )

  return <MatchExplorerLayout filters={filtersRow} map={mapPane} list={listPane} />
}
