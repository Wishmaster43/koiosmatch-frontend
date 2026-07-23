import type { CSSProperties, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, X } from 'lucide-react'
import MatchExplorerLayout from '@/components/match/MatchExplorerLayout'
import RadiusMapPanel from '@/components/map/RadiusMapPanel'
import SearchSelect from '@/components/ui/SearchSelect'
import StatusPill from '@/components/ui/StatusPill'
import api, { unwrap } from '@/lib/api'
import { useVacancySearch } from '../hooks/useVacancySearch'
import { useFunctions } from '@/lib/useFunctions'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useNavigation } from '@/context/NavigationContext'
import { toCoord } from '@/lib/coords'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

const filterLabel: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
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
  // Cross-entity deep link (EntityLink's own mechanism — NavigationContext.openEntity):
  // this switches the app to the vacancies page AND opens the record's drawer there,
  // the same path every "open X" affordance in the app already uses.
  const { openEntity } = useNavigation()
  const {
    rows, loading, error, retry, radiusKm, setRadiusKm,
    functions: selectedFunctions, setFunctions,
    statuses: selectedStatuses, setStatuses,
    noLocation,
  } = useVacancySearch(candidate)

  // A row/marker pick now SELECTS a vacancy (summary card) instead of navigating
  // straight away (Danny 23-07, point 5) — state lives here in the tab.
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  // Reset the selection on a candidate switch (adjust-during-render, mirrors the hook's idiom).
  const [prevCandidateId, setPrevCandidateId] = useState(candidate.id)
  if (candidate.id !== prevCandidateId) { setPrevCandidateId(candidate.id); setSelectedId(null) }

  // Lazily fetch a short description snippet for the SELECTED vacancy only, once
  // per selection — abortable so a fast re-select never lets a stale response win.
  const [description, setDescription] = useState<string | null>(null)
  useEffect(() => {
    setDescription(null)
    if (selectedId == null) return
    const ctrl = new AbortController()
    api.get(`/vacancies/${selectedId}`, { signal: ctrl.signal, quiet404: true })
      .then(res => {
        const raw = unwrap<{ description?: string }>(res)
        const snippet = toSnippet(raw?.description ?? '')
        if (snippet) setDescription(snippet)
      })
      // Tolerant: a failed/empty fetch just omits the snippet — never an error wall.
      .catch(() => {})
    return () => ctrl.abort()
  }, [selectedId])

  // Honest empty state — no dead map/filters when the candidate has no coordinates yet.
  if (noLocation) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('vacancySearch.noLocation')}</div>
  }

  const selectedRow = rows.find(r => r.id === selectedId) ?? null
  const selectVacancy = (id: Id) => setSelectedId(id)
  const openInApp = (id: Id) => openEntity('vacancies', id)
  // A new browser TAB via the same `?open=` hash contract useDrawerUrl reads —
  // never navigates the current tab away from the candidate drawer.
  const openInNewWindow = (id: Id) =>
    window.open(`${window.location.origin}${window.location.pathname}#vacancies?open=${id}`, '_blank', 'noopener,noreferrer')

  const toggleFunction = (name: string) =>
    setFunctions(selectedFunctions.includes(name) ? selectedFunctions.filter(f => f !== name) : [...selectedFunctions, name])
  const toggleStatus = (value: string) =>
    setStatuses(selectedStatuses.includes(value) ? selectedStatuses.filter(s => s !== value) : [...selectedStatuses, value])

  // Trigger text mirrors the shared filter-panel idiom (SearchSelectGroup / report
  // filters): a count once something is selected, else a calm "choose X" prompt.
  const triggerText = (selected: string[], label: string) =>
    selected.length > 0 ? t('common:filters.selectedCount', { count: selected.length }) : t('common:filters.choose', { label: label.toLowerCase() })

  const center = { lat: toCoord(candidate.lat) as number, lng: toCoord(candidate.lng) as number }
  const points = rows
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({ id: r.id, lat: r.lat as number, lng: r.lng as number, label: r.title, sub: [r.customer, r.city].filter(Boolean).join(' · ') }))

  const filtersRow: ReactNode = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ minWidth: 180 }}>
        <span style={filterLabel}>{t('vacancySearch.statuses')}</span>
        <SearchSelect
          options={statusOptions.map(s => ({ value: s.value, label: s.label }))}
          selected={selectedStatuses} onToggle={toggleStatus}
          triggerLabel={triggerText(selectedStatuses, t('vacancySearch.statuses'))}
        />
      </div>
      <div style={{ minWidth: 180 }}>
        <span style={filterLabel}>{t('vacancySearch.functions')}</span>
        <SearchSelect
          options={functionOptions} selected={selectedFunctions} onToggle={toggleFunction}
          triggerLabel={triggerText(selectedFunctions, t('vacancySearch.functions'))}
        />
      </div>
    </div>
  )

  const mapPane: ReactNode = (
    <RadiusMapPanel padded={false} points={points} center={center} radiusKm={radiusKm}
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
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{selectedRow.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[selectedRow.customer, selectedRow.city].filter(Boolean).join(' · ') || '—'}</div>
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
        <StatusPill label={statusMeta(selectedRow.status).label} color={statusMeta(selectedRow.status).color} />
      </div>
      {description && <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{description}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 2 }}>
        <button onClick={() => openInNewWindow(selectedRow.id)} title={t('vacancySearch.openNewWindow')} aria-label={t('vacancySearch.openNewWindow')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
          <ExternalLink size={14} />
        </button>
        <button onClick={() => openInApp(selectedRow.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', padding: 0 }}>
          {t('vacancySearch.openInApp')}
        </button>
      </div>
    </div>
  )

  // Four explicit states: loading, error (+ retry), empty, success list.
  const listBody: ReactNode = loading ? (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
  ) : error ? (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('common:error.body')}</span>
      <button onClick={retry} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {t('common:error.retry')}
      </button>
    </div>
  ) : rows.length === 0 ? (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('vacancySearch.empty')}</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(r => {
        const isSelected = r.id === selectedId
        return (
          // Native <button> (semantic HTML first, §6) — full width so it reads as one row.
          <button key={String(r.id)} type="button" onClick={() => selectVacancy(r.id)}
            style={{ ...rowStyle, width: '100%', border: 'none', textAlign: 'left', font: 'inherit',
              background: isSelected ? 'var(--color-primary-bg)' : 'transparent' }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[r.customer, r.city].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            {r.distanceKm != null && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {r.distanceKm.toFixed(1)} km
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  const listPane: ReactNode = <div>{summaryCard}{listBody}</div>

  return <MatchExplorerLayout filters={filtersRow} map={mapPane} list={listPane} />
}
