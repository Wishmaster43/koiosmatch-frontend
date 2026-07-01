import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import MatchesTable from './MatchesTable'
import PaginationBar from '@/components/ui/PaginationBar'
import type { RawMatch, MatchRow } from '@/types/match'

// Map a raw API match → the flat shape the table renders (snake_case-tolerant).
function mapMatch(m: RawMatch): MatchRow {
  const cand = m.candidate ?? {}
  const joined = [cand.first_name, cand.last_name].filter(Boolean).join(' ')
  const name = m.candidate_name ?? cand.name ?? (joined || '—')
  return {
    id:         m.id,
    candidate:  name,
    initials:   name && name !== '—' ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?',
    vacancy:    m.vacancy_title ?? m.vacancy?.title ?? '—',
    client:     m.client_name ?? m.client?.name ?? m.customer?.name ?? '—',
    score:      m.score ?? m.match_score ?? null,
    stage:      m.stage_label ?? m.stage ?? m.status ?? '',
    stageColor: m.stage_color ?? '#6E8FD6',
    owner:      m.owner?.name ?? m.owner_name ?? '',
    date:       m.created_at ?? m.matched_at ?? '',
  }
}

// MatchesPage — loads matches, shows an insights strip and paginates the table.
export default function MatchesPage() {
  const { t } = useTranslation('matches')
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth() ?? {}
  const [rows,        setRows]        = useState<MatchRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(() => user?.default_per_page ?? 50)
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [ownerFilter, setOwnerFilter] = useState<string[]>([])

  // Load matches; a missing endpoint (404) is an empty list, not an error.
  useEffect(() => {
    let alive = true
    api.get('/matches')
      .then(r => { if (alive) setRows((r.data?.data ?? r.data ?? []).map(mapMatch)) })
      .catch(e => { if (alive && e?.response?.status && e.response.status !== 404) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Donut click: toggle one value (second click clears).
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
    const dd = d as { key?: string; payload?: { key?: string }; name?: string }
    const v = dd?.key ?? dd?.payload?.key ?? dd?.name
    if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
  }

  // Aggregate stage data for the donut.
  const stageData = useMemo(() => {
    const m: Record<string, { name: string; key: string; color: string; value: number }> = {}
    rows.forEach(r => { if (r.stage) (m[r.stage] ??= { name: r.stage, key: r.stage, color: r.stageColor, value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  const ownerData = useMemo(() => {
    const m: Record<string, { name: string; key: string; color: string; value: number }> = {}
    rows.forEach(r => { if (r.owner) (m[r.owner] ??= { name: r.owner, key: r.owner, color: '#6B7280', value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  // Reset to the first page whenever a filter changes (kept out of the memo —
  // setting state during render can loop).
  useEffect(() => { setPage(1) }, [stageFilter, ownerFilter])

  // Filter the visible rows by donut selection.
  const filteredAll = useMemo(() => {
    return rows.filter(r => {
      if (stageFilter.length && !stageFilter.includes(r.stage)) return false
      if (ownerFilter.length && !ownerFilter.includes(r.owner)) return false
      return true
    })
  }, [rows, stageFilter, ownerFilter])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const paged     = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

  // KPI: count active (non-rejected/non-done) and hired matches.
  const activeCount = rows.filter(r => !['rejected', 'closed'].includes(r.stage?.toLowerCase())).length
  const hiredCount  = rows.filter(r => ['hired', 'aangenomen'].includes(r.stage?.toLowerCase())).length
  const avgScore    = rows.length ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.length) : null

  // Donuts drive the stage/owner filters; each clears its own selection.
  const insightDonuts: DonutSpec[] = [
    { key: 'stage', title: t('insights.stage'), data: stageData, onPick: pickOne(setStageFilter),
      active: stageFilter.length > 0, onClear: () => setStageFilter([]) },
    { key: 'owner', title: t('insights.owner'), data: ownerData, onPick: pickOne(setOwnerFilter),
      active: ownerFilter.length > 0, onClear: () => setOwnerFilter([]) },
  ]

  const insightKpis: KpiSpec[] = [
    { key: 'total',    label: t('kpi.total'),    value: rows.length, color: 'var(--color-primary)' },
    { key: 'active',   label: t('kpi.active'),   value: activeCount, color: 'var(--color-primary)' },
    { key: 'hired',    label: t('kpi.hired'),    value: hiredCount,  color: 'var(--color-success)' },
    { key: 'avgScore', label: t('kpi.avgScore'), value: avgScore != null ? `${avgScore}%` : '—', color: 'var(--color-primary)' },
  ]

  const [addTooltip, setAddTooltip] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Insights strip — donuts + KPI cards */}
      <InsightsRow
        donuts={insightDonuts}
        kpis={insightKpis}
        clearTitle={t('insights.clearFilter')}
      />

      {/* Toolbar — add button right-aligned */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px 10px', flexShrink: 0 }}>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          {/* Match creation flows from the candidate or vacancy drawer; this button hints at that. */}
          <button
            onClick={() => setAddTooltip(v => !v)}
            onBlur={() => setTimeout(() => setAddTooltip(false), 150)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13,
              fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--color-primary)', color: '#fff' }}>
            <Plus size={15} aria-hidden="true" /> {t('add')}
          </button>
          {addTooltip && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 20,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
              {t('addComingSoon')}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
        <MatchesTable rows={paged} loading={loading} error={error} stickyHeader scrollParentRef={tableScrollRef} />
      </div>

      <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
        pageSize={pageSize} onPageChange={setPage}
        onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
    </div>
  )
}
