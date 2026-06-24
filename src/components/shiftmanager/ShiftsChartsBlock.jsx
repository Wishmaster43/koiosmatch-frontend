/**
 * ShiftsChartsBlock — two side-by-side charts: total hours (left) and number of
 * shifts (right). Reads its filters from RightPanelContext (no own filter button).
 * Thin container: owns the UI filter state, delegates data to useShiftsChartData
 * and the filter tree to buildShiftsFilterGroups, and renders the two cards.
 *
 * Props (the "fixed*" ones are always sent and not shown as toggleable filters):
 *   filterKey         — unique key for RightPanelContext (default 'shifts-charts')
 *   fixedCustomers    — customer names always included in the query
 *   fixedLocationIds  — location id strings always included
 *   fixedDepartmentId — department id string always included
 *   fixedCandidateId  — candidate id string always included
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation }     from "react-i18next"
import ShiftsDrillDownDrawer  from "./ShiftsDrillDownDrawer"
import { useRightPanel }      from "../../context/RightPanelContext"
import { SERIES, CURRENT_YEAR } from "./shiftsChartsConfig"
import { BarChartWidget, YearIndicator, ChartCard } from "./shiftsChartsWidgets"
import { useShiftsChartData } from "./useShiftsChartData"
import { buildShiftsFilterGroups } from "./buildShiftsFilterGroups"

export default function ShiftsChartsBlock({
  filterKey         = 'shifts-charts',
  fixedCustomers:    fixedCustomersProp   = [],
  fixedLocationIds:  fixedLocationIdsProp = [],
  fixedDepartmentId = null,
  fixedCandidateId  = null,
}) {
  const { t } = useTranslation('shiftmanager')
  // Stable series-label resolver (memoised so derived bars don't recompute each render).
  const seriesLabel = useCallback((key) => t(`charts.series.${key}`, { defaultValue: key }), [t])

  // Stabilise array props so they keep the same reference across renders
  // (a default [] in props would otherwise cause an infinite re-render loop).
  const fixedCustomers   = useMemo(() => fixedCustomersProp,
    [fixedCustomersProp.join(',')])   // eslint-disable-line
  const fixedLocationIds = useMemo(() => fixedLocationIdsProp,
    [fixedLocationIdsProp.join(',')]) // eslint-disable-line

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedYears,      setSelectedYears]      = useState([CURRENT_YEAR])
  const [selectedMonths,     setSelectedMonths]     = useState([])
  const [period,             setPeriod]             = useState("month")
  const [visible,            setVisible]            = useState(SERIES.map((s) => s.key))
  const [selectedJobTypes,   setSelectedJobTypes]   = useState([])
  const [selectedCustomers,  setSelectedCustomers]  = useState([])
  const [selectedLocations,  setSelectedLocations]  = useState([])
  const [drill,              setDrill]              = useState(null)

  // ── Data layer ──────────────────────────────────────────────────────────────
  const { loading, error, filterOptions, chartData, shiftBars, hoursBars, multiYear } =
    useShiftsChartData({
      selectedYears, selectedMonths, period, visible,
      selectedJobTypes, selectedCustomers, selectedLocations,
      fixedCustomers, fixedLocationIds, fixedDepartmentId, fixedCandidateId,
      seriesLabel,
    })

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

  // Add/remove a year, keeping at least one selected.
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
  const filterGroups = useMemo(() => buildShiftsFilterGroups({
    t, seriesLabel, period, selectedYears, selectedMonths, visible,
    selectedJobTypes, selectedCustomers, selectedLocations, filterOptions,
    fixedCustomers, fixedLocationIds,
    setPeriod, toggleYear, setSelectedMonths, setVisible,
    setSelectedJobTypes, setSelectedCustomers, setSelectedLocations,
  }), [t, seriesLabel, period, selectedYears, selectedMonths, visible, selectedJobTypes,
       selectedCustomers, selectedLocations, filterOptions, fixedCustomers, fixedLocationIds])

  // Sync the groups into the right panel.
  const { registerFilters, unregisterFilters } = useRightPanel()
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
