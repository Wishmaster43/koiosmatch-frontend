/**
 * CandidatesReport — candidates analytics report with several charts.
 * Filters are pushed to the layout via RightPanelContext (no own filter button
 * or inline sidebar). KPI targets come from useKpiSettings.
 */
import { useState, useEffect, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import { useKpiSettings } from '../../lib/useKpiSettings'
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

// Kleurenconfiguratie
const LOGIN_COLORS = ['#0064d2','#3b82f6','#93c5fd','#FDE68A','#FCA5A5','#EF4444','#F97316','#D1D5DB']
const MONTH_COLOR  = '#534AB7'
const SAP_BLUE     = '#0064d2' // Toegepast als primaire huiskleur
const END_COLOR    = '#EF4444'

const STATUS_META = {
  actief:'Actief', nietactief:'Niet actief', extern:'Extern',
  intake:'Intake', verwijderd:'Verwijderd', onbekend:'Onbekend',
}

const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

function getWeekNumber(date) {
  const d     = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day   = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - start) / 86400000) + 1) / 7)
}

export default function CandidatesReport() {
  const { candidates_per_page, top_cities_n } = useKpiSettings()
  // ── Data & filter state ───────────────────────────────────────────────────
  const [candidates,          setCandidates]          = useState([])
  const [selectedStatuses,    setSelectedStatuses]    = useState(['actief'])
  const [selectedStatusesDEL, setSelectedStatusesDEL] = useState(['verwijderd']) 
  const [selectedPositions,   setSelectedPositions]   = useState([])
  const [selectedYear,        setSelectedYear]        = useState(new Date().getFullYear())
  const [showPercent,         setShowPercent]         = useState(false)
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState(null)
  const [drillDown,           setDrillDown]           = useState(null)

  // Registreert filterGroups in de rechter sidebar via context
  const { registerFilters, unregisterFilters } = useRightPanel()

  // ── Data ophalen ──────────────────────────────────────────────────────────
  const fetchCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await api.get(`/candidates?per_page=${candidates_per_page}`)
      const body = res.data
      setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
    } catch {
      setError('Kon kandidaten niet laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCandidates() }, [])

  // ── Gefilterde datasets ───────────────────────────────────────────────────
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
  const positionData   = toChartData(groupAndCount(filteredGeneral, c => c.position))
  const loginData      = toChartData(groupAndCount(filteredGeneral, c => getLoginGroup(c.last_login_at)), LOGIN_GROUP_ORDER)
  const monthData      = groupByMonth(filteredGeneral, selectedYear)
  const weekData       = groupByWeek(filteredGeneral, selectedYear)
  const endMonthData   = groupByMonth(filteredDeleted, selectedYear, 'end_date_employment')
  const endWeekData    = groupByWeek(filteredDeleted, selectedYear, 'end_date_employment')
  const cityData       = topN(filteredGeneral, c => c.city || 'Onbekend', top_cities_n)
  
  // FIX: useMemo voorkomt dat er bij elke render een nieuwe array-referentie ontstaat
  const availableYears = useMemo(() => getAvailableYears(candidates), [candidates])

  // ── Drill-down helpers ────────────────────────────────────────────────────
  const openDrillDown = (title, subtitle, items) =>
    setDrillDown({ title, subtitle, candidates: items })

  const handlePositionDrillDown  = (data) => openDrillDown(data.name, 'Functie',
    filteredGeneral.filter(c => (c.position || 'Onbekend') === data.name))

  const handleLoginDrillDown = (data) => openDrillDown(data.name, 'Laatste inlog',
    filteredGeneral.filter(c => getLoginGroup(c.last_login_at) === data.name))

  const handleMonthDrillDown = (data) => {
    const monthName = data.name || data.payload?.name
    openDrillDown(monthName, 'Registratie maand', filteredGeneral.filter(c => {
      if (!c.registration_date) return false
      const date = new Date(c.registration_date)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return MONTHS_NL[date.getMonth()] === monthName
    }))
  }

  const handleWeekDrillDown = (data) => {
    const label = data.name || data.payload?.name
    openDrillDown(label, 'Registratie week', filteredGeneral.filter(c => {
      if (!c.registration_date) return false
      const date = new Date(c.registration_date)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return `W${getWeekNumber(date)}` === label
    }))
  }

  const handleCityDrillDown = (data) => openDrillDown(data.name, 'Woonplaats',
    filteredGeneral.filter(c => (c.city || 'Onbekend') === data.name))

  const handleEndMonthDrillDown = (data) => {
    const monthName = data.name || data.payload?.name
    openDrillDown(monthName, 'Uitgeschreven maand', filteredDeleted.filter(c => {
      if (!c.end_date_employment) return false
      const date = new Date(c.end_date_employment)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return MONTHS_NL[date.getMonth()] === monthName
    }))
  }

  const handleEndWeekDrillDown = (data) => {
    const label = data.name || data.payload?.name
    openDrillDown(label, 'Uitgeschreven week', filteredDeleted.filter(c => {
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
      key: 'weergave', label: 'Weergave',
      type: 'radio',
      selected: [showPercent ? 'percent' : 'number'],
      options: [
        { value: 'number',  label: 'Getallen' },
        { value: 'percent', label: 'Percentages' },
      ],
      onToggle: v => setShowPercent(v === 'percent'),
    },
    {
      key: 'year', label: 'Jaar',
      selected: selectedYear ? [String(selectedYear)] : [],
      onToggle: v => setSelectedYear(prev => String(prev) === v ? null : parseInt(v)),
      options: availableYears.map(y => ({
        value: String(y), label: String(y),
        count: candidates.filter(c =>
          c.registration_date && new Date(c.registration_date).getFullYear() === y
        ).length,
      })),
    },
    {
      key: 'status', label: 'Status',
      selected: selectedStatuses,
      onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(s => s !== v) : [...p, v]),
      options: allStatuses.map(s => ({
        value: s, label: STATUS_META[s] ?? s,
        count: candidates.filter(c => (c.status||'onbekend').toLowerCase() === s).length,
      })),
    },
    {
      key: 'position', label: 'Functie',
      selected: selectedPositions,
      onToggle: v => setSelectedPositions(p => p.includes(v) ? p.filter(s => s !== v) : [...p, v]),
      options: allPositions.map(p => ({
        value: p, label: p,
        count: candidates.filter(c => (c.position||'Onbekend') === p).length,
      })),
    },
  ], [showPercent, selectedYear, selectedStatuses, selectedPositions, allStatuses, allPositions, availableYears, candidates])

  useEffect(() => {
    registerFilters('candidates-analysis', filterGroups)
    return () => unregisterFilters('candidates-analysis')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div>
      {/* ── Pagina-header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', flexShrink: 0 }}>
          Kandidaten rapport
        </h2>
        {!loading && (
          <>
            <div style={{ width: 1, height: 18, background: '#E5E7EB', flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F0FDF4', color: '#16A34A', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                {filteredGeneral.length} actief
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#FEF2F2', color: '#DC2626', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
                {filteredDeleted.length} uitgeschreven
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                             background: '#F9FAFB', color: '#6B7280', borderRadius: 999,
                             padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                {candidates.length} totaal
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── KPI rij ────────────────────────────────────────────────────────────── */}
      <CandidatesKpiRow
        candidates={candidates}
        loading={loading}
        onDrillDown={(title, items) => openDrillDown(title, 'KPI', items)}
      />

      {error && (
        <div className="px-4 py-3 mb-6 text-sm text-red-600 border border-red-200 rounded-xl bg-red-50">
          {error}
        </div>
      )}

      {/* Grid Layout voor de Kaarten */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white border border-gray-100 shadow-sm rounded-xl">
          <RefreshCw size={20} className="text-gray-300 animate-spin" />
          <p className="text-sm text-gray-400">Kandidaten ophalen...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* Kaart 1: Per Functie */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <PieChartCard title="Per functie" data={positionData} showPercent={showPercent} size={260} onItemClick={handlePositionDrillDown} />
          </div>

          {/* Kaart 2: Laatste Inlog */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <BarChartCard title="Laatste inlog" data={loginData} showPercent={showPercent} colors={LOGIN_COLORS} height={260} onBarClick={handleLoginDrillDown} />
          </div>

          {/* Kaart 3: Nieuwe kandidaten per maand — tijdreeks, geen % */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <BarChartCard
              title={`Nieuwe kandidaten per maand${selectedYear ? ` (${selectedYear})` : ''}`}
              data={monthData} colors={[MONTH_COLOR]} height={260}
              onBarClick={handleMonthDrillDown} showAverage
            />
          </div>

          {/* Kaart 4: Nieuwe kandidaten per week — tijdreeks, geen % */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <LineChartCard
              title={`Nieuwe kandidaten per week${selectedYear ? ` (${selectedYear})` : ''}`}
              data={weekData} color={MONTH_COLOR} height={260}
              onItemClick={handleWeekDrillDown}
            />
          </div>

          {/* Kaart 5: Uitgeschreven per maand — tijdreeks, geen % */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <BarChartCard
              title={`Uitgeschreven per maand${selectedYear ? ` (${selectedYear})` : ''}`}
              data={endMonthData} colors={['#FCA5A5']} height={260}
              onBarClick={handleEndMonthDrillDown} showAverage
            />
          </div>

          {/* Kaart 6: Uitgeschreven per week — tijdreeks, geen % */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <LineChartCard
              title={`Uitgeschreven per week${selectedYear ? ` (${selectedYear})` : ''}`}
              data={endWeekData} color={END_COLOR} height={260}
              onItemClick={handleEndWeekDrillDown}
            />
          </div>

          {/* Kaart 7: Top 10 woonplaatsen (Volledige breedte) */}
          <div className="min-w-0 p-6 bg-white border border-gray-100 shadow-sm rounded-xl lg:col-span-2">
            <BarChartCard
              title={`Top ${top_cities_n} woonplaatsen`}
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
