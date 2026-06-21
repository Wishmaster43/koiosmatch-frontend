/**
 * ShiftsChartsBlock — two side-by-side charts: total hours (left) and number of
 * shifts (right). Reads its filters from RightPanelContext (no own filter button).
 *
 * Props (the "fixed*" ones are always sent and not shown as toggleable filters):
 *   filterKey         — unique key for RightPanelContext (default 'shifts-charts')
 *   fixedCustomers    — customer names always included in the query
 *   fixedLocationIds  — location id strings always included
 *   fixedDepartmentId — department id string always included
 *   fixedCandidateId  — candidate id string always included
 */
import { useEffect, useMemo, useReducer, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import { useTranslation }     from "react-i18next"
import api                    from "../../lib/api"
import ShiftsDrillDownDrawer  from "./ShiftsDrillDownDrawer"
import { useRightPanel }      from "../../context/RightPanelContext"

// ── Constants ───────────────────────────────────────────────────────────────

// Series key + colour; labels come from i18n via t('charts.series.<key>').
const SERIES = [
  { key: "totaal",         color: "#1e293b" },
  { key: "niet_ingevuld",  color: "#f59e0b" },
  { key: "geen_kandidaat", color: "#ef4444" },
  { key: "prognose",       color: "#6366f1" },
  { key: "werkelijk",      color: "#10b981" },
]

// Locale-aware short month name for index 0–11 (used for chart axis labels).
const monthAbbr = (i) => new Date(2000, i, 1).toLocaleString(undefined, { month: "short" })
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]
const YEAR_OPACITY = [1, 0.55, 0.3]

const QUARTERS = [
  { label: "Q1", key: "Q1", months: ["01","02","03"] },
  { label: "Q2", key: "Q2", months: ["04","05","06"] },
  { label: "Q3", key: "Q3", months: ["07","08","09"] },
  { label: "Q4", key: "Q4", months: ["10","11","12"] },
]

// ── Chart-widget ──────────────────────────────────────────────────────────────

function BarChartWidget({ data, bars, onBarClick }) {
  // Deduplicate legend: toon alleen de eerste bar per series-naam (voorkomt dubbele legenda bij meerdere jaren)
  const legendPayload = useMemo(() => {
    const seen = new Set()
    return bars
      .filter(b => b.legendType !== "none")
      .filter(b => {
        if (seen.has(b.name)) return false
        seen.add(b.name)
        return true
      })
      .map(b => ({ value: b.name, type: "square", color: b.color }))
  }, [bars])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
        <Legend payload={legendPayload} wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b) => (
          <Bar
            key={b.dataKey}
            dataKey={b.dataKey}
            name={b.name}
            fill={b.color}
            fillOpacity={b.opacity}
            legendType="none"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(datum) => onBarClick(datum, b)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Kleine jaar-indicator als er meerdere jaren geselecteerd zijn
function YearIndicator({ years }) {
  if (years.length < 2) return null
  return (
    <div className="flex items-center gap-2 mb-3">
      {years.map((y, i) => (
        <span key={y} className="flex items-center gap-1.5 text-xs"
          style={{ color: '#64748b', opacity: YEAR_OPACITY[i] }}>
          <span style={{ display: 'inline-block', width: 10, height: 10,
                         borderRadius: 2, background: '#64748b', opacity: YEAR_OPACITY[i] }} />
          {y}
        </span>
      ))}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, loading, error, children }) {
  const { t } = useTranslation('shiftmanager')
  return (
    <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {loading && (
          <div className="flex items-center justify-center h-64 text-slate-400">{t('charts.loading')}</div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
        )}
        {!loading && !error && children}
      </div>
    </div>
  )
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────

export default function ShiftsChartsBlock({
  filterKey         = 'shifts-charts',
  fixedCustomers:    fixedCustomersProp   = [],
  fixedLocationIds:  fixedLocationIdsProp = [],
  fixedDepartmentId = null,
  fixedCandidateId  = null,
}) {
  const { t } = useTranslation('shiftmanager')
  const seriesLabel = (key) => t(`charts.series.${key}`, { defaultValue: key })
  // Stabilise array props so they keep the same reference across renders
  // (a default [] in props would otherwise cause an infinite re-render loop)
  const fixedCustomers   = useMemo(() => fixedCustomersProp,   // eslint-disable-line
    [fixedCustomersProp.join(',')])                            // eslint-disable-line
  const fixedLocationIds = useMemo(() => fixedLocationIdsProp, // eslint-disable-line
    [fixedLocationIdsProp.join(',')])                          // eslint-disable-line

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedYears,      setSelectedYears]      = useState([CURRENT_YEAR])
  const [selectedMonths,     setSelectedMonths]     = useState([])
  const [period,             setPeriod]             = useState("month")
  const [visible,            setVisible]            = useState(SERIES.map((s) => s.key))
  const [selectedJobTypes,   setSelectedJobTypes]   = useState([])
  const [selectedCustomers,  setSelectedCustomers]  = useState([])
  const [selectedLocations,  setSelectedLocations]  = useState([])

  // ── Data state ────────────────────────────────────────────────────────────
  const [{ rows, loading, error }, dispatch] = useReducer(
    (_, action) => action,
    { rows: [], loading: true, error: null }
  )
  const [filterOptions, setFilterOptions] = useState({ job_types: [], locations: [] })
  const [drill,         setDrill]         = useState(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  // ── Filter-opties laden ───────────────────────────────────────────────────
  useEffect(() => {
    api.get("/sm_reports/shifts-filter-options")
      .then((res) => setFilterOptions(res.data ?? { job_types: [], locations: [] }))
      .catch(() => {})
  }, [])

  // ── Chart data laden ──────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    dispatch({ rows: [], loading: true, error: null })

    const params = new URLSearchParams()
    selectedYears.forEach((y) => params.append("years[]", y))
    selectedMonths.forEach((m) => params.append("months[]", m))
    selectedJobTypes.forEach((j) => params.append("job_type[]", j))

    // Fixed department / candidate (pre-scoped context)
    if (fixedDepartmentId) params.append("department_id[]", fixedDepartmentId)
    if (fixedCandidateId)  params.append("candidate_id[]",  fixedCandidateId)

    // Effectieve locaties: vaste locaties hebben de hoogste prioriteit,
    // dan user-geselecteerde locaties, dan klant-gebaseerde filtering.
    const allFixed = [...fixedLocationIds]
    if (allFixed.length > 0) {
      allFixed.forEach((l) => params.append("location_id[]", l))
    } else {
      const effectiveLocations = selectedLocations.length > 0
        ? selectedLocations
        : [...selectedCustomers, ...fixedCustomers].length > 0
          ? filterOptions.locations
              .filter(l => [...selectedCustomers, ...fixedCustomers].includes(l.customer ?? l.name))
              .map(l => String(l.id))
          : []
      effectiveLocations.forEach((l) => params.append("location_id[]", l))
    }

    api.get(`/sm_reports/shifts-per-month?${params}`)
      .then((res) => {
        if (!active) return
        const data = res.data?.data ?? res.data ?? []
        dispatch({ rows: Array.isArray(data) ? data : [], loading: false, error: null })
      })
      .catch((err) => active && dispatch({ rows: [], loading: false, error: err.message ?? "Laden mislukt" }))

    return () => { active = false }
  }, [selectedYears, selectedMonths, selectedJobTypes, selectedLocations, selectedCustomers,
      filterOptions.locations, fixedLocationIds, fixedCustomers, fixedDepartmentId, fixedCandidateId])

  // ── Rows indexeren ────────────────────────────────────────────────────────
  const byYearMonth = useMemo(
    () => new Map(rows.map((r) => [r.maand, r])),
    [rows]
  )

  // ── Chart data transformeren ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    const monthIndices =
      selectedMonths.length > 0
        ? selectedMonths.map((m) => parseInt(m, 10) - 1).filter((i) => i >= 0 && i < 12)
        : Array.from({ length: 12 }, (_, i) => i)

    if (period === "quarter") {
      return QUARTERS.map((q) => {
        const entry = { label: q.label, _quarter: q.key }
        selectedYears.forEach((year) => {
          const qRows = q.months.map((m) => byYearMonth.get(`${year}-${m}`) ?? {})
          const sum   = (key) => qRows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0)
          SERIES.forEach((s) => {
            entry[`${year}_${s.key}`]      = sum(s.key)
            entry[`${year}_${s.key}_uren`] = sum(`${s.key}_uren`)
          })
        })
        return entry
      })
    }

    return monthIndices.map((i) => {
      const entry = { label: monthAbbr(i), _monthIndex: i + 1 }
      selectedYears.forEach((year) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}`
        const row = byYearMonth.get(key) ?? {}
        SERIES.forEach((s) => {
          entry[`${year}_${s.key}`]      = Number(row[s.key]            ?? 0)
          entry[`${year}_${s.key}_uren`] = Number(row[`${s.key}_uren`] ?? 0)
        })
      })
      return entry
    })
  }, [byYearMonth, selectedYears, selectedMonths, period])

  const activeSeries = SERIES.filter((s) => visible.includes(s.key))
  const multiYear    = selectedYears.length > 1

  // ── Bar-descriptors ───────────────────────────────────────────────────────
  const shiftBars = useMemo(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s) => ({
        dataKey:    `${year}_${s.key}`,
        name:       seriesLabel(s.key),
        color:      s.color,
        opacity:    YEAR_OPACITY[yi] ?? 0.25,
        legendType: yi === 0 ? "square" : "none",
        year,
        seriesKey:  s.key,
      }))
    ), [selectedYears, activeSeries])

  const hoursBars = useMemo(() =>
    selectedYears.flatMap((year, yi) =>
      activeSeries.map((s) => ({
        dataKey:    `${year}_${s.key}_uren`,
        name:       seriesLabel(s.key),
        color:      s.color,
        opacity:    YEAR_OPACITY[yi] ?? 0.25,
        legendType: yi === 0 ? "square" : "none",
        year,
        seriesKey:  `${s.key}_uren`,
      }))
    ), [selectedYears, activeSeries])

  // ── Drill-down ────────────────────────────────────────────────────────────
  const handleBarClick = (datum, barMeta) => {
    const { year, seriesKey } = barMeta
    const baseMetric = seriesKey.replace("_uren", "")
    const params     = new URLSearchParams()

    if (period === "quarter") {
      params.set("quarter", datum._quarter ?? datum.label)
      params.set("year", year)
    } else {
      const mm = String(datum._monthIndex ?? 1).padStart(2, "0")
      params.set("month", `${year}-${mm}`)
    }

    params.set("metric", baseMetric)
    selectedJobTypes.forEach((j) => params.append("job_type[]", j))
    selectedLocations.forEach((l) => params.append("location_id[]", l))
    fixedLocationIds.forEach((l)  => params.append("location_id[]", l))
    if (fixedDepartmentId) params.append("department_id[]", fixedDepartmentId)
    if (fixedCandidateId)  params.append("candidate_id[]",  fixedCandidateId)

    const metricLabel = seriesLabel(baseMetric)
    const yearSuffix  = multiYear ? ` '${String(year).slice(2)}` : ""
    setDrill({
      title:    `${metricLabel}${yearSuffix} — ${datum.label}`,
      fetchUrl: `/sm_reports/shifts-per-month/detail?${params}`,
    })
  }

  // ── Jaar-toggle ───────────────────────────────────────────────────────────
  const toggleYear = (v) =>
    setSelectedYears((prev) => {
      const n = Number(v)
      if (prev.includes(n)) return prev.length > 1 ? prev.filter((y) => y !== n) : prev
      return [...prev, n].sort()
    })

  const periodLabel = t('charts.periodLabel', {
    years: selectedYears.join(", "),
    unit:  period === "quarter" ? t('charts.perQuarterUnit') : t('charts.perMonthUnit'),
  })

  // ── Filter groups for the right sidebar ───────────────────────────────────
  const filterGroups = useMemo(() => {
    const groups = [
      {
        key:      "periode",
        label:    t('charts.filters.period'),
        selected: [period],
        options:  [
          { value: "month",   label: t('charts.filters.month') },
          { value: "quarter", label: t('charts.filters.quarter') },
        ],
        onToggle: (v) => setPeriod(v),
      },
      {
        key:      "jaren",
        label:    t('charts.filters.years'),
        selected: selectedYears.map(String),
        options:  YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
        onToggle: toggleYear,
      },
    ]

    if (period === "month") {
      groups.push({
        key:      "maanden",
        label:    t('charts.filters.months'),
        selected: selectedMonths.length > 0
          ? selectedMonths.map(String)
          : Array.from({ length: 12 }, (_, i) => String(i + 1)),
        options:  Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthAbbr(i) })),
        onToggle: (v) =>
          setSelectedMonths((prev) =>
            prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]
          ),
      })
    }

    groups.push({
      key:      "reeksen",
      label:    t('charts.filters.series'),
      selected: visible,
      options:  SERIES.map((s) => ({ value: s.key, label: seriesLabel(s.key) })),
      onToggle: (v) =>
        setVisible((prev) =>
          prev.includes(v) ? prev.filter((k) => k !== v) : [...prev, v]
        ),
    })

    if (filterOptions.job_types.length > 0) {
      groups.push({
        key:      "functie",
        label:    t('charts.filters.jobType'),
        selected: selectedJobTypes,
        options:  filterOptions.job_types.map((j) => ({ value: j, label: j })),
        onToggle: (v) =>
          setSelectedJobTypes((prev) =>
            prev.includes(v) ? prev.filter((j) => j !== v) : [...prev, v]
          ),
      })
    }

    // Klant-filter alleen tonen als er geen vaste klant/locatie is ingesteld
    if (fixedCustomers.length === 0 && fixedLocationIds.length === 0) {
      const customerOptions = [...new Set(
        filterOptions.locations.map(l => l.customer).filter(Boolean)
      )].sort().map(c => ({ value: c, label: c }))

      if (customerOptions.length > 0) {
        groups.push({
          key:      "klant",
          label:    t('charts.filters.customer'),
          type:     "search-select",
          selected: selectedCustomers,
          options:  customerOptions,
          onToggle: (v) =>
            setSelectedCustomers((prev) =>
              prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]
            ),
        })
      }
    }

    // Locatie-filter alleen tonen als er geen vaste locaties zijn
    if (fixedLocationIds.length === 0) {
      const locationOptions = filterOptions.locations
        .filter(l => {
          if (fixedCustomers.length > 0) return fixedCustomers.includes(l.customer)
          return selectedCustomers.length === 0 || selectedCustomers.includes(l.customer)
        })
        .map(l => ({ value: String(l.id), label: l.name }))

      if (locationOptions.length > 0) {
        groups.push({
          key:      "locatie",
          label:    t('charts.filters.location'),
          type:     "search-select",
          selected: selectedLocations,
          options:  locationOptions,
          onToggle: (v) =>
            setSelectedLocations((prev) =>
              prev.includes(v) ? prev.filter((l) => l !== v) : [...prev, v]
            ),
        })
      }
    }

    return groups
  }, [t, period, selectedYears, selectedMonths, visible, selectedJobTypes, selectedCustomers,
      selectedLocations, filterOptions, fixedCustomers, fixedLocationIds])

  // ── Sync naar rechter panel ───────────────────────────────────────────────
  useEffect(() => {
    registerFilters(filterKey, filterGroups)
    return () => unregisterFilters(filterKey)
  }, [filterKey, filterGroups, registerFilters, unregisterFilters])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t('charts.hours')} subtitle={periodLabel} loading={loading} error={error}>
          <YearIndicator years={selectedYears} />
          <BarChartWidget data={chartData} bars={hoursBars} onBarClick={handleBarClick} />
        </ChartCard>

        <ChartCard title={t('charts.shifts')} subtitle={periodLabel} loading={loading} error={error}>
          <YearIndicator years={selectedYears} />
          <BarChartWidget data={chartData} bars={shiftBars} onBarClick={handleBarClick} />
        </ChartCard>
      </div>

      {drill && (
        <ShiftsDrillDownDrawer
          title={drill.title}
          fetchUrl={drill.fetchUrl}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  )
}
