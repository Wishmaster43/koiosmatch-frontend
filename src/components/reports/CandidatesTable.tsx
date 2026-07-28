/**
 * CandidatesTable — searchable, sortable table of candidates.
 * Shows a status badge per candidate; clicking a row opens CandidateDetailDrawer.
 * Filters come from RightPanelContext. StatusBadge below = the colored status pill.
 *
 * Uses the shared DataTable (§3A) so its sortable headers get real keyboard
 * reachability + aria-sort for free — this table has no pagination and no
 * grouped/totals rows, so it fits DataTable's contract without losing anything
 * real (accessibility audit 2026-07-28). One deliberate trade-off: the old
 * two-line empty state (title + hint) collapses to DataTable's single-line
 * `emptyText` — this component currently has zero importers in the app, so the
 * cosmetic loss has no live user impact; flagged in the audit report.
 */
import { useState, useEffect, useMemo } from 'react'
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Search } from 'lucide-react'
import CandidateDetailDrawer from './CandidateDetailDrawer'
import { useRightPanel }     from '@/context/RightPanelContext'
import DataTable from '../ui/DataTable'
import type { Column } from '../ui/DataTable'
import type { ReportCandidate } from '@/types/reports'

// Colored status pill (actief / nietactief / extern / ...) for a candidate row.
function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  /* eslint-disable no-restricted-syntax -- fixed status→colour mapping (DATA), mirrors the lookup-colour pattern used elsewhere; these shades have no exact token equivalent */
  const styles: Record<string, { bg: string; color: string }> = {
    actief:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    nietactief: { bg: 'var(--color-warning-bg)', color: '#C2410C' },
    extern:     { bg: 'var(--color-secondary-bg)', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: 'var(--color-violet)' },
    verwijderd: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  }
  /* eslint-enable no-restricted-syntax */
  const key = (status || '').toLowerCase().replace(/\s+/g, '')
  const s = styles[key] || { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function fmtDate(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TagPill({ value, color = 'var(--color-primary)', bg = 'var(--color-primary-bg)' }: { value: ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 5,
                   background: bg, color, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

function TagCell({ items, color, bg }: { items?: ReactNode[]; color?: string; bg?: string }) {
  if (!items?.length) return <span style={{ color: 'var(--border)' }}>—</span>
  const visible = items.slice(0, 2)
  const rest    = items.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((v, i) => <TagPill key={i} value={v} color={color} bg={bg} />)}
      {rest > 0 && <TagPill value={`+${rest}`} color="var(--text-muted)" bg="var(--border)" />}
    </div>
  )
}

function RateCell({ candidate }: { candidate: ReportCandidate }) {
  const { t } = useTranslation('reports')
  const rates = candidate.global_rate_summary
  if (!Array.isArray(rates) || !rates.length) return <span style={{ color: 'var(--border)' }}>—</span>
  const visible = rates.slice(0, 2)
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((r, i) => (
        <span key={i} style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {r.global_rate?.internal_description ?? r.step_name ?? '—'}:&nbsp;
          </span>
          {r.hour_rate != null ? `€${Number(r.hour_rate).toFixed(2)}` : '—'}
        </span>
      ))}
      {rates.length > 2 && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('candidates.more', { count: rates.length - 2 })}</span>
      )}
    </div>
  )
}

function parseKenmerken(v?: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(item => item?.name ?? String(item)).filter(Boolean)
}

// Column definitions handed to the shared DataTable — sorting/aria-sort/keyboard
// reach live there (§3A); this component only declares columns + cell rendering.
// `global_rate` intentionally has no `sortValue` (there is no single scalar to
// sort multiple per-step rates by) — DataTable falls back to `row.global_rate`
// (always undefined), so every row ties and the click is a harmless no-op,
// exactly as the original `value: () => ''` behaved.
function buildColumns(t: TFunction): Column<ReportCandidate>[] {
  return [
  { key: 'name', header: t('candidates.cols.name'), sortable: true,
    sortValue: c => `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || null,
    render: c => (
      <div>
        <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13 }}>
          {`${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || '—'}
        </div>
        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
      </div>
    )},
  { key: 'status', header: t('candidates.cols.status'), sortable: true,
    sortValue: c => c.status ?? null,
    render: c => <StatusBadge status={c.status} /> },
  { key: 'position', header: t('candidates.cols.position'), sortable: true,
    sortValue: c => c.position ?? null,
    render: c => <span style={{ fontSize: 13 }}>{c.position || '—'}</span> },
  { key: 'mobile', header: t('candidates.cols.mobile'), sortable: true,
    sortValue: c => c.mobile ?? c.phone ?? null,
    render: c => <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{c.mobile ?? c.phone ?? '—'}</span> },
  { key: 'registration_date', header: t('candidates.cols.registration'), sortable: true,
    sortValue: c => c.registration_date ? new Date(c.registration_date).getTime() : null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.registration_date)}</span> },
  { key: 'last_login_at', header: t('candidates.cols.lastLogin'), sortable: true,
    sortValue: c => c.last_login_at ? new Date(c.last_login_at).getTime() : null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_login_at)}</span> },
  { key: 'last_planned_shift', header: t('candidates.cols.plannedShift'), sortable: true,
    sortValue: c => c.last_planned_shift ? new Date(c.last_planned_shift).getTime() : null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_planned_shift)}</span> },
  { key: 'last_worked_shift', header: t('candidates.cols.lastShift'), sortable: true,
    sortValue: c => c.last_worked_shift ? new Date(c.last_worked_shift).getTime() : null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_worked_shift)}</span> },
  { key: 'number_of_times_worked', header: t('candidates.cols.shifts'), align: 'right', sortable: true,
    sortValue: c => Number(c.number_of_times_worked) || 0,
    render: c => <span style={{ fontSize: 13 }}>{c.number_of_times_worked ?? 0}</span> },
  { key: 'features', header: t('candidates.cols.features'), sortable: true,
    sortValue: c => parseKenmerken(c.features).join(', ') || null,
    render: c => <TagCell items={parseKenmerken(c.features)} color="var(--color-primary)" bg="var(--color-primary-bg)" /> },
  { key: 'global_rate', header: t('candidates.cols.globalRates'), sortable: true,
    render: c => <RateCell candidate={c} /> },
  ]
}

export default function CandidatesTable({ candidates = [], loading = false, statusFilter, setStatusFilter }: {
  candidates?: ReportCandidate[]; loading?: boolean
  // Optional controlled status filter — lets a KPI row above the table drive it
  // (candidates-table page). Uncontrolled default = Actief when not provided.
  statusFilter?: Array<string | number>
  setStatusFilter?: Dispatch<SetStateAction<Array<string | number>>>
}) {
  const { t } = useTranslation('reports')
  const columns = useMemo(() => buildColumns(t), [t])
  const [search, setSearch]                       = useState('')
  const { registerFilters, unregisterFilters }    = useRightPanel()
  const [selectedYears, setSelectedYears]         = useState<Array<string | number>>([])
  const [internalStatuses, setInternalStatuses]   = useState<Array<string | number>>(['actief'])
  const selectedStatuses    = statusFilter ?? internalStatuses
  const setSelectedStatuses = setStatusFilter ?? setInternalStatuses
  const [selectedPositions, setSelectedPositions] = useState<Array<string | number>>([])
  const [selectedKenmerken, setSelectedKenmerken] = useState<Array<string | number>>([])
  const [detail, setDetail]                       = useState<ReportCandidate | null>(null)

  // Build a toggle handler that adds/removes a value from a selected-set state.
  const toggle = (setter: Dispatch<SetStateAction<Array<string | number>>>) => (value: string | number) =>
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const statusOptions = useMemo(() =>
    [...new Set(candidates.map(c => c.status).filter((x): x is string => Boolean(x)))].sort(), [candidates])

  const positionOptions = useMemo(() =>
    [...new Set(candidates.map(c => c.position).filter((x): x is string => Boolean(x)))].sort(), [candidates])

  const yearOptions = useMemo(() => {
    const ys = candidates
      .map(c => c.registration_date ? new Date(c.registration_date).getFullYear() : null)
      .filter((y): y is number => !!y && !isNaN(y))
    return [...new Set(ys)].sort((a, b) => b - a)
  }, [candidates])

  const kenmerkOptions = useMemo(() => {
    const all = candidates.flatMap(c =>
      Array.isArray(c.features) ? c.features.map(f => f.name).filter((x): x is string => Boolean(x)) : []
    )
    return [...new Set(all)].sort()
  }, [candidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter(c => {
      if (selectedStatuses.length  && !selectedStatuses.includes(c.status as string))    return false
      if (selectedPositions.length && !selectedPositions.includes(c.position as string)) return false
      if (selectedYears.length) {
        const y = c.registration_date ? new Date(c.registration_date).getFullYear() : null
        if (!selectedYears.includes(y as number)) return false
      }
      if (selectedKenmerken.length) {
        const cKenmerken = parseKenmerken(c.features)
        if (!selectedKenmerken.some(k => cKenmerken.includes(k as string))) return false
      }
      if (q) {
        const hay = [c.firstname, c.lastname, c.email, c.position, c.city, c.mobile, c.phone]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [candidates, selectedStatuses, selectedPositions, selectedYears, selectedKenmerken, search])

  // Fallback row id: an object-identity map onto the ORIGINAL candidates list so a
  // row without an `id` still gets a stable key, mirroring the old `c.id ?? i`.
  const idIndex = useMemo(() => new Map(candidates.map((c, i) => [c, i])), [candidates])
  const getRowId = (c: ReportCandidate) => c.id ?? idIndex.get(c) ?? 0

  const filterGroups = useMemo(() => [
    { key: 'jaar', label: t('candidates.filters.year'),
      options: yearOptions.map(y => ({ value: y, label: String(y) })),
      selected: selectedYears, onToggle: toggle(setSelectedYears) },
    { key: 'status', label: t('candidates.filters.status'),
      options: statusOptions.map(s => ({ value: s, label: t(`candidates.status.${(s||'').toLowerCase().replace(/\s+/g,'')}`, { defaultValue: s }) })),
      selected: selectedStatuses, onToggle: toggle(setSelectedStatuses) },
    { key: 'functie', label: t('candidates.filters.position'),
      options: positionOptions.map(p => ({ value: p, label: p })),
      selected: selectedPositions, onToggle: toggle(setSelectedPositions) },
    { key: 'kenmerken', label: t('candidates.filters.features'),
      options: kenmerkOptions.map(k => ({ value: k, label: k })),
      selected: selectedKenmerken, onToggle: toggle(setSelectedKenmerken) },
  ], [t, yearOptions, statusOptions, positionOptions, kenmerkOptions,
      selectedYears, selectedStatuses, selectedPositions, selectedKenmerken, setSelectedStatuses])

  useEffect(() => {
    registerFilters('candidates-table', filterGroups)
    return () => unregisterFilters('candidates-table')
  }, [filterGroups, registerFilters, unregisterFilters])


  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('candidates.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('candidates.summary', { shown: filtered.length, total: candidates.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                       transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('candidates.search')}
              style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                       border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={getRowId}
            onRowClick={setDetail}
            loading={loading}
            loadingText={t('candidates.loading')}
            emptyText={t('candidates.empty')}
            defaultSort={{ key: 'name', dir: 'asc' }}
            stickyHeader
          />
        </div>

      </div>

      {detail && (
        <CandidateDetailDrawer candidate={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
