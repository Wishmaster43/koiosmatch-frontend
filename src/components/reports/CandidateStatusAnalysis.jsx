import { useState, useEffect } from 'react'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import api from '../../lib/api'
import {
  getLoginGroup, LOGIN_GROUP_ORDER,
  groupAndCount, toChartData,
  groupByMonth, groupByWeek, getAvailableYears, topN,
} from '../../lib/chartHelpers'
import PieChartCard        from '../charts/PieChartCard'
import BarChartCard        from '../charts/BarChartCard'
import LineChartCard       from '../charts/LineChartCard'
import CandidatesKpiRow    from './CandidatesKpiRow'
import ReportFilterSidebar from './ReportFilterSidebar'
import DrillDownDrawer     from './DrillDownDrawer'

const LOGIN_COLORS = ['#86EFAC','#4ADE80','#BBF7D0','#FDE68A','#FCA5A5','#EF4444','#F97316','#D1D5DB']
const MONTH_COLOR  = '#534AB7'
const CITY_COLOR   = '#86EFAC'
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

export default function CandidateStatusAnalysis() {
  const [candidates,          setCandidates]          = useState([])
  const [selectedStatuses,    setSelectedStatuses]    = useState(['actief'])
  const [selectedStatusesDEL, setSelectedStatusesDEL] = useState(['verwijderd'])  // verborgen, later via instellingen
  const [selectedPositions,   setSelectedPositions]   = useState([])
  const [selectedYear,        setSelectedYear]        = useState(2026)
  const [showPercent,         setShowPercent]         = useState(false)
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState(null)
  const [filterOpen,          setFilterOpen]          = useState(false)
  const [drillDown,           setDrillDown]           = useState(null)

  const fetchCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await api.get('/candidates?per_page=500')
      const body = res.data
      setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
    } catch {
      setError('Kon kandidaten niet laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCandidates() }, [])

  // ── Filters ───────────────────────────────────────────────────────────────────

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

  // ── Chart data ────────────────────────────────────────────────────────────────

  const positionData   = toChartData(groupAndCount(filteredGeneral, c => c.position))
  const loginData      = toChartData(groupAndCount(filteredGeneral, c => getLoginGroup(c.last_login_at)), LOGIN_GROUP_ORDER)
  const monthData      = groupByMonth(filteredGeneral, selectedYear)
  const weekData       = groupByWeek(filteredGeneral, selectedYear)
  const endMonthData   = groupByMonth(filteredDeleted, selectedYear, 'end_date_employment')
  const endWeekData    = groupByWeek(filteredDeleted, selectedYear, 'end_date_employment')
  const cityData       = topN(filteredGeneral, c => c.city || 'Onbekend', 10)
  const availableYears = getAvailableYears(candidates)

  // ── Drill-down handlers ───────────────────────────────────────────────────────

  const openDrillDown = (title, subtitle, items) =>
    setDrillDown({ title, subtitle, candidates: items })

  const handlePositionDrillDown = (data) => {
    const items = filteredGeneral.filter(c => (c.position || 'Onbekend') === data.name)
    openDrillDown(data.name, 'Functie', items)
  }

  const handleLoginDrillDown = (data) => {
    const items = filteredGeneral.filter(c => getLoginGroup(c.last_login_at) === data.name)
    openDrillDown(data.name, 'Laatste inlog', items)
  }

  const handleMonthDrillDown = (data) => {
    const monthName = data.name || data.payload?.name
    const items = filteredGeneral.filter(c => {
      if (!c.registration_date) return false
      const date = new Date(c.registration_date)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return MONTHS_NL[date.getMonth()] === monthName
    })
    openDrillDown(monthName, 'Registratie maand', items)
  }

  const handleWeekDrillDown = (data) => {
    const label = data.name || data.payload?.name
    const items = filteredGeneral.filter(c => {
      if (!c.registration_date) return false
      const date = new Date(c.registration_date)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return `W${getWeekNumber(date)}` === label
    })
    openDrillDown(label, 'Registratie week', items)
  }

  const handleCityDrillDown = (data) => {
    const items = filteredGeneral.filter(c => (c.city || 'Onbekend') === data.name)
    openDrillDown(data.name, 'Woonplaats', items)
  }

  const handleEndMonthDrillDown = (data) => {
    const monthName = data.name || data.payload?.name
    const items = filteredDeleted.filter(c => {
      if (!c.end_date_employment) return false
      const date = new Date(c.end_date_employment)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return MONTHS_NL[date.getMonth()] === monthName
    })
    openDrillDown(monthName, 'Uitgeschreven maand', items)
  }

  const handleEndWeekDrillDown = (data) => {
    const label = data.name || data.payload?.name
    const items = filteredDeleted.filter(c => {
      if (!c.end_date_employment) return false
      const date = new Date(c.end_date_employment)
      if (selectedYear && date.getFullYear() !== selectedYear) return false
      return `W${getWeekNumber(date)}` === label
    })
    openDrillDown(label, 'Uitgeschreven week', items)
  }

  // ── Filter groepen (status_del verborgen) ─────────────────────────────────────

  const allStatuses  = [...new Set(candidates.map(c => (c.status||'onbekend').toLowerCase()))].sort()
  const allPositions = [...new Set(candidates.map(c => c.position||'Onbekend'))].sort()

  const filterGroups = [
    {
      key: 'year', label: 'Jaar',
      selected: selectedYear ? [String(selectedYear)] : [],
      onToggle: v => setSelectedYear(prev => String(prev) === v ? null : parseInt(v)),
      options: availableYears.map(y => ({
        value: String(y), label: String(y),
        count: candidates.filter(c => c.registration_date && new Date(c.registration_date).getFullYear() === y).length,
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
  ]

  const activeFilterCount = selectedStatuses.length + selectedPositions.length + (selectedYear ? 1 : 0)

  return (
    <div>
      <CandidatesKpiRow
        candidates={candidates}
        loading={loading}
        onDrillDown={(title, items) => openDrillDown(title, 'KPI', items)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Kandidaten analyse</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? 'Laden...' : `${filteredGeneral.length} actieve · ${filteredDeleted.length} uitgeschreven`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{ background:'#F3F4F6', border:'1px solid #E5E7EB' }}>
            {[{id:false,label:'Getallen'},{id:true,label:'Percentages'}].map(opt => (
              <button key={String(opt.id)} onClick={() => setShowPercent(opt.id)}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: showPercent===opt.id ? 'white':'transparent',
                  color:      showPercent===opt.id ? '#111827':'#6B7280',
                  border:     showPercent===opt.id ? '1px solid #E5E7EB':'1px solid transparent',
                  cursor:'pointer',
                  boxShadow:  showPercent===opt.id ? '0 1px 3px rgba(0,0,0,0.08)':'none',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          <button onClick={fetchCandidates} disabled={loading}
            className="flex items-center justify-center rounded-lg"
            style={{ width:32, height:32, background:'#F9FAFB', border:'1px solid #E5E7EB', cursor:'pointer', color:'#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.color='#374151')}
            onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          <button onClick={() => setFilterOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: filterOpen ? 'var(--color-primary-bg)':'#F9FAFB',
              color:      filterOpen ? 'var(--color-primary)':'#6B7280',
              border:     `1px solid ${filterOpen ? 'var(--color-primary)':'#E5E7EB'}`,
              cursor:'pointer',
            }}>
            <SlidersHorizontal size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full px-1.5 font-mono"
                style={{ fontSize:10, background:'var(--color-primary)', color:'white' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-4 text-sm text-red-600 rounded-xl bg-red-50"
          style={{ border:'1px solid #FECACA' }}>{error}</div>
      )}

      {/* Charts + sidebar */}
      <div className="flex items-stretch gap-4">
        <div className="flex flex-col flex-1 min-w-0 gap-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl"
              style={{ border:'1px solid #F3F4F6' }}>
              <RefreshCw size={20} className="animate-spin" style={{ color:'#D1D5DB' }} />
              <p className="text-sm text-gray-400">Kandidaten ophalen...</p>
            </div>
          ) : (
            <>
              {/* Rij 1: Pie + Inlog */}
              <div className="flex overflow-hidden bg-white rounded-xl"
                style={{ border:'1px solid #F3F4F6' }}>
                <div className="flex-1 min-w-0 p-6" style={{ borderRight:'1px solid #F9FAFB' }}>
                  <PieChartCard title="Per functie" data={positionData} showPercent={showPercent} size={260} onItemClick={handlePositionDrillDown} />
                </div>
                <div className="flex-1 min-w-0 p-6">
                  <BarChartCard title="Laatste inlog" data={loginData} showPercent={showPercent} colors={LOGIN_COLORS} height={260} onBarClick={handleLoginDrillDown} />
                </div>
              </div>

              {/* Rij 2: Nieuwe kandidaten maand + week */}
              <div className="flex overflow-hidden bg-white rounded-xl"
                style={{ border:'1px solid #F3F4F6' }}>
                <div className="flex-1 min-w-0 p-6" style={{ borderRight:'1px solid #F9FAFB' }}>
                  <BarChartCard
                    title={`Nieuwe kandidaten per maand${selectedYear ? ` (${selectedYear})` : ''}`}
                    data={monthData} colors={[MONTH_COLOR]} height={260}
                    onBarClick={handleMonthDrillDown} showAverage
                  />
                </div>
                <div className="flex-1 min-w-0 p-6">
                  <LineChartCard
                    title={`Nieuwe kandidaten per week${selectedYear ? ` (${selectedYear})` : ''}`}
                    data={weekData} color={MONTH_COLOR} height={260}
                    onItemClick={handleWeekDrillDown}
                  />
                </div>
              </div>

              {/* Rij 3: Uitgeschreven per maand + week */}
              <div className="flex overflow-hidden bg-white rounded-xl"
                style={{ border:'1px solid #F3F4F6' }}>
                <div className="flex-1 min-w-0 p-6" style={{ borderRight:'1px solid #F9FAFB' }}>
                  <BarChartCard
                    title={`Uitgeschreven per maand${selectedYear ? ` (${selectedYear})` : ''}`}
                    data={endMonthData} colors={['#FCA5A5']} height={260}
                    onBarClick={handleEndMonthDrillDown} showAverage
                  />
                </div>
                <div className="flex-1 min-w-0 p-6">
                  <LineChartCard
                    title={`Uitgeschreven per week${selectedYear ? ` (${selectedYear})` : ''}`}
                    data={endWeekData} color={END_COLOR} height={260}
                    onItemClick={handleEndWeekDrillDown}
                  />
                </div>
              </div>

              {/* Rij 4: Top 10 woonplaatsen */}
              <div className="flex overflow-hidden bg-white rounded-xl"
                style={{ border:'1px solid #F3F4F6' }}>
                <div className="flex-1 min-w-0 p-6">
                  <BarChartCard
                    title="Top 10 woonplaatsen"
                    data={cityData} colors={[CITY_COLOR]} height={260}
                    onBarClick={handleCityDrillDown}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Filter sidebar */}
        {filterOpen && (
          <div className="flex-shrink-0 overflow-hidden bg-white rounded-xl"
            style={{ width:220, border:'1px solid #F3F4F6' }}>
            <ReportFilterSidebar title="Filters" groups={filterGroups} onClose={() => setFilterOpen(false)} />
          </div>
        )}
      </div>

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