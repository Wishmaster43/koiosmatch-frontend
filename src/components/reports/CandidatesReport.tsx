/**
 * CandidatesReport — candidates analytics report with several charts.
 * Filters are pushed to the layout via RightPanelContext (no own filter button
 * or inline sidebar). KPI targets come from useKpiSettings.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { useKpiSettings } from '../../lib/useKpiSettings'
import type { ReportCandidate } from '../../types/reports'
import type { ChartDatum } from '../charts/chartTypes'
import {
  getLoginGroup, LOGIN_GROUP_ORDER,
  groupAndCount, toChartData,
  groupByMonth, groupByWeek, getAvailableYears, topN,
} from '../../lib/chartHelpers'
import PieChartCard        from '../charts/PieChartCard'
import BarChartCard        from '../charts/BarChartCard'
import LineChartCard       from '../charts/LineChartCard'
import CandidatesKpiRow    from './CandidatesKpiRow'
import DrillDownDrawer     from './DrillDownDrawer'
import { useRightPanel }   from '../../context/RightPanelContext'

// Chart color configuration
const LOGIN_COLORS = ['#0064d2','#3b82f6','#93c5fd','#FDE68A','#FCA5A5','var(--color-danger)','#F97316','#D1D5DB']
const MONTH_COLOR  = 'var(--color-primary)'
const SAP_BLUE     = '#0064d2' // Used as the primary house color
const END_COLOR    = 'var(--color-danger)'

// Month labels used to match chart bars back to candidates in drill-downs
// (must mirror the labels chartHelpers.groupByMonth produces).
const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

function getWeekNumber(date: Date) {
  const d     = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day   = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - start.getTime()) / 86400000) + 1) / 7)
}

export default function CandidatesReport() {
  const { t } = useTranslation('reports')
  const { candidates_per_page, top_cities_n } = useKpiSettings()
  // ── Data & filter state ───────────────────────────────────────────────────
  const [candidates,          setCandidates]          = useState<ReportCandidate[]>([])
  const [selectedStatuses,    setSelectedStatuses]    = useState<string[]>(['actief'])
  const [selectedStatusesDEL] = useState<string[]>(['verwijderd'])
  const [selectedPositions,   setSelectedPositions]   = useState<string[]>([])
  const [selectedYear,        setSelectedYear]        = useState<number | null>(new Date().getFullYear())
  const [showPercent,         setShowPercent]         = useState(false)
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState<string | null>(null)
  const [drillDown,           setDrillDown]           = useState<{ title: string; subtitle: string; candidates: ReportCandidate[] } | null>(null)

  // Registers filterGroups in the right sidebar via context
  const { registerFilters, unregisterFilters } = useRightPanel()

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await api.get(`/sm_candidates?per_page=${candidates_per_page}`)
      const body = res.data
      setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
    } catch {
      setError(t('report.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCandidates() }, [])

  // ── Filtered datasets ─────────────────────────────────────────────────────
  const baseFiltered = candidates.filter(c => {
    const p = c.position || 'Onbekend'
    return selectedPositions.length === 0 || selectedPositions.includes(p)
  })

  const filteredGeneral = baseFiltered.filter(c => {
    const s = (c.status || 'onbekend').toLowerCase()
    return selectedStatuses.length === 0 || selectedStatuses.includes(s)
  })

  const filteredDeleted = baseFiltered.filter(c => {
    const s = (c.status || 'onbekend').toLowerCase()
    return selectedStatusesDEL.length === 0 || selectedStatusesDEL.includes(s)
  })

  // ── Chart data ────────────────────────────────────────────────────────────
  // chartHelpers returns its own {name,value} shape; cast to the charts' ChartDatum (adds the recharts index signature).
  const positionData   = toChartData(groupAndCount(filteredGeneral, c => c.position)) as ChartDatum[]
  const loginData      = toChartData(groupAndCount(filteredGeneral, c => getLoginGroup(c.last_login_at)), LOGIN_GROUP_ORDER) as ChartDatum[]
  const monthData      = groupByMonth(filteredGeneral, selectedYear) as ChartDatum[]
  const weekData       = groupByWeek(filteredGeneral, selectedYear) as ChartDatum[]
  const endMonthData   = groupByMonth(filteredDeleted, selectedYear, 'end_date_employment') as ChartDatum[]
  const endWeekData    = groupByWeek(filteredDeleted, selectedYear, 'end_date_employment') as ChartDatum[]
  const cityData       = topN(filteredGeneral, c => (c.city as string) || 'Onbekend', top_cities_n) as ChartDatum[]
  
  // useMemo prevents a new array reference on every render
  const availableYears = useMemo(() => getAvailableYears(candidates), [candidates])

  // ── Drill-down helpers ────────────────────────────────────────────────────
  const openDrillDown = (title: string, subtitle: string, items: ReportCandidate[]) =>
    setDrillDown({ title, subtitle, candidates: items })

  const handlePositionDrillDown  = (data: unknown) => { const name = (data as ChartDatum).name; openDrillDown(name, t('report.sub.position'),
    filteredGeneral.filter(c => (c.position || 'Onbekend') === name)) }

  const handleLoginDrillDown = (data: unknown) => { const name = (data as ChartDatum).name; openDrillDown(name, t('report.sub.lastLogin'),
    filteredGeneral.filter(c => getLoginGroup(c.last_login_at) === name)) }

  const handleMonthDrillDown = (data: unknown) => {
    const monthName = ((data as ChartDatum).name || (data as { payload?: { name?: string } }).payload?.name) ?? ''
    openDrillDown(monthName, t('report.sub.regMonth'), filteredGeneral.filter(c => {
      if (!c.registration_date) return false
      const date = new Date(c.registration_date)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return MONTHS_NL[date.getMonth()] === monthName
    }))
  }

  const handleWeekDrillDown = (data: unknown) => {
    const label = ((data as ChartDatum).name || (data as { payload?: { name?: string } }).payload?.name) ?? ''
    openDrillDown(label, t('report.sub.regWeek'), filteredGeneral.filter(c => {
      if (!c.registration_date) return false
      const date = new Date(c.registration_date)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return `W${getWeekNumber(date)}` === label
    }))
  }

  const handleCityDrillDown = (data: unknown) => { const name = (data as ChartDatum).name; openDrillDown(name, t('report.sub.city'),
    filteredGeneral.filter(c => (c.city || 'Onbekend') === name)) }

  const handleEndMonthDrillDown = (data: unknown) => {
    const monthName = ((data as ChartDatum).name || (data as { payload?: { name?: string } }).payload?.name) ?? ''
    openDrillDown(monthName, t('report.sub.endMonth'), filteredDeleted.filter(c => {
      if (!c.end_date_employment) return false
      const date = new Date(c.end_date_employment)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return MONTHS_NL[date.getMonth()] === monthName
    }))
  }

  const handleEndWeekDrillDown = (data: unknown) => {
    const label = ((data as ChartDatum).name || (data as { payload?: { name?: string } }).payload?.name) ?? ''
    openDrillDown(label, t('report.sub.endWeek'), filteredDeleted.filter(c => {
      if (!c.end_date_employment) return false
      const date = new Date(c.end_date_employment)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return `W${getWeekNumber(date)}` === label
    }))
  }

  // ── Filter groups ─────────────────────────────────────────────────────────
  const allStatuses  = useMemo(() =>
    [...new Set(candidates.map(c => (c.status||'onbekend').toLowerCase()))].sort(),
    [candidates])

  const allPositions = useMemo(() =>
    [...new Set(candidates.map(c => c.position||'Onbekend'))].sort(),
    [candidates])

  const filterGroups = useMemo(() => [
    {
      key: 'weergave', label: t('report.filters.view'),
      type: 'radio',
      selected: [showPercent ? 'percent' : 'number'],
      options: [
        { value: 'number',  label: t('report.filters.numbers') },
        { value: 'percent', label: t('report.filters.percentages') },
      ],
      onToggle: (v: string) => setShowPercent(v === 'percent'),
    },
    {
      key: 'year', label: t('report.filters.year'),
      selected: selectedYear ? [String(selectedYear)] : [],
      onToggle: (v: string) => setSelectedYear(prev => String(prev) === v ? null : parseInt(v)),
      options: availableYears.map(y => ({
        value: String(y), label: String(y),
        count: candidates.filter(c =>
          c.registration_date && new Date(c.registration_date).getFullYear() === y
        ).length,
      })),
    },
    {
      key: 'status', label: t('report.filters.status'),
      selected: selectedStatuses,
      onToggle: (v: string) => setSelectedStatuses(p => p.includes(v) ? p.filter(s => s !== v) : [...p, v]),
      options: allStatuses.map(s => ({
        value: s, label: t(`candidates.status.${s}`, { defaultValue: s }),
        count: candidates.filter(c => (c.status||'onbekend').toLowerCase() === s).length,
      })),
    },
    {
      key: 'position', label: t('report.filters.position'),
      selected: selectedPositions,
      onToggle: (v: string) => setSelectedPositions(p => p.includes(v) ? p.filter(s => s !== v) : [...p, v]),
      options: allPositions.map(p => ({
        value: p, label: p,
        count: candidates.filter(c => (c.position||'Onbekend') === p).length,
      })),
    },
  ], [t, showPercent, selectedYear, selectedStatuses, selectedPositions, allStatuses, allPositions, availableYears, candidates])

  useEffect(() => {
    registerFilters('candidates-analysis', filterGroups)
    return () => unregisterFilters('candidates-analysis')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', flexShrink: 0 }}>
          {t('report.title')}
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
                {filteredGeneral.length} {t('report.activeWord')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)', flexShrink: 0 }} />
                {filteredDeleted.length} {t('report.deregisteredWord')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: 'var(--hover-bg)', color: 'var(--text-muted)', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                {candidates.length} {t('report.totalWord')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────────────── */}
      <CandidatesKpiRow
        candidates={candidates}
        loading={loading}
        onDrillDown={(title, items) => openDrillDown(title, t('report.sub.kpi'), items)}
      />

      {error && <ErrorBanner style={{ marginBottom: 24 }}>{error}</ErrorBanner>}

      {/* Grid layout for the cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
          <RefreshCw size={20} className="text-[var(--text-muted)] animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">{t('candidates.loading')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Card 1: By position */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
            <PieChartCard title={t('report.charts.perPosition')} data={positionData} showPercent={showPercent} size={260} unit={t('report.unitCandidates')} onItemClick={handlePositionDrillDown} />
          </div>

          {/* Card 2: Last login */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
            <BarChartCard title={t('report.charts.lastLogin')} data={loginData} showPercent={showPercent} colors={LOGIN_COLORS} height={260} onBarClick={handleLoginDrillDown} />
          </div>

          {/* Card 3: New candidates per month — time series, no % */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
            <BarChartCard
              title={`${t('report.charts.newPerMonth')}${selectedYear ? ` (${selectedYear})` : ''}`}
              data={monthData} colors={[MONTH_COLOR]} height={260}
              onBarClick={handleMonthDrillDown} showAverage
            />
          </div>

          {/* Card 4: New candidates per week — time series, no % */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
            <LineChartCard
              title={`${t('report.charts.newPerWeek')}${selectedYear ? ` (${selectedYear})` : ''}`}
              data={weekData} color={MONTH_COLOR} height={260}
              unit={t('common:units.candidates')}
              onItemClick={handleWeekDrillDown}
            />
          </div>

          {/* Card 5: Deregistered per month — time series, no % */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
            <BarChartCard
              title={`${t('report.charts.endPerMonth')}${selectedYear ? ` (${selectedYear})` : ''}`}
              data={endMonthData} colors={['#FCA5A5']} height={260}
              onBarClick={handleEndMonthDrillDown} showAverage
            />
          </div>

          {/* Card 6: Deregistered per week — time series, no % */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl">
            <LineChartCard
              title={`${t('report.charts.endPerWeek')}${selectedYear ? ` (${selectedYear})` : ''}`}
              data={endWeekData} color={END_COLOR} height={260}
              unit={t('common:units.candidates')}
              onItemClick={handleEndWeekDrillDown}
            />
          </div>

          {/* Card 7: Top cities (full width) */}
          <div className="min-w-0 p-6 bg-[var(--surface)] border border-gray-100 shadow-sm rounded-xl lg:col-span-2">
            <BarChartCard
              title={t('report.charts.topCities', { n: top_cities_n })}
              data={cityData} colors={[SAP_BLUE]} height={260}
              onBarClick={handleCityDrillDown}
            />
          </div>

        </div>
      )}

      {/* Drill-down drawer */}
      {drillDown && (
        <DrillDownDrawer
          title={drillDown.title}
          subtitle={drillDown.subtitle}
          candidates={drillDown.candidates}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  )
}
